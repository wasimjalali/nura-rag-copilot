"use client";

import { useMemo, useState } from "react";

import { CheckIcon, CloseIcon } from "@/components/icons";
import { StatusLabel } from "@/components/ui/status-label";
import {
  MANUAL_EVAL_SET,
  type EvalCaseResult,
  type EvalCategory,
  type EvalRunResult,
} from "@/lib/eval/manual-eval-set";

export type EvaluationWorkspaceProps = {
  initialRun: EvalRunResult | null;
  history: EvalRunResult[];
  runAction: () => Promise<EvalRunResult>;
  runLabel?: string;
};

type EvaluationCase = {
  id: string;
  question: string;
  expectation: string;
  category: EvalCategory;
  result?: EvalCaseResult;
};

export function EvaluationsWorkspace({
  history,
  initialRun,
  runLabel = "Run evaluations",
  runAction,
}: EvaluationWorkspaceProps) {
  const [activeRun, setActiveRun] = useState<EvalRunResult | null>(initialRun);
  const [localHistory, setLocalHistory] = useState(history);
  const [category, setCategory] = useState<"all" | EvalCategory>("all");
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableRuns = useMemo(() => {
    const runs = [activeRun, ...localHistory].filter(
      (run): run is EvalRunResult => run !== null,
    );
    return Array.from(new Map(runs.map((run) => [run.ranAt, run])).values());
  }, [activeRun, localHistory]);

  const cases = useMemo(() => {
    const resultById = new Map(
      activeRun?.results.map((result) => [result.id, result]) ?? [],
    );
    return MANUAL_EVAL_SET.map((item) => ({
      id: item.id,
      question: item.question,
      expectation: item.expectation,
      category: item.category,
      result: resultById.get(item.id),
    }));
  }, [activeRun]);

  const visibleCases = cases.filter(
    (item) => category === "all" || item.category === category,
  );

  async function handleRun() {
    setError(null);
    setIsRunning(true);
    try {
      const nextRun = await runAction();
      setActiveRun(nextRun);
      setLocalHistory((current) => {
        const currentRun = activeRun ? [activeRun, ...current] : current;
        return Array.from(
          new Map(currentRun.map((run) => [run.ranAt, run])).values(),
        );
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The eval run failed.");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.01em] text-ink">
            Evaluations
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            Run the live RAG loop against the manual battery and inspect the evidence behind every result.
          </p>
        </div>
        <button
          className="btn btn-primary min-h-10 shrink-0 px-3.5 text-sm"
          disabled={isRunning}
          onClick={handleRun}
          type="button"
        >
          <CheckIcon className="size-4" />
          {isRunning ? "Running" : runLabel}
        </button>
      </header>

      {isRunning ? (
        <p className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink-muted" role="status">
          Running {MANUAL_EVAL_SET.length} checks. The previous completed result stays visible until this run finishes.
        </p>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-danger/25 bg-danger-soft px-4 py-3 text-sm font-medium text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <section aria-labelledby="latest-evaluation-heading" className="rounded-xl border border-border bg-surface p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-ink" id="latest-evaluation-heading">
              Latest completed run
            </h2>
            {activeRun ? (
              <p className="mt-1 text-sm text-ink-muted">
                Completed {formatRunTimestamp(activeRun.ranAt)}.
              </p>
            ) : (
              <p className="mt-1 text-sm text-ink-muted">
                No run yet. Results will reflect the current corpus and model.
              </p>
            )}
          </div>
          {activeRun ? <RunSummary run={activeRun} /> : null}
        </div>
        {availableRuns.length > 1 ? (
          <label className="mt-4 flex max-w-xs flex-col gap-1.5 text-[13px] font-medium text-ink-muted">
            View a completed run
            <select
              className="field-input min-h-10 px-3 text-sm text-ink outline-none"
              onChange={(event) => {
                const nextRun = availableRuns.find(
                  (run) => run.ranAt === event.target.value,
                );
                if (nextRun) {
                  setActiveRun(nextRun);
                }
              }}
              value={activeRun?.ranAt ?? ""}
            >
              {availableRuns.map((run) => (
                <option key={run.ranAt} value={run.ranAt}>
                  {formatRunTimestamp(run.ranAt)} ({run.passed}/{run.total})
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </section>

      <section aria-labelledby="evaluation-cases-heading" className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-ink" id="evaluation-cases-heading">
              Evaluation cases
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              <span className="tnum">{visibleCases.length}</span> of {" "}
              <span className="tnum">{MANUAL_EVAL_SET.length}</span> checks shown.
            </p>
          </div>
          <label className="flex min-w-48 flex-col gap-1.5 text-[13px] font-medium text-ink-muted">
            Filter evaluation cases
            <select
              className="field-input min-h-10 px-3 text-sm text-ink outline-none"
              onChange={(event) =>
                setCategory(event.target.value as "all" | EvalCategory)
              }
              value={category}
            >
              <option value="all">All categories</option>
              {evaluationCategories.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="hidden overflow-hidden rounded-xl border border-border bg-surface md:block">
          <table aria-label="Evaluation cases" className="operational-table w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-border bg-sunken text-xs font-medium text-ink-muted">
                <th className="px-4 py-3" scope="col">Case</th>
                <th className="px-4 py-3" scope="col">Category</th>
                <th className="px-4 py-3" scope="col">Result</th>
                <th className="px-4 py-3" scope="col">Evidence</th>
              </tr>
            </thead>
            <tbody>
              {visibleCases.map((item) => (
                <EvaluationTableRow item={item} key={item.id} />
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 md:hidden">
          {visibleCases.map((item) => (
            <EvaluationMobileRow item={item} key={item.id} />
          ))}
        </div>
      </section>
    </div>
  );
}

const evaluationCategories: EvalCategory[] = [
  "Grounding",
  "Guardrail",
  "Visibility",
  "Retrieval",
];

function RunSummary({ run }: { run: EvalRunResult }) {
  const allPassed = run.passed === run.total;
  return (
    <div>
      <span className={allPassed ? "tnum text-2xl font-semibold text-success" : "tnum text-2xl font-semibold text-ink"}>
        {run.passed}/{run.total} checks passed
      </span>
    </div>
  );
}

function EvaluationTableRow({ item }: { item: EvaluationCase }) {
  return (
    <tr className="border-b border-border last:border-b-0">
      <td className="max-w-xl px-4 py-3.5 align-top">
        <p className="text-sm font-semibold text-ink">{item.question}</p>
        <p className="mt-1 text-sm text-ink-muted">{item.expectation}</p>
      </td>
      <td className="px-4 py-3.5 align-top">
        <CategoryLabel category={item.category} />
      </td>
      <td className="px-4 py-3.5 align-top">
        <ResultLabel result={item.result} />
      </td>
      <td className="max-w-64 px-4 py-3.5 align-top">
        <EvidenceSummary result={item.result} />
      </td>
    </tr>
  );
}

function EvaluationMobileRow({ item }: { item: EvaluationCase }) {
  return (
    <article className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-ink">{item.question}</p>
        <ResultLabel result={item.result} />
      </div>
      <p className="mt-2 text-sm leading-6 text-ink-muted">{item.expectation}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <CategoryLabel category={item.category} />
        <EvidenceSummary result={item.result} />
      </div>
    </article>
  );
}

function CategoryLabel({ category }: { category: EvalCategory }) {
  return <StatusLabel tone={category === "Guardrail" ? "warning" : "neutral"}>{category}</StatusLabel>;
}

function ResultLabel({ result }: { result?: EvalCaseResult }) {
  if (result?.status === "pass") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-success">
        <CheckIcon className="size-4" />
        Passed
      </span>
    );
  }
  if (result?.status === "fail") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-danger">
        <CloseIcon className="size-4" />
        Failed
      </span>
    );
  }
  return <span className="text-xs font-medium text-ink-faint">Not run</span>;
}

function EvidenceSummary({ result }: { result?: EvalCaseResult }) {
  if (!result) {
    return <span className="text-xs text-ink-faint">No run data</span>;
  }
  return (
    <div className="flex flex-col gap-1 text-xs text-ink-muted">
      <span>{result.detail}</span>
      {result.citedSources.length > 0 ? (
        <span className="font-mono text-[11px] text-ink-faint">
          {result.citedSources.join(", ")}
        </span>
      ) : null}
    </div>
  );
}

function formatRunTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
