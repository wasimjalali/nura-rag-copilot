import { v } from "convex/values";

import { internalMutation, mutation } from "./_generated/server";
import { requireActor, requireRole } from "./auth";

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

export function buildEvaluationOperationRecord(input: {
  requestId: string;
  actorSubject: string;
  status: "running" | "succeeded" | "failed";
  startedAt: number;
  finishedAt: number;
  errorCode?:
    | "AUTH_REQUIRED"
    | "FORBIDDEN"
    | "RATE_LIMITED"
    | "CORPUS_NOT_READY"
    | "PROVIDER_TEMPORARY"
    | "INVALID_MODEL_RESPONSE"
    | "VALIDATION_FAILED"
    | "INTERNAL_ERROR";
}) {
  return {
    requestId: input.requestId,
    actorSubject: input.actorSubject,
    operationType: "evaluation" as const,
    status: input.status,
    modelIdentifiers: {},
    timings: {
      startedAt: input.startedAt,
      finishedAt: input.finishedAt,
      durationMs: input.finishedAt - input.startedAt,
    },
    retryCount: 0,
    errorCode: input.errorCode,
    createdAt: input.startedAt,
  };
}

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

export const recordEvaluation = mutation({
  args: {
    requestId: v.string(),
    status: operationStatus,
    startedAt: v.number(),
    finishedAt: v.number(),
    errorCode: v.optional(appErrorCode),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx);
    requireRole(actor, ["knowledge_manager", "operator"]);
    return await ctx.db.insert(
      "operations",
      buildEvaluationOperationRecord({
        ...args,
        actorSubject: actor.subject,
      }),
    );
  },
});
