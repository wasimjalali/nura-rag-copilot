import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  projectNotes: defineTable({
    title: v.string(),
    body: v.string(),
    phase: v.string(),
    createdAt: v.number(),
  }).index("by_phase", ["phase"]),
});
