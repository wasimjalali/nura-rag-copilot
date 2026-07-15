import { describe, expect, it } from "vitest";

import { buildEvaluationOperationRecord } from "./operations";

describe("safe operation records", () => {
  it("stores operational metadata without prompt, source text or credentials", () => {
    const record = buildEvaluationOperationRecord({
      requestId: "evaluation:run-1",
      actorSubject: "operator-1",
      status: "succeeded",
      startedAt: 100,
      finishedAt: 175,
    });
    const serialized = JSON.stringify(record);

    expect(record.timings.durationMs).toBe(75);
    expect(serialized).not.toContain("prompt");
    expect(serialized).not.toContain("documentText");
    expect(serialized).not.toContain("sourceText");
    expect(serialized).not.toContain("apiKey");
  });
});
