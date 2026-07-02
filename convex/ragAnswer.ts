import { v } from "convex/values";

import { api } from "./_generated/api";
import { action } from "./_generated/server";
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

const historyTurn = v.object({
  question: v.string(),
  answer: v.string(),
});

export const generateGroundedAnswer = action({
  args: {
    question: v.string(),
    limit: v.optional(v.number()),
    history: v.optional(v.array(historyTurn)),
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
  }),
  handler: async (ctx, args): Promise<GroundedAnswerResponse> => {
    try {
      const config = readAnswerConfig();
      const history = trimHistory(args.history ?? []);
      const retrieval: RetrievalForAnswer = await ctx.runAction(
        api.ragRetrieval.retrieveRelevantChunks,
        {
          // Fold recent questions into the retrieval query so a short follow-up
          // still finds the right chunks.
          question: buildRetrievalQuery(args.question, history),
          limit: args.limit,
        },
      );
      const citedResults = addCitationLabels(retrieval.results);

      if (citedResults.length === 0) {
        const structuredAnswer = buildInsufficientEvidenceAnswer();

        return {
          question: args.question,
          answer: structuredAnswerToText(structuredAnswer),
          answerModel: config.deployment,
          structuredAnswer,
          retrieval: {
            embeddingModel: retrieval.embeddingModel,
            embeddingDimensions: retrieval.embeddingDimensions,
            results: citedResults,
          },
        };
      }

      const messages = buildGroundedAnswerMessages(
        args.question,
        citedResults,
        history,
      );
      const rawAnswer = await requestChatCompletion(config, messages);
      const structuredAnswer = parseStructuredGroundedAnswer(
        rawAnswer,
        citedResults,
      );

      return {
        question: args.question,
        answer: structuredAnswerToText(structuredAnswer),
        answerModel: config.deployment,
        structuredAnswer,
        retrieval: {
          embeddingModel: retrieval.embeddingModel,
          embeddingDimensions: retrieval.embeddingDimensions,
          results: citedResults,
        },
      };
    } catch (error) {
      throw new Error(toSafeErrorMessage(error));
    }
  },
});
