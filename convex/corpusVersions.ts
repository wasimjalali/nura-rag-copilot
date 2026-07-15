import { v } from "convex/values";

import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { requireActor, requireRole } from "./auth";

export type ReusableEmbeddingRecord = {
  textHash?: string;
  chunkerVersion?: string;
  embeddingModel?: string;
  embeddingDimensions?: number;
  embedding?: number[];
};

export type EmbeddingReuseTarget = {
  textHash: string;
  chunkerVersion: string;
  embeddingModel: string;
  embeddingDimensions: number;
};

export function canReuseEmbedding(
  existing: ReusableEmbeddingRecord,
  target: EmbeddingReuseTarget,
) {
  return (
    existing.textHash === target.textHash &&
    existing.chunkerVersion === target.chunkerVersion &&
    existing.embeddingModel === target.embeddingModel &&
    existing.embeddingDimensions === target.embeddingDimensions &&
    existing.embedding?.length === target.embeddingDimensions
  );
}

export function resolveActiveVersionAfterBuild(
  activeVersionId: string | null,
  draftStatus: "ready" | "failed",
  draftVersionId: string,
) {
  void draftStatus;
  void draftVersionId;
  return activeVersionId;
}

export function validatePromotionReadiness(
  status: string,
  embeddedChunkCount: number,
  chunkCount: number,
) {
  if (status !== "ready") {
    throw new Error("The corpus version is not ready for promotion.");
  }
  if (embeddedChunkCount !== chunkCount) {
    throw new Error("The corpus version is missing embeddings.");
  }
}

const sourceDocumentInput = v.object({
  source: v.string(),
  title: v.string(),
  textHash: v.string(),
  wordCount: v.number(),
});

const readyChunkInput = v.object({
  chunkId: v.string(),
  source: v.string(),
  section: v.string(),
  text: v.string(),
  textHash: v.string(),
  chunkerVersion: v.string(),
  tokenEstimate: v.number(),
  embedding: v.array(v.float64()),
  embeddingModel: v.string(),
  embeddingDimensions: v.number(),
});

export const createVersion = internalMutation({
  args: {
    createdBy: v.string(),
    createdAt: v.number(),
    documentCount: v.number(),
    chunkCount: v.number(),
    embeddingModel: v.string(),
    embeddingDimensions: v.number(),
    chunkerVersion: v.string(),
  },
  handler: async (ctx, args) => {
    let corpus = await ctx.db
      .query("corpora")
      .withIndex("by_name", (q) => q.eq("name", "default"))
      .unique();
    if (!corpus) {
      const corpusId = await ctx.db.insert("corpora", {
        name: "default",
        createdAt: args.createdAt,
        updatedAt: args.createdAt,
      });
      corpus = await ctx.db.get(corpusId);
    }
    if (!corpus) throw new Error("Could not initialize the corpus.");

    return await ctx.db.insert("corpusVersions", {
      corpusId: corpus._id,
      status: "processing",
      createdBy: args.createdBy,
      createdAt: args.createdAt,
      updatedAt: args.createdAt,
      documentCount: args.documentCount,
      chunkCount: args.chunkCount,
      embeddedChunkCount: 0,
      reusedChunkCount: 0,
      embeddingModel: args.embeddingModel,
      embeddingDimensions: args.embeddingDimensions,
      chunkerVersion: args.chunkerVersion,
    });
  },
});

export const findReusableEmbeddings = internalQuery({
  args: {
    chunks: v.array(
      v.object({ chunkId: v.string(), textHash: v.string() }),
    ),
    chunkerVersion: v.string(),
    embeddingModel: v.string(),
    embeddingDimensions: v.number(),
  },
  handler: async (ctx, args) => {
    const reusable = [];
    for (const chunk of args.chunks) {
      const existing = await ctx.db
        .query("documentChunks")
        .withIndex("by_reuse_key", (q) =>
          q
            .eq("textHash", chunk.textHash)
            .eq("chunkerVersion", args.chunkerVersion)
            .eq("embeddingModel", args.embeddingModel)
            .eq("embeddingDimensions", args.embeddingDimensions),
        )
        .first();
      if (
        existing &&
        canReuseEmbedding(existing, {
          textHash: chunk.textHash,
          chunkerVersion: args.chunkerVersion,
          embeddingModel: args.embeddingModel,
          embeddingDimensions: args.embeddingDimensions,
        })
      ) {
        reusable.push({ chunkId: chunk.chunkId, embedding: existing.embedding! });
      }
    }
    return reusable;
  },
});

