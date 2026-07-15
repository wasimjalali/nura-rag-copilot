import { v } from "convex/values";

import { internalMutation, query } from "./_generated/server";
import { requireActor } from "./auth";

type StorageStatus = {
  storedDocuments: number;
  storedChunks: number;
  embeddedChunks: number;
  lastRunStatus: "not_started" | "running" | "succeeded" | "failed";
  lastRunMessage: string | null;
  lastEmbeddedAt: number | null;
  activeVersionId: string | null;
  readyVersionId: string | null;
  corpusStatus: "legacy" | "not_started" | "processing" | "ready" | "active" | "failed";
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
  embedding: v.array(v.float64()),
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
    activeVersionId: nullableString,
    readyVersionId: nullableString,
    corpusStatus: v.union(
      v.literal("legacy"),
      v.literal("not_started"),
      v.literal("processing"),
      v.literal("ready"),
      v.literal("active"),
      v.literal("failed"),
    ),
  }),
  handler: async (ctx): Promise<StorageStatus> => {
    await requireActor(ctx);
    const corpus = await ctx.db
      .query("corpora")
      .withIndex("by_name", (q) => q.eq("name", "default"))
      .unique();
    const versions = corpus
      ? await ctx.db
          .query("corpusVersions")
          .withIndex("by_corpus_created", (q) => q.eq("corpusId", corpus._id))
          .order("desc")
          .collect()
      : [];
    const readyVersion = versions.find((version) => version.status === "ready");
    const latestVersion = versions[0];
    const allDocuments = await ctx.db.query("sourceDocuments").collect();
    const allChunks = await ctx.db.query("documentChunks").collect();
    const documents = corpus?.activeVersionId
      ? allDocuments.filter(
          (document) => document.corpusVersionId === corpus.activeVersionId,
        )
      : allDocuments.filter((document) => document.corpusVersionId === undefined);
    const chunks = corpus?.activeVersionId
      ? allChunks.filter((chunk) => chunk.corpusVersionId === corpus.activeVersionId)
      : allChunks.filter((chunk) => chunk.corpusVersionId === undefined);
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
      activeVersionId: corpus?.activeVersionId ?? null,
      readyVersionId: readyVersion?._id ?? null,
      corpusStatus: latestVersion?.status === "processing"
          ? "processing"
          : readyVersion
            ? "ready"
            : corpus?.activeVersionId
              ? "active"
            : latestVersion?.status === "failed"
              ? "failed"
              : chunks.some((chunk) => chunk.embedding !== undefined)
                ? "legacy"
                : "not_started",
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
        // When the chunk text changed, drop the stale embedding so the chunk
        // is marked "needs re-embed" and never carries new text with an old
        // vector. Leave the embedding intact when the text is unchanged.
        const textChanged = existing.text !== chunk.text;

        await ctx.db.patch(existing._id, {
          source: chunk.source,
          section: chunk.section,
          text: chunk.text,
          tokenEstimate: chunk.tokenEstimate,
          updatedAt: args.now,
          ...(textChanged
            ? {
                embedding: undefined,
                embeddingModel: undefined,
                embeddingDimensions: undefined,
                embeddedAt: undefined,
              }
            : {}),
        });
      } else {
        await ctx.db.insert("documentChunks", {
          ...chunk,
          updatedAt: args.now,
        });
      }
    }

    // Full reconcile. embedReviewedChunks always receives the complete current
    // corpus, so storage must match it exactly: delete any stored chunk whose
    // chunkId is not in the incoming set (covers a shrunken document and a
    // document removed entirely) and any sourceDocuments row no longer present.
    // Runs in the same mutation so it is transactional with the upserts above.
    const incomingChunkIds = new Set(args.chunks.map((chunk) => chunk.chunkId));
    const storedChunks = await ctx.db.query("documentChunks").collect();

    for (const storedChunk of storedChunks) {
      if (!incomingChunkIds.has(storedChunk.chunkId)) {
        await ctx.db.delete(storedChunk._id);
      }
    }

    const incomingSources = new Set(
      args.documents.map((document) => document.source),
    );
    const storedDocuments = await ctx.db.query("sourceDocuments").collect();

    for (const storedDocument of storedDocuments) {
      if (!incomingSources.has(storedDocument.source)) {
        await ctx.db.delete(storedDocument._id);
      }
    }

    return {
      storedDocuments: args.documents.length,
      storedChunks: args.chunks.length,
    };
  },
});

// A run older than this window is treated as stale/crashed, so a new run may
// start even if the previous one is still marked "running".
const EMBEDDING_RUN_STALENESS_MS = 10 * 60 * 1000;

export const startEmbeddingRun = internalMutation({
  args: {
    corpusVersionId: v.optional(v.id("corpusVersions")),
    documents: v.number(),
    chunks: v.number(),
    startedAt: v.number(),
  },
  returns: v.id("embeddingRuns"),
  handler: async (ctx, args) => {
    const latestRun = await ctx.db
      .query("embeddingRuns")
      .withIndex("by_started_at")
      .order("desc")
      .first();

    if (
      latestRun?.status === "running" &&
      args.startedAt - latestRun.startedAt < EMBEDDING_RUN_STALENESS_MS
    ) {
      throw new Error("An embedding run is already in progress.");
    }

    return await ctx.db.insert("embeddingRuns", {
      corpusVersionId: args.corpusVersionId,
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
