import { v } from "convex/values";

import { api, internal } from "./_generated/api";
import { action, type ActionCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  readAnswerConfig,
  requestChatCompletion,
} from "./answerProvider";
import { toSafeErrorMessage } from "./embeddingProvider";
import {
  addCitationLabels,
  buildInsufficientEvidenceAnswer,
  buildGroundedAnswerMessages,
  parseStructuredGroundedAnswer,
  structuredAnswerToText,
  type CitedRetrievalResult,
  type ConversationTurn,
  type StructuredGroundedAnswer,
} from "./groundedAnswer";
import { requireActor } from "./auth";

const answerType = v.union(
  v.literal("grounded"),
  v.literal("insufficient_evidence"),
);

const groundedAnswerParagraph = v.object({
  text: v.string(),
  citations: v.array(v.string()),
});

const citedRetrievalResult = v.object({
  rank: v.number(),
  score: v.number(),
  chunkId: v.string(),
  source: v.string(),
  section: v.string(),
  text: v.string(),
  tokenEstimate: v.number(),
  citationLabel: v.string(),
});

type RetrievalForAnswer = {
  question: string;
  embeddingModel: string;
  embeddingDimensions: number;
  results: Array<{
    rank: number;
    score: number;
    chunkId: string;
    source: string;
    section: string;
    text: string;
    tokenEstimate: number;
  }>;
};

type GroundedAnswerResponse = {
  question: string;
  answer: string;
  answerModel: string;
  structuredAnswer: StructuredGroundedAnswer;
  retrieval: {
    embeddingModel: string;
    embeddingDimensions: number;
    results: CitedRetrievalResult[];
  };
  conversationId?: Id<"conversations">;
  assistantMessageId?: Id<"messages">;
};

// Multi-turn context: how much prior conversation to carry. Bounded so the
// cost per question stays predictable no matter how long the chat gets.
const MAX_HISTORY_TURNS = 6;
const MAX_HISTORY_CHARS = 6000;
const MAX_CONTEXT_QUESTIONS = 2;

function trimHistory(history: ConversationTurn[]): ConversationTurn[] {
  const recent = history.slice(-MAX_HISTORY_TURNS);
  const trimmed: ConversationTurn[] = [];
  let total = 0;

  // Keep the most recent turns; drop the oldest once the char budget is hit.
  for (let index = recent.length - 1; index >= 0; index -= 1) {
    const turn = recent[index];
    const size = turn.question.length + turn.answer.length;

    if (total + size > MAX_HISTORY_CHARS && trimmed.length > 0) {
      break;
    }

    trimmed.unshift(turn);
    total += size;
  }

  return trimmed;
}

// A short follow-up ("what about express?") embeds poorly on its own, so fold
// the recent questions into the retrieval query to keep vector search on topic.
function buildRetrievalQuery(
  question: string,
  history: ConversationTurn[],
): string {
  const priorQuestions = history
    .slice(-MAX_CONTEXT_QUESTIONS)
    .map((turn) => turn.question);

  return [...priorQuestions, question].join("\n");
}