export const storeReadyVersion = internalMutation({
  args: {
    versionId: v.id("corpusVersions"),
    documents: v.array(sourceDocumentInput),
    chunks: v.array(readyChunkInput),
    reusedChunkCount: v.number(),
    readyAt: v.number(),
  },
  handler: async (ctx, args) => {
    const version = await ctx.db.get(args.versionId);
    if (!version || version.status !== "processing") {
      throw new Error("The corpus build is no longer processing.");
    }
    if (args.chunks.length !== version.chunkCount) {
      throw new Error("The corpus build is missing chunks.");
    }
    for (const chunk of args.chunks) {
      if (chunk.embedding.length !== version.embeddingDimensions) {
        throw new Error(`Chunk ${chunk.chunkId} has invalid embedding dimensions.`);
      }
    }

    for (const document of args.documents) {
      await ctx.db.insert("sourceDocuments", {
        corpusVersionId: version._id,
        ...document,
        updatedAt: args.readyAt,
      });
    }
    for (const chunk of args.chunks) {
      await ctx.db.insert("documentChunks", {
        corpusVersionId: version._id,
        ...chunk,
        embeddedAt: args.readyAt,
        updatedAt: args.readyAt,
      });
    }
    await ctx.db.patch(version._id, {
      status: "ready",
      readyAt: args.readyAt,
      updatedAt: args.readyAt,
      embeddedChunkCount: args.chunks.length,
      reusedChunkCount: args.reusedChunkCount,
    });
    return null;
  },
});

export const failVersion = internalMutation({
  args: {
    versionId: v.id("corpusVersions"),
    errorCode: v.string(),
    failedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const version = await ctx.db.get(args.versionId);
    if (version && version.status === "processing") {
      await ctx.db.patch(version._id, {
        status: "failed",
        errorCode: args.errorCode,
        updatedAt: args.failedAt,
      });
    }
    return null;
  },
});

export const promoteReady = mutation({
  args: { versionId: v.id("corpusVersions") },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx);
    requireRole(actor, ["knowledge_manager", "operator"]);
    const version = await ctx.db.get(args.versionId);
    if (!version) throw new Error("The corpus version does not exist.");
    const corpus = await ctx.db.get(version.corpusId);
    if (!corpus) throw new Error("The corpus does not exist.");
    if (
      version.status === "active" &&
      corpus.activeVersionId === version._id
    ) {
      return { activeVersionId: version._id };
    }
    validatePromotionReadiness(
      version.status,
      version.embeddedChunkCount,
      version.chunkCount,
    );
    const now = Date.now();
    if (corpus.activeVersionId) {
      const active = await ctx.db.get(corpus.activeVersionId);
      if (active?.status === "active") {
        await ctx.db.patch(active._id, { status: "archived", updatedAt: now });
      }
    }
    const versions = await ctx.db
      .query("corpusVersions")
      .withIndex("by_corpus_created", (q) => q.eq("corpusId", corpus._id))
      .collect();
    for (const other of versions) {
      if (other._id !== version._id && other.status === "ready") {
        await ctx.db.patch(other._id, { status: "archived", updatedAt: now });
      }
    }
    await ctx.db.patch(version._id, {
      status: "active",
      activatedAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(corpus._id, {
      activeVersionId: version._id,
      updatedAt: now,
    });
    return { activeVersionId: version._id };
  },
});

export const getActiveVersion = internalQuery({
  args: {},
  handler: async (ctx) => {
    const corpus = await ctx.db
      .query("corpora")
      .withIndex("by_name", (q) => q.eq("name", "default"))
      .unique();
    return corpus?.activeVersionId ?? null;
  },
});

export const getLifecycle = query({
  args: {},
  handler: async (ctx) => {
    await requireActor(ctx);
    const corpus = await ctx.db
      .query("corpora")
      .withIndex("by_name", (q) => q.eq("name", "default"))
      .unique();
    const latest = corpus
      ? await ctx.db
          .query("corpusVersions")
          .withIndex("by_corpus_created", (q) => q.eq("corpusId", corpus._id))
          .order("desc")
          .first()
      : null;
    const latestReady = corpus
      ? (await ctx.db
          .query("corpusVersions")
          .withIndex("by_corpus_created", (q) => q.eq("corpusId", corpus._id))
          .order("desc")
          .collect())
          .find((version) => version.status === "ready")
      : null;
    return {
      activeVersionId: corpus?.activeVersionId ?? null,
      readyVersionId: latestReady?._id ?? null,
      latestStatus: latest?.status ?? null,
    };
  },
});
