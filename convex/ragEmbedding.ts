import { v } from "convex/values";

import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import {
  EMBEDDING_DIMENSIONS,
  readEmbeddingConfig,
  requestEmbeddings,
  toSafeErrorMessage,
} from "./embeddingProvider";

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

type EmbedReviewedChunksResult = {
  storedDocuments: number;
  storedChunks: number;
  embeddedChunks: number;
  message: string;
};

export const embedReviewedChunks = action({
  args: {
    documents: v.array(sourceDocumentInput),
    chunks: v.array(documentChunkInput),
  },
  returns: v.object({
    storedDocuments: v.number(),
    storedChunks: v.number(),
    embeddedChunks: v.number(),
    message: v.string(),
  }),
  handler: async (ctx, args): Promise<EmbedReviewedChunksResult> => {
    // upsertPreviewRecords reconciles storage to exactly match this payload, so
    // an empty payload would delete the whole corpus. That only happens if the
    // document load failed upstream, so refuse loudly instead of wiping data.
    if (args.chunks.length === 0) {
      throw new Error(
        "Refusing to embed an empty corpus. No documents were loaded.",
      );
    }

    const startedAt = Date.now();
    const runId = await ctx.runMutation(internal.ragStorage.startEmbeddingRun, {
      documents: args.documents.length,
      chunks: args.chunks.length,
      startedAt,
    });

    try {
      const config = readEmbeddingConfig();
      const stored: { storedDocuments: number; storedChunks: number } =
        await ctx.runMutation(
          internal.ragStorage.upsertPreviewRecords,
          {
            documents: args.documents,
            chunks: args.chunks,
            now: Date.now(),
          },
        );

      const vectors = await requestEmbeddings(
        config,
        args.chunks.map((chunk) => chunk.text),
      );

      if (vectors.length !== args.chunks.length) {
        throw new Error(
          `Expected ${args.chunks.length} embeddings but received ${vectors.length}.`,
        );
      }

      const embeddings = vectors.map((embedding, index) => {
        if (embedding.length !== EMBEDDING_DIMENSIONS) {
          throw new Error(
            `Chunk ${args.chunks[index].chunkId} returned ${embedding.length} dimensions; expected ${EMBEDDING_DIMENSIONS}.`,
          );
        }

        return {
          chunkId: args.chunks[index].chunkId,
          embedding,
          embeddingModel: config.deployment,
          embeddingDimensions: EMBEDDING_DIMENSIONS,
        };
      });

      const embeddedAt = Date.now();
      const embeddedChunks: number = await ctx.runMutation(
        internal.ragStorage.saveEmbeddings,
        {
          embeddings,
          embeddedAt,
        },
      );
      const message = `Embedded ${embeddedChunks} chunks with ${config.deployment}.`;

      await ctx.runMutation(internal.ragStorage.finishEmbeddingRun, {
        runId,
        finishedAt: Date.now(),
        embeddedChunks,
        message,
      });

      return {
        ...stored,
        embeddedChunks,
        message,
      };
    } catch (error) {
      const message = toSafeErrorMessage(error);
      await ctx.runMutation(internal.ragStorage.failEmbeddingRun, {
        runId,
        finishedAt: Date.now(),
        message,
      });
      throw new Error(message);
    }
  },
});
