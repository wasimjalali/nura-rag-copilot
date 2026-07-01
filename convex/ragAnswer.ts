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

export const generateGroundedAnswer = action({
  args: {
    question: v.string(),
    limit: v.optional(v.number()),
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
      const retrieval: RetrievalForAnswer = await ctx.runAction(
        api.ragRetrieval.retrieveRelevantChunks,
        {
          question: args.question,
          limit: args.limit,
        },
      );
      const citedResults = addCitationLabels(retrieval.results);

      if (citedResults.length === 0) {
        const structuredAnswer = buildInsufficientEvidenceAnswer();

        return {
          question: retrieval.question,
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
        retrieval.question,
        citedResults,
      );
      const rawAnswer = await requestChatCompletion(config, messages);
      const structuredAnswer = parseStructuredGroundedAnswer(
        rawAnswer,
        citedResults,
      );

      return {
        question: retrieval.question,
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
