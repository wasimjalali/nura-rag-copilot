import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchAction = vi.fn();

vi.mock("convex/nextjs", () => ({
  fetchAction: (...args: unknown[]) => fetchAction(...args),
}));

describe("runEvalsAction", () => {
  beforeEach(() => {
    vi.resetModules();
    fetchAction.mockReset();
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
  });
});
