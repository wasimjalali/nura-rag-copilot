import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction, internalQuery } from "./_generated/server";
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
  retryCount: number;
};

export const retrieveRelevantChunks = internalAction({
  args: {
    question: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    question: v.string(),
    embeddingModel: v.string(),
    embeddingDimensions: v.number(),
    results: v.array(retrievalResult),
    retryCount: v.number(),
  }),
  handler: async (ctx, args): Promise<RetrievalResponse> => {
    try {
      const question = validateQuestion(args.question);
      const limit = clampLimit(args.limit);
      const target: {
        activeVersionId: Id<"corpusVersions"> | null;
        legacyAvailable: boolean;
      } = await ctx.runQuery(internal.ragRetrieval.getRetrievalTarget, {});
      if (!target.activeVersionId && !target.legacyAvailable) {
        throw new Error("CORPUS_NOT_READY");
      }
      const config = readEmbeddingConfig();
      let retryCount = 0;
      const vectors = await requestEmbeddings(config, [question], {
        onRetry: () => {
          retryCount += 1;
        },
      });
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
        filter: (q) =>
          q.eq("corpusVersionId", target.activeVersionId ?? undefined),
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
          corpusVersionId: target.activeVersionId ?? undefined,
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
        retryCount,
      };
    } catch (error) {
      throw new Error(toSafeErrorMessage(error));
    }
  },
});

export const getChunksByIds = internalQuery({
  args: {
    ids: v.array(v.id("documentChunks")),
    corpusVersionId: v.optional(v.id("corpusVersions")),
  },
  returns: v.array(retrievalChunkRecord),
  handler: async (ctx, args): Promise<RetrievalChunkRecord[]> => {
    const chunks: RetrievalChunkRecord[] = [];

    for (const id of args.ids) {
      const chunk = await ctx.db.get(id);

      if (!chunk) {
        continue;
      }
      if (chunk.corpusVersionId !== args.corpusVersionId) continue;

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

export const getRetrievalTarget = internalQuery({
  args: {},
  handler: async (ctx) => {
    const corpus = await ctx.db
      .query("corpora")
      .withIndex("by_name", (q) => q.eq("name", "default"))
      .unique();
    const legacyChunks = await ctx.db.query("documentChunks").collect();
    return {
      activeVersionId: corpus?.activeVersionId ?? null,
      legacyAvailable: legacyChunks.some(
        (chunk) =>
          chunk.corpusVersionId === undefined && chunk.embedding !== undefined,
      ),
    };
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
