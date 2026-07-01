"use server";

import { fetchAction } from "convex/nextjs";

import { api } from "../../convex/_generated/api";
import {
  MANUAL_EVAL_SET,
  type EvalCaseResult,
  type EvalRunResult,
} from "@/lib/eval/manual-eval-set";
import { evaluateCase, type GroundedAnswerForEval } from "@/lib/eval/run-eval";

/**
 * Runs the full manual eval battery against the live RAG loop. Sequential
 * (not Promise.all) by design: each case triggers a real embedding + chat
 * completion call through Foundry, and running them one at a time avoids
 * hammering the model. A full run is expected to take on the order of ~30s.
 */
export async function runEvalsAction(): Promise<EvalRunResult> {
  const results: EvalCaseResult[] = [];

  for (const evalCase of MANUAL_EVAL_SET) {
    try {
      const answer: GroundedAnswerForEval = await fetchAction(
        api.ragAnswer.generateGroundedAnswer,
        { question: evalCase.question },
      );

      const outcome = evaluateCase(evalCase.assertion, answer);

      results.push({
        id: evalCase.id,
        question: evalCase.question,
        category: evalCase.category,
        expectation: evalCase.expectation,
        status: outcome.status,
        answerType: outcome.answerType,
        citedSources: outcome.citedSources,
        detail: outcome.detail,
      });
    } catch (error) {
      results.push({
        id: evalCase.id,
        question: evalCase.question,
        category: evalCase.category,
        expectation: evalCase.expectation,
        status: "fail",
        answerType: "error",
        citedSources: [],
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    ranAt: new Date().toISOString(),
    total: results.length,
    passed: results.filter((result) => result.status === "pass").length,
    results,
  };
}
