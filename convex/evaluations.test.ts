import { describe, expect, it } from "vitest";

import { summarizeEvaluationResults } from "./evaluations";

describe("summarizeEvaluationResults", () => {
  it("counts completed evaluation outcomes", () => {
    expect(
      summarizeEvaluationResults([
        { status: "pass" },
        { status: "fail" },
        { status: "pass" },
      ]),
    ).toEqual({ total: 3, passed: 2, failed: 1 });
  });
});
