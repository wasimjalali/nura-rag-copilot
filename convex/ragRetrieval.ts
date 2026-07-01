import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalQuery } from "./_generated/server";
import {
  EMBEDDING_DIMENSIONS,
  readEmbeddingConfig,
  requestEmbeddings,
  toSafeErrorMessage,
} from "./embeddingProvider";

const DEFAULT_RETRIEVAL_LIMIT = 5;
const MIN_RETRIEVAL_LIMIT = 1;
const MAX_RETRIEVAL_LIMIT = 10;
// cosine similarity floor; tunable. Below this, treat as no evidence so the
// deterministic refusal fires.
const MIN_RELEVANCE_SCORE = 0.35;

const retrievalChunkRecord = v.object({
  _id: v.id("documentChunks"),
  chunkId: v.string(),
  source: v.string(),
  section: v.string(),
  text: v.string(),
  tokenEstimate: v.number(),
});

const retrievalResult = v.object({
  rank: v.number(),
  score: v.number(),
  chunkId: v.string(),
  source: v.string(),
  section: v.string(),
  text: v.string(),
  tokenEstimate: v.number(),
});

type RetrievalChunkRecord = {
  _id: Id<"documentChunks">;
  chunkId: string;
  source: string;
  section: string;
  text: string;
  tokenEstimate: number;
};

type RetrievalResult = Omit<RetrievalChunkRecord, "_id"> & {
  rank: number;
  score: number;
};

type RetrievalResponse = {
  question: string;
  embeddingModel: string;
  embeddingDimensions: number;
  results: RetrievalResult[];
};

export const retrieveRelevantChunks = action({
  args: {
    question: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    question: v.string(),
    embeddingModel: v.string(),
    embeddingDimensions: v.number(),
    results: v.array(retrievalResult),
  }),
  handler: async (ctx, args): Promise<RetrievalResponse> => {
    try {
      const question = validateQuestion(args.question);
      const limit = clampLimit(args.limit);
      const config = readEmbeddingConfig();
      const vectors = await requestEmbeddings(config, [question]);
      const vector = vectors[0];

      if (!vector) {
        throw new Error("Embedding response did not include a query vector.");
      }

      if (vector.length !== EMBEDDING_DIMENSIONS) {
        throw new Error(
          `Question returned ${vector.length} dimensions; expected ${EMBEDDING_DIMENSIONS}.`,
        );
      }

      const matches = await ctx.vectorSearch("documentChunks", "by_embedding", {
        vector,
        limit,
      });
      // Drop matches below the relevance floor before building results, so
      // ranks stay contiguous over the kept matches and a question with no
      // relevant evidence returns an empty results array (triggering refusal).
      const relevantMatches = matches.filter(
        (match) => match._score >= MIN_RELEVANCE_SCORE,
      );
      const chunks: RetrievalChunkRecord[] = await ctx.runQuery(
        internal.ragRetrieval.getChunksByIds,
        {
          ids: relevantMatches.map((match) => match._id),
        },
      );
      const chunksById = new Map<Id<"documentChunks">, RetrievalChunkRecord>(
        chunks.map((chunk) => [chunk._id, chunk]),
      );
      const results: RetrievalResult[] = [];

      for (const match of relevantMatches) {
        const chunk = chunksById.get(match._id);

        if (!chunk) {
          continue;
        }

        results.push({
          rank: results.length + 1,
          score: match._score,
          chunkId: chunk.chunkId,
          source: chunk.source,
          section: chunk.section,
          text: chunk.text,
          tokenEstimate: chunk.tokenEstimate,
        });
      }

      return {
        question,
        embeddingModel: config.deployment,
        embeddingDimensions: EMBEDDING_DIMENSIONS,
        results,
      };
    } catch (error) {
      throw new Error(toSafeErrorMessage(error));
    }
  },
});

export const getChunksByIds = internalQuery({
  args: {
    ids: v.array(v.id("documentChunks")),
  },
  returns: v.array(retrievalChunkRecord),
  handler: async (ctx, args): Promise<RetrievalChunkRecord[]> => {
    const chunks: RetrievalChunkRecord[] = [];

    for (const id of args.ids) {
      const chunk = await ctx.db.get(id);

      if (!chunk) {
        continue;
      }

      chunks.push({
        _id: chunk._id,
        chunkId: chunk.chunkId,
        source: chunk.source,
        section: chunk.section,
        text: chunk.text,
        tokenEstimate: chunk.tokenEstimate,
      });
    }

    return chunks;
  },
});

function validateQuestion(question: string) {
  const normalized = question.trim();

  if (normalized.length === 0) {
    throw new Error("Enter a question to retrieve evidence.");
  }

  return normalized;
}

function clampLimit(limit = DEFAULT_RETRIEVAL_LIMIT) {
  if (!Number.isFinite(limit)) {
    return DEFAULT_RETRIEVAL_LIMIT;
  }

  return Math.min(
    MAX_RETRIEVAL_LIMIT,
    Math.max(MIN_RETRIEVAL_LIMIT, Math.trunc(limit)),
  );
}
