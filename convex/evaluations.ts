import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { requireActor, requireRole } from "./auth";

const evalCategory = v.union(
  v.literal("Grounding"),
  v.literal("Guardrail"),
  v.literal("Visibility"),
  v.literal("Retrieval"),
);

export function summarizeEvaluationResults(results: Array<{ status: "pass" | "fail" }>) {
  const passed = results.filter((result) => result.status === "pass").length;
  return { total: results.length, passed, failed: results.length - passed };
}

export const listRecent = query({
  args: {},
  handler: async (ctx) => {
    const actor = await requireActor(ctx);
    const runs = await ctx.db
      .query("evalRuns")
      .withIndex("by_owner_started", (q) => q.eq("ownerSubject", actor.subject))
      .order("desc")
      .take(20);
    return await Promise.all(
      runs.map(async (run) => ({
        runId: run._id,
        ranAt: new Date(run.finishedAt ?? run.startedAt).toISOString(),
        total: run.total,
        passed: run.passed,
        status: run.status,
        results: (await ctx.db
          .query("evalCaseResults")
          .withIndex("by_run", (q) => q.eq("runId", run._id))
          .collect())
          .sort((left, right) => left.caseId.localeCompare(right.caseId))
          .map((result) => ({
            id: result.caseId,
            question: result.question,
            category: result.category,
            expectation: result.expectation,
            status: result.status,
            answerType: result.answerType,
            citedSources: result.citedSources,
            detail: result.detail,
          })),
      })),
    );
  },
});

export const startRun = mutation({
  args: { total: v.number(), startedAt: v.number() },
  handler: async (ctx, args) => {
    const actor = await requireEvaluationOperator(ctx);
    return await ctx.db.insert("evalRuns", {
      ownerSubject: actor.subject,
      status: "running",
      startedAt: args.startedAt,
      total: args.total,
      passed: 0,
    });
  },
});

export const addCaseResult = mutation({
  args: {
    runId: v.id("evalRuns"), caseId: v.string(), question: v.string(),
    category: evalCategory, expectation: v.string(),
    status: v.union(v.literal("pass"), v.literal("fail")), answerType: v.string(),
    citedSources: v.array(v.string()), detail: v.string(), durationMs: v.number(),
  },
  handler: async (ctx, args) => {
    const actor = await requireEvaluationOperator(ctx);
    const run = await ctx.db.get(args.runId);
    if (!run || run.ownerSubject !== actor.subject) throw new Error("FORBIDDEN");
    await ctx.db.insert("evalCaseResults", args);
    return null;
  },
});

export const finishRun = mutation({
  args: {
    runId: v.id("evalRuns"),
    status: v.union(v.literal("completed"), v.literal("failed"), v.literal("interrupted")),
    passed: v.number(), finishedAt: v.number(),
    answerModel: v.optional(v.string()), embeddingModel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireEvaluationOperator(ctx);
    const run = await ctx.db.get(args.runId);
    if (!run || run.ownerSubject !== actor.subject) throw new Error("FORBIDDEN");
    await ctx.db.patch(args.runId, {
      status: args.status, passed: args.passed, finishedAt: args.finishedAt,
      answerModel: args.answerModel, embeddingModel: args.embeddingModel,
    });
    return null;
  },
});

export async function requireEvaluationOperator(ctx: Parameters<typeof requireActor>[0]) {
  const actor = await requireActor(ctx);
  requireRole(actor, ["knowledge_manager", "operator"]);
  return actor;
}
