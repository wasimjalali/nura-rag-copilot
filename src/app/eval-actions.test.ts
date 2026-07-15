import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchAction = vi.fn();
const fetchMutation = vi.fn();

vi.mock("convex/nextjs", () => ({
  fetchAction: (...args: unknown[]) => fetchAction(...args),
  fetchMutation: (...args: unknown[]) => fetchMutation(...args),
}));

describe("runEvalsAction", () => {
  beforeEach(() => {
    vi.resetModules();
    fetchAction.mockReset();
    fetchMutation.mockReset();
    fetchMutation.mockResolvedValue("run-1");
  });

  it("serializes stable error data for failed evaluation cases", async () => {
    fetchAction.mockRejectedValue(
      new Error("The model service is temporarily unavailable. Try again."),
    );
    const { runEvalsAction } = await import("./eval-actions");

    const result = await runEvalsAction();
    const serialized = JSON.parse(JSON.stringify(result));

    expect(serialized.ok).toBe(true);
    expect(serialized.data.results[0].error).toEqual({
      code: "PROVIDER_TEMPORARY",
      message: "The model service is temporarily unavailable. Try again.",
      retryable: true,
    });
    expect(fetchMutation).toHaveBeenCalled();
  });

  it("interrupts the run when a case result cannot be persisted", async () => {
    fetchAction.mockResolvedValue({
      structuredAnswer: { answerType: "insufficient_evidence", paragraphs: [] },
      retrieval: { results: [] },
    });
    fetchMutation
      .mockResolvedValueOnce("run-1")
      .mockRejectedValueOnce(new Error("database unavailable"))
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    const { runEvalsAction } = await import("./eval-actions");

    const result = await runEvalsAction();

    expect(result).toEqual({
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "The evaluation result could not be saved.",
        retryable: true,
      },
    });
    expect(fetchAction).toHaveBeenCalledTimes(1);
  });
});
