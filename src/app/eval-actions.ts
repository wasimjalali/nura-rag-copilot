"use server";

import { fetchAction, fetchMutation } from "convex/nextjs";

import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  MANUAL_EVAL_SET,
  type EvalCaseResult,
  type EvalRunResult,
} from "@/lib/eval/manual-eval-set";
import { evaluateCase, type GroundedAnswerForEval } from "@/lib/eval/run-eval";
import {
  actionSuccess,
  toPublicAppError,
  type ActionResult,
} from "@/lib/rag/app-errors";

/**
 * Runs the full manual eval battery against the live RAG loop. Sequential
 * (not Promise.all) by design: each case triggers a real embedding + chat
 * completion call through Foundry, and running them one at a time avoids
 * hammering the model. A full run is expected to take on the order of ~30s.
 */
export async function runEvalsAction(): Promise<ActionResult<EvalRunResult>> {
  const results: EvalCaseResult[] = [];
  const startedAt = Date.now();
  let runId: Id<"evalRuns">;

  try {
    runId = await fetchMutation(api.evaluations.startRun, {
      total: MANUAL_EVAL_SET.length,
      startedAt,
    });
  } catch (error) {
    return {
      ok: false,
      error: toPublicAppError(error, {
        code: "INTERNAL_ERROR",
        message: "The evaluation run could not be started.",
        retryable: true,
      }),
    };
  }

  for (const evalCase of MANUAL_EVAL_SET) {
    const caseStartedAt = Date.now();
    try {
      const answer: GroundedAnswerForEval = await fetchAction(
        api.ragAnswer.generateGroundedAnswer,
        {
          question: evalCase.question,
          requestId: `eval:${runId}:${evalCase.id}`,
          persistConversation: false,
        },
      );

      const outcome = evaluateCase(evalCase.assertion, answer);

      const result: EvalCaseResult = {
        id: evalCase.id,
        question: evalCase.question,
        category: evalCase.category,
        expectation: evalCase.expectation,
        status: outcome.status,
        answerType: outcome.answerType,
        citedSources: outcome.citedSources,
        detail: outcome.detail,
      };
      results.push(result);
      await fetchMutation(api.evaluations.addCaseResult, {
        runId,
        caseId: result.id,
        question: result.question,
        category: result.category,
        expectation: result.expectation,
        status: result.status,
        answerType: result.answerType,
        citedSources: result.citedSources,
        detail: result.detail,
        durationMs: Date.now() - caseStartedAt,
      });
    } catch (error) {
      const publicError = toPublicAppError(error, {
        code: "INTERNAL_ERROR",
        message: "The evaluation case could not be completed.",
        retryable: false,
      });

      const result: EvalCaseResult = {
        id: evalCase.id,
        question: evalCase.question,
        category: evalCase.category,
        expectation: evalCase.expectation,
        status: "fail",
        answerType: "error",
        citedSources: [],
        detail: publicError.message,
        error: publicError,
      };
      results.push(result);
      await fetchMutation(api.evaluations.addCaseResult, {
        runId,
        caseId: result.id,
        question: result.question,
        category: result.category,
        expectation: result.expectation,
        status: result.status,
        answerType: result.answerType,
        citedSources: result.citedSources,
        detail: result.detail,
        durationMs: Date.now() - caseStartedAt,
      }).catch(() => undefined);
    }
  }

  const passed = results.filter((result) => result.status === "pass").length;
  const finishedAt = Date.now();
  try {
    await fetchMutation(api.evaluations.finishRun, {
      runId,
      status: "completed",
      passed,
      finishedAt,
    });
    await fetchMutation(api.operations.recordEvaluation, {
      requestId: `evaluation:${runId}`,
      status: "succeeded",
      startedAt,
      finishedAt,
    });
  } catch (error) {
    return {
      ok: false,
      error: toPublicAppError(error, {
        code: "INTERNAL_ERROR",
        message: "The evaluation results could not be saved.",
        retryable: true,
      }),
    };
  }

  return actionSuccess({
    ranAt: new Date(finishedAt).toISOString(),
    total: results.length,
    passed,
    results,
  });
}
