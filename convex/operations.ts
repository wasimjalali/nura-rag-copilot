import { v } from "convex/values";

import { internalMutation } from "./_generated/server";

const operationType = v.union(
  v.literal("answer"),
  v.literal("embedding"),
  v.literal("evaluation"),
);

const operationStatus = v.union(
  v.literal("running"),
  v.literal("succeeded"),
  v.literal("failed"),
);

const appErrorCode = v.union(
  v.literal("AUTH_REQUIRED"),
  v.literal("FORBIDDEN"),
  v.literal("RATE_LIMITED"),
  v.literal("CORPUS_NOT_READY"),
  v.literal("PROVIDER_TEMPORARY"),
  v.literal("INVALID_MODEL_RESPONSE"),
  v.literal("VALIDATION_FAILED"),
  v.literal("INTERNAL_ERROR"),
);

const modelIdentifiers = v.object({
  answerModel: v.optional(v.string()),
  embeddingModel: v.optional(v.string()),
});

const operationTimings = v.object({
  startedAt: v.number(),
  finishedAt: v.optional(v.number()),
  durationMs: v.optional(v.number()),
  retrievalMs: v.optional(v.number()),
  generationMs: v.optional(v.number()),
  embeddingMs: v.optional(v.number()),
});

const retrievalSummary = v.object({
  resultCount: v.number(),
  topScore: v.optional(v.number()),
  citedChunkCount: v.optional(v.number()),
});

const tokenUsage = v.object({
  inputTokens: v.optional(v.number()),
  outputTokens: v.optional(v.number()),
  totalTokens: v.optional(v.number()),
});

export const recordOperation = internalMutation({
  args: {
    requestId: v.string(),
    actorSubject: v.optional(v.string()),
    operationType,
    status: operationStatus,
    corpusVersion: v.optional(v.string()),
    modelIdentifiers,
    timings: operationTimings,
    retrievalSummary: v.optional(retrievalSummary),
    retryCount: v.number(),
    tokenUsage: v.optional(tokenUsage),
    errorCode: v.optional(appErrorCode),
  },
  returns: v.id("operations"),
  handler: async (ctx, args) => {
    return ctx.db.insert("operations", {
      ...args,
      createdAt: args.timings.startedAt,
    });
  },
});
