import { v } from "convex/values";

import { api } from "./_generated/api";
import { action } from "./_generated/server";
import {
  readAnswerConfig,
  requestChatCompletion,
} from "./answerProvider";
import { toSafeErrorMessage } from "./embeddingProvider";
import {
  INSUFFICIENT_EVIDENCE_ANSWER,
  addCitationLabels,
  buildGroundedAnswerMessages,
  type CitedRetrievalResult,
} from "./groundedAnswer";

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
        return {
          question: retrieval.question,
          answer: INSUFFICIENT_EVIDENCE_ANSWER,
          answerModel: config.deployment,
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
      const answer = await requestChatCompletion(config, messages);

      return {
        question: retrieval.question,
        answer,
        answerModel: config.deployment,
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
