import { v } from "convex/values";

import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireActor, requireRole } from "./auth";
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
  textHash: v.string(),
  chunkerVersion: v.string(),
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

    const actor = await requireActor(ctx);
    requireRole(actor, ["knowledge_manager", "operator"]);
    const startedAt = Date.now();
    let runId: Id<"embeddingRuns"> | undefined;
    let versionId: Id<"corpusVersions"> | undefined;

    try {
      const config = readEmbeddingConfig();
      const chunkerVersion = args.chunks[0]?.chunkerVersion;
      if (
        !chunkerVersion ||
        args.chunks.some((chunk) => chunk.chunkerVersion !== chunkerVersion)
      ) {
        throw new Error("The corpus contains incompatible chunker versions.");
      }
      versionId = await ctx.runMutation(internal.corpusVersions.createVersion, {
        createdBy: actor.subject,
        createdAt: startedAt,
        documentCount: args.documents.length,
        chunkCount: args.chunks.length,
        embeddingModel: config.deployment,
        embeddingDimensions: EMBEDDING_DIMENSIONS,
        chunkerVersion,
      });
      runId = await ctx.runMutation(internal.ragStorage.startEmbeddingRun, {
        corpusVersionId: versionId,
        documents: args.documents.length,
        chunks: args.chunks.length,
        startedAt,
      });
      const reusable: Array<{ chunkId: string; embedding: number[] }> =
        await ctx.runQuery(internal.corpusVersions.findReusableEmbeddings, {
          chunks: args.chunks.map((chunk) => ({
            chunkId: chunk.chunkId,
            textHash: chunk.textHash,
          })),
          chunkerVersion,
          embeddingModel: config.deployment,
          embeddingDimensions: EMBEDDING_DIMENSIONS,
        });
      const reusableByChunkId = new Map(
        reusable.map((item) => [item.chunkId, item.embedding]),
      );
      const missingChunks = args.chunks.filter(
        (chunk) => !reusableByChunkId.has(chunk.chunkId),
      );
      let retryCount = 0;
      const vectors = await requestEmbeddings(
        config,
        missingChunks.map((chunk) => chunk.text),
        {
          onRetry: () => {
            retryCount += 1;
          },
        },
      );

      if (vectors.length !== missingChunks.length) {
        throw new Error(
          `Expected ${missingChunks.length} embeddings but received ${vectors.length}.`,
        );
      }
      const generatedByChunkId = new Map<string, number[]>();
      vectors.forEach((embedding, index) => {
        if (embedding.length !== EMBEDDING_DIMENSIONS) {
          throw new Error(
            `Chunk ${missingChunks[index].chunkId} returned ${embedding.length} dimensions; expected ${EMBEDDING_DIMENSIONS}.`,
          );
        }
        generatedByChunkId.set(missingChunks[index].chunkId, embedding);
      });
      const readyChunks = args.chunks.map((chunk) => {
        const embedding =
          reusableByChunkId.get(chunk.chunkId) ??
          generatedByChunkId.get(chunk.chunkId);
        if (!embedding) throw new Error(`Chunk ${chunk.chunkId} has no embedding.`);
        return {
          ...chunk,
          embedding,
          embeddingModel: config.deployment,
          embeddingDimensions: EMBEDDING_DIMENSIONS,
        };
      });
      const readyAt = Date.now();
      await ctx.runMutation(internal.corpusVersions.storeReadyVersion, {
        versionId,
        documents: args.documents,
        chunks: readyChunks,
        reusedChunkCount: reusable.length,
        readyAt,
      });
      const embeddedChunks = readyChunks.length;
      const message = `Prepared ${embeddedChunks} chunks with ${reusable.length} reused vectors. Promote the ready corpus to activate it.`;

      await ctx.runMutation(internal.ragStorage.finishEmbeddingRun, {
        runId,
        finishedAt: Date.now(),
        embeddedChunks,
        message,
      });
      await ctx.runMutation(internal.operations.recordOperation, {
        requestId: `embedding:${versionId}`,
        actorSubject: actor.subject,
        operationType: "embedding",
        status: "succeeded",
        corpusVersion: versionId,
        modelIdentifiers: { embeddingModel: config.deployment },
        timings: {
          startedAt,
          finishedAt: Date.now(),
          durationMs: Date.now() - startedAt,
          embeddingMs: Date.now() - startedAt,
        },
        retryCount,
      }).catch((error) => {
        console.error("Failed to record the embedding operation:", error);
      });

      return {
        storedDocuments: args.documents.length,
        storedChunks: args.chunks.length,
        embeddedChunks,
        message,
      };
    } catch (error) {
      const message = toSafeErrorMessage(error);
      if (versionId) {
        await ctx.runMutation(internal.corpusVersions.failVersion, {
          versionId,
          failedAt: Date.now(),
          errorCode: embeddingErrorCode(message),
        });
      }
      if (runId) {
        await ctx.runMutation(internal.ragStorage.failEmbeddingRun, {
          runId,
          finishedAt: Date.now(),
          message,
        });
      }
      await ctx.runMutation(internal.operations.recordOperation, {
        requestId: `embedding:${versionId ?? startedAt}`,
        actorSubject: actor.subject,
        operationType: "embedding",
        status: "failed",
        corpusVersion: versionId,
        modelIdentifiers: {},
        timings: {
          startedAt,
          finishedAt: Date.now(),
          durationMs: Date.now() - startedAt,
        },
        retryCount: 0,
        errorCode: embeddingErrorCode(message),
      }).catch((operationError) => {
        console.error("Failed to record the embedding failure:", operationError);
      });
      throw new Error(message);
    }
  },
});

function embeddingErrorCode(message: string) {
  if (message.includes("rate limited")) return "RATE_LIMITED" as const;
  if (message.includes("temporarily unavailable")) {
    return "PROVIDER_TEMPORARY" as const;
  }
  if (message.includes("invalid response")) {
    return "INVALID_MODEL_RESPONSE" as const;
  }
  return "INTERNAL_ERROR" as const;
}
