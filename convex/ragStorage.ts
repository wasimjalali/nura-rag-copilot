import { v } from "convex/values";

import { internalMutation, query } from "./_generated/server";

type StorageStatus = {
  storedDocuments: number;
  storedChunks: number;
  embeddedChunks: number;
  lastRunStatus: "not_started" | "running" | "succeeded" | "failed";
  lastRunMessage: string | null;
  lastEmbeddedAt: number | null;
};

const nullableNumber = v.union(v.number(), v.null());
const nullableString = v.union(v.string(), v.null());

const runStatus = v.union(
  v.literal("not_started"),
  v.literal("running"),
  v.literal("succeeded"),
  v.literal("failed"),
);

const sourceDocumentInput = v.object({
  source: v.string(),
  title: v.string(),
  textHash: v.string(),
  wordCount: v.number(),
});

const documentChunkInput = v.object({
  chunkId: v.string(),
  source: v.string(),
  section: v.string(),
  text: v.string(),
  tokenEstimate: v.number(),
});

const embeddingInput = v.object({
  chunkId: v.string(),
  embedding: v.array(v.number()),
  embeddingModel: v.string(),
  embeddingDimensions: v.number(),
});

export const getStorageStatus = query({
  args: {},
  returns: v.object({
    storedDocuments: v.number(),
    storedChunks: v.number(),
    embeddedChunks: v.number(),
    lastRunStatus: runStatus,
    lastRunMessage: nullableString,
    lastEmbeddedAt: nullableNumber,
  }),
  handler: async (ctx): Promise<StorageStatus> => {
    const documents = await ctx.db.query("sourceDocuments").collect();
    const chunks = await ctx.db.query("documentChunks").collect();
    const lastRun = await ctx.db
      .query("embeddingRuns")
      .withIndex("by_started_at")
      .order("desc")
      .first();

    const embeddedChunks = chunks.filter(
      (chunk) => chunk.embedding !== undefined,
    );
    const lastEmbeddedAt =
      embeddedChunks.reduce<number | null>((latest, chunk) => {
        if (chunk.embeddedAt === undefined) {
          return latest;
        }

        return latest === null ? chunk.embeddedAt : Math.max(latest, chunk.embeddedAt);
      }, null) ?? null;

    const lastRunStatus: StorageStatus["lastRunStatus"] =
      lastRun?.status ?? "not_started";

    return {
      storedDocuments: documents.length,
      storedChunks: chunks.length,
      embeddedChunks: embeddedChunks.length,
      lastRunStatus,
      lastRunMessage: lastRun?.message ?? null,
      lastEmbeddedAt,
    };
  },
});

export const upsertPreviewRecords = internalMutation({
  args: {
    documents: v.array(sourceDocumentInput),
    chunks: v.array(documentChunkInput),
    now: v.number(),
  },
  returns: v.object({
    storedDocuments: v.number(),
    storedChunks: v.number(),
  }),
  handler: async (ctx, args) => {
    for (const document of args.documents) {
      const existing = await ctx.db
        .query("sourceDocuments")
        .withIndex("by_source", (q) => q.eq("source", document.source))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, {
          title: document.title,
          textHash: document.textHash,
          wordCount: document.wordCount,
          updatedAt: args.now,
        });
      } else {
        await ctx.db.insert("sourceDocuments", {
          ...document,
          updatedAt: args.now,
        });
      }
    }

    for (const chunk of args.chunks) {
      const existing = await ctx.db
        .query("documentChunks")
        .withIndex("by_chunk_id", (q) => q.eq("chunkId", chunk.chunkId))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, {
          source: chunk.source,
          section: chunk.section,
          text: chunk.text,
          tokenEstimate: chunk.tokenEstimate,
          updatedAt: args.now,
        });
      } else {
        await ctx.db.insert("documentChunks", {
          ...chunk,
          updatedAt: args.now,
        });
      }
    }

    return {
      storedDocuments: args.documents.length,
      storedChunks: args.chunks.length,
    };
  },
});

export const startEmbeddingRun = internalMutation({
  args: {
    documents: v.number(),
    chunks: v.number(),
    startedAt: v.number(),
  },
  returns: v.id("embeddingRuns"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("embeddingRuns", {
      status: "running",
      startedAt: args.startedAt,
      documents: args.documents,
      chunks: args.chunks,
      embeddedChunks: 0,
    });
  },
});

export const saveEmbeddings = internalMutation({
  args: {
    embeddings: v.array(embeddingInput),
    embeddedAt: v.number(),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    let saved = 0;

    for (const item of args.embeddings) {
      const existing = await ctx.db
        .query("documentChunks")
        .withIndex("by_chunk_id", (q) => q.eq("chunkId", item.chunkId))
        .unique();

      if (!existing) {
        throw new Error(`Chunk ${item.chunkId} was not stored before embedding.`);
      }

      await ctx.db.patch(existing._id, {
        embedding: item.embedding,
        embeddingModel: item.embeddingModel,
        embeddingDimensions: item.embeddingDimensions,
        embeddedAt: args.embeddedAt,
        updatedAt: args.embeddedAt,
      });
      saved++;
    }

    return saved;
  },
});

export const finishEmbeddingRun = internalMutation({
  args: {
    runId: v.id("embeddingRuns"),
    finishedAt: v.number(),
    embeddedChunks: v.number(),
    message: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.runId, {
      status: "succeeded",
      finishedAt: args.finishedAt,
      embeddedChunks: args.embeddedChunks,
      message: args.message,
    });

    return null;
  },
});

export const failEmbeddingRun = internalMutation({
  args: {
    runId: v.id("embeddingRuns"),
    finishedAt: v.number(),
    message: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.runId, {
      status: "failed",
      finishedAt: args.finishedAt,
      message: args.message,
    });

    return null;
  },
});
