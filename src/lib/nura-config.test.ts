import { describe, expect, it } from "vitest";

import { DEFAULT_NURA_CONFIG } from "./nura-config";

describe("DEFAULT_NURA_CONFIG", () => {
  it("defines the client-facing Nura terminology", () => {
    expect(DEFAULT_NURA_CONFIG).toEqual({
      productName: "Nura",
      productSubtitle: "RAG Copilot",
      supportRoleLabel: "Support agent",
      knowledgeLabel: "Knowledge base",
      evaluationsLabel: "Evaluations",
    });
  });
});
