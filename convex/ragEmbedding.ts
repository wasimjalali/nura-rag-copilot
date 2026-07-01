import { v } from "convex/values";

import { internal } from "./_generated/api";
import { action } from "./_generated/server";

const EMBEDDING_DIMENSIONS = 1536;

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

type EmbeddingConfig = {
  endpoint: string;
  apiKey: string;
  deployment: string;
};

function readEmbeddingConfig(): EmbeddingConfig {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT?.trim();
  const apiKey = process.env.AZURE_OPENAI_API_KEY?.trim();
  const deployment = process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT?.trim();

  if (!endpoint) {
    throw new Error("Set AZURE_OPENAI_ENDPOINT before generating embeddings.");
  }

  if (!apiKey) {
    throw new Error("Set AZURE_OPENAI_API_KEY before generating embeddings.");
  }

  if (!deployment) {
    throw new Error(
      "Set AZURE_OPENAI_EMBEDDING_DEPLOYMENT before generating embeddings.",
    );
  }

  return {
    endpoint,
    apiKey,
    deployment,
  };
}

type EmbeddingResponse = {
  data?: Array<{
    index?: number;
    embedding?: unknown;
  }>;
  error?: {
    message?: string;
  };
};

async function requestEmbeddings(config: EmbeddingConfig, input: string[]) {
  if (input.length === 0) {
    return [];
  }

  const response = await fetch(toEmbeddingsUrl(config.endpoint), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": config.apiKey,
    },
    body: JSON.stringify({
      model: config.deployment,
      input,
      dimensions: EMBEDDING_DIMENSIONS,
      encoding_format: "float",
    }),
  });

  const body = (await response.json().catch(() => ({}))) as EmbeddingResponse;

  if (!response.ok) {
    throw new Error(
      body.error?.message ??
        `Embedding request failed with status ${response.status}.`,
    );
  }

  if (!Array.isArray(body.data)) {
    throw new Error("Embedding response did not include a data array.");
  }

  return body.data
    .slice()
    .sort((left, right) => (left.index ?? 0) - (right.index ?? 0))
    .map((item) => {
      if (!Array.isArray(item.embedding)) {
        throw new Error("Embedding response included a missing embedding.");
      }

      return item.embedding.map((value) => {
        if (typeof value !== "number") {
          throw new Error("Embedding response included a non-number value.");
        }
        return value;
      });
    });
}

function toEmbeddingsUrl(endpoint: string) {
  return `${endpoint.replace(/\/+$/, "")}/embeddings`;
}

function toSafeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Embedding generation failed.";
}
