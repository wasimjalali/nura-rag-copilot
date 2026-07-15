import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  sourceDocuments: defineTable({
    source: v.string(),
    title: v.string(),
    textHash: v.string(),
    wordCount: v.number(),
    updatedAt: v.number(),
  }).index("by_source", ["source"]),

  documentChunks: defineTable({
    chunkId: v.string(),
    source: v.string(),
    section: v.string(),
    text: v.string(),
    tokenEstimate: v.number(),
    embedding: v.optional(v.array(v.float64())),
    embeddingModel: v.optional(v.string()),
    embeddingDimensions: v.optional(v.number()),
    embeddedAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_chunk_id", ["chunkId"])
    .index("by_source", ["source"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1536,
    }),

  embeddingRuns: defineTable({
    status: v.union(
      v.literal("running"),
      v.literal("succeeded"),
      v.literal("failed"),
    ),
    message: v.optional(v.string()),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    documents: v.number(),
    chunks: v.number(),
    embeddedChunks: v.number(),
  }).index("by_started_at", ["startedAt"]),

  conversations: defineTable({
    ownerSubject: v.string(),
    title: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner_updated", ["ownerSubject", "updatedAt"]),

  messages: defineTable({
    conversationId: v.id("conversations"),
    requestId: v.optional(v.string()),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    answerType: v.optional(
      v.union(v.literal("grounded"), v.literal("insufficient_evidence")),
    ),
    answerModel: v.optional(v.string()),
    embeddingModel: v.optional(v.string()),
    embeddingDimensions: v.optional(v.number()),
    structuredParagraphs: v.optional(
      v.array(
        v.object({
          text: v.string(),
          citations: v.array(v.string()),
        }),
      ),
    ),
    errorCode: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_conversation_created", ["conversationId", "createdAt"])
    .index("by_request_id", ["requestId"]),

  messageEvidence: defineTable({
    messageId: v.id("messages"),
    rank: v.number(),
    score: v.number(),
    chunkId: v.string(),
    source: v.string(),
    section: v.string(),
    text: v.string(),
    tokenEstimate: v.number(),
    citationLabel: v.string(),
  }).index("by_message", ["messageId"]),

  evalRuns: defineTable({
    ownerSubject: v.string(),
    status: v.union(
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("interrupted"),
    ),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    total: v.number(),
    passed: v.number(),
    answerModel: v.optional(v.string()),
    embeddingModel: v.optional(v.string()),
  }).index("by_owner_started", ["ownerSubject", "startedAt"]),

  evalCaseResults: defineTable({
    runId: v.id("evalRuns"),
    caseId: v.string(),
    question: v.string(),
    category: v.union(
      v.literal("Grounding"),
      v.literal("Guardrail"),
      v.literal("Visibility"),
      v.literal("Retrieval"),
    ),
    expectation: v.string(),
    status: v.union(v.literal("pass"), v.literal("fail")),
    answerType: v.string(),
    citedSources: v.array(v.string()),
    detail: v.string(),
    durationMs: v.number(),
  }).index("by_run", ["runId"]),

  operations: defineTable({
    requestId: v.string(),
    actorSubject: v.optional(v.string()),
    operationType: v.union(
      v.literal("answer"),
      v.literal("embedding"),
      v.literal("evaluation"),
    ),
    status: v.union(
      v.literal("running"),
      v.literal("succeeded"),
      v.literal("failed"),
    ),
    corpusVersion: v.optional(v.string()),
    modelIdentifiers: v.object({
      answerModel: v.optional(v.string()),
      embeddingModel: v.optional(v.string()),
    }),
    timings: v.object({
      startedAt: v.number(),
      finishedAt: v.optional(v.number()),
      durationMs: v.optional(v.number()),
      retrievalMs: v.optional(v.number()),
      generationMs: v.optional(v.number()),
      embeddingMs: v.optional(v.number()),
    }),
    retrievalSummary: v.optional(
      v.object({
        resultCount: v.number(),
        topScore: v.optional(v.number()),
        citedChunkCount: v.optional(v.number()),
      }),
    ),
    retryCount: v.number(),
    tokenUsage: v.optional(
      v.object({
        inputTokens: v.optional(v.number()),
        outputTokens: v.optional(v.number()),
        totalTokens: v.optional(v.number()),
      }),
    ),
    errorCode: v.optional(
      v.union(
        v.literal("AUTH_REQUIRED"),
        v.literal("FORBIDDEN"),
        v.literal("RATE_LIMITED"),
        v.literal("CORPUS_NOT_READY"),
        v.literal("PROVIDER_TEMPORARY"),
        v.literal("INVALID_MODEL_RESPONSE"),
        v.literal("VALIDATION_FAILED"),
        v.literal("INTERNAL_ERROR"),
      ),
    ),
    createdAt: v.number(),
  })
    .index("by_request_id", ["requestId"])
    .index("by_created_at", ["createdAt"]),
});
