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
    embedding: v.optional(v.array(v.number())),
    embeddingModel: v.optional(v.string()),
    embeddingDimensions: v.optional(v.number()),
    embeddedAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_chunk_id", ["chunkId"])
    .index("by_source", ["source"]),

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

  projectNotes: defineTable({
    title: v.string(),
    body: v.string(),
    phase: v.string(),
    createdAt: v.number(),
  }).index("by_phase", ["phase"]),
});