export const generateGroundedAnswer = action({
  args: {
    question: v.string(),
    limit: v.optional(v.number()),
    conversationId: v.optional(v.id("conversations")),
    requestId: v.string(),
    persistConversation: v.optional(v.boolean()),
  },
  returns: v.object({
    question: v.string(),
    answer: v.string(),
    answerModel: v.string(),
    structuredAnswer: v.object({
      answerType,
      paragraphs: v.array(groundedAnswerParagraph),
    }),
    retrieval: v.object({
      embeddingModel: v.string(),
      embeddingDimensions: v.number(),
      results: v.array(citedRetrievalResult),
    }),
    conversationId: v.optional(v.id("conversations")),
    assistantMessageId: v.optional(v.id("messages")),
  }),
  handler: async (ctx, args): Promise<GroundedAnswerResponse> => {
    const actor = await requireActor(ctx);
    const startedAt = Date.now();
    const persistConversation = args.persistConversation !== false;
    let pending:
      | {
          conversationId: Id<"conversations">;
          assistantMessageId: Id<"messages">;
          duplicate: boolean;
        }
      | undefined;

    try {
      const config = readAnswerConfig();
      if (persistConversation) {
        pending = await ctx.runMutation(internal.conversations.createPendingTurn, {
          ownerSubject: actor.subject,
          conversationId: args.conversationId,
          requestId: args.requestId,
          question: args.question,
          now: startedAt,
        });
        if (pending.duplicate) {
          const completed = await ctx.runQuery(
            internal.conversations.getCompletedTurn,
            {
              assistantMessageId: pending.assistantMessageId,
              ownerSubject: actor.subject,
            },
          );
          if (completed) return completed;
          throw new Error("An answer is already in progress.");
        }
      }
      const history = trimHistory(
        pending
          ? await ctx.runQuery(internal.conversations.getHistory, {
              conversationId: pending.conversationId,
              ownerSubject: actor.subject,
            })
          : [],
      );
      const retrievalStartedAt = Date.now();
      const retrieval: RetrievalForAnswer = await ctx.runAction(
        api.ragRetrieval.retrieveRelevantChunks,
        {
          // Fold recent questions into the retrieval query so a short follow-up
          // still finds the right chunks.
          question: buildRetrievalQuery(args.question, history),
          limit: args.limit,
        },
      );
      const retrievalFinishedAt = Date.now();
      const citedResults = addCitationLabels(retrieval.results);

      if (citedResults.length === 0) {
        const structuredAnswer = buildInsufficientEvidenceAnswer();
        const response: GroundedAnswerResponse = {
          question: args.question,
          answer: structuredAnswerToText(structuredAnswer),
          answerModel: config.deployment,
          structuredAnswer,
          retrieval: {
            embeddingModel: retrieval.embeddingModel,
            embeddingDimensions: retrieval.embeddingDimensions,
            results: citedResults,
          },
          conversationId: pending?.conversationId,
          assistantMessageId: pending?.assistantMessageId,
        };
        await completePersistedTurn(ctx, pending, response);
        await recordAnswerOperation(ctx, {
          requestId: args.requestId,
          actorSubject: actor.subject,
          startedAt,
          retrievalMs: retrievalFinishedAt - retrievalStartedAt,
          generationMs: 0,
          response,
        });
        return response;
      }

      const messages = buildGroundedAnswerMessages(
        args.question,
        citedResults,
        history,
      );
      const generationStartedAt = Date.now();
      const rawAnswer = await requestChatCompletion(config, messages);
      const structuredAnswer = parseStructuredGroundedAnswer(
        rawAnswer,
        citedResults,
      );

      const response: GroundedAnswerResponse = {
        question: args.question,
        answer: structuredAnswerToText(structuredAnswer),
        answerModel: config.deployment,
        structuredAnswer,
        retrieval: {
          embeddingModel: retrieval.embeddingModel,
          embeddingDimensions: retrieval.embeddingDimensions,
          results: citedResults,
        },
        conversationId: pending?.conversationId,
        assistantMessageId: pending?.assistantMessageId,
      };
      await completePersistedTurn(ctx, pending, response);
      await recordAnswerOperation(ctx, {
        requestId: args.requestId,
        actorSubject: actor.subject,
        startedAt,
        retrievalMs: retrievalFinishedAt - retrievalStartedAt,
        generationMs: Date.now() - generationStartedAt,
        response,
      });
      return response;
    } catch (error) {
      if (pending && !pending.duplicate) {
        await ctx.runMutation(internal.conversations.failTurn, {
          assistantMessageId: pending.assistantMessageId,
          errorCode: toOperationErrorCode(error),
          now: Date.now(),
        });
      }
      await ctx.runMutation(internal.operations.recordOperation, {
        requestId: args.requestId,
        actorSubject: actor.subject,
        operationType: "answer",
        status: "failed",
        modelIdentifiers: {},
        timings: {
          startedAt,
          finishedAt: Date.now(),
          durationMs: Date.now() - startedAt,
        },
        retryCount: 0,
        errorCode: toOperationErrorCode(error),
      });
      throw new Error(toSafeErrorMessage(error));
    }
  },
});

async function completePersistedTurn(
  ctx: ActionCtx,
  pending:
    | {
        conversationId: Id<"conversations">;
        assistantMessageId: Id<"messages">;
        duplicate: boolean;
      }
    | undefined,
  response: GroundedAnswerResponse,
) {
  if (!pending) return;
  await ctx.runMutation(internal.conversations.completeTurn, {
    assistantMessageId: pending.assistantMessageId,
    content: response.answer,
    answerType: response.structuredAnswer.answerType,
    answerModel: response.answerModel,
    embeddingModel: response.retrieval.embeddingModel,
    embeddingDimensions: response.retrieval.embeddingDimensions,
    structuredParagraphs: response.structuredAnswer.paragraphs,
    evidence: response.retrieval.results,
    now: Date.now(),
  });
}

async function recordAnswerOperation(
  ctx: ActionCtx,
  input: {
    requestId: string;
    actorSubject: string;
    startedAt: number;
    retrievalMs: number;
    generationMs: number;
    response: GroundedAnswerResponse;
  },
) {
  const finishedAt = Date.now();
  await ctx.runMutation(internal.operations.recordOperation, {
    requestId: input.requestId,
    actorSubject: input.actorSubject,
    operationType: "answer",
    status: "succeeded",
    modelIdentifiers: {
      answerModel: input.response.answerModel,
      embeddingModel: input.response.retrieval.embeddingModel,
    },
    timings: {
      startedAt: input.startedAt,
      finishedAt,
      durationMs: finishedAt - input.startedAt,
      retrievalMs: input.retrievalMs,
      generationMs: input.generationMs,
    },
    retrievalSummary: {
      resultCount: input.response.retrieval.results.length,
      topScore: input.response.retrieval.results[0]?.score,
      citedChunkCount: new Set(
        input.response.structuredAnswer.paragraphs.flatMap(
          (paragraph) => paragraph.citations,
        ),
      ).size,
    },
    retryCount: 0,
  });
}

function toOperationErrorCode(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("AUTH_REQUIRED")) return "AUTH_REQUIRED" as const;
  if (message.includes("FORBIDDEN")) return "FORBIDDEN" as const;
  if (message.includes("rate limited")) return "RATE_LIMITED" as const;
  if (message.includes("already in progress")) return "RATE_LIMITED" as const;
  if (message.includes("invalid response")) return "INVALID_MODEL_RESPONSE" as const;
  if (message.includes("temporarily unavailable")) return "PROVIDER_TEMPORARY" as const;
  return "INTERNAL_ERROR" as const;
}
