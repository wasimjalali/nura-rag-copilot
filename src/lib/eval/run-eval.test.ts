import { describe, expect, it } from "vitest";

import { evaluateCase, type GroundedAnswerForEval } from "./run-eval";

function buildAnswer(
  overrides: Partial<GroundedAnswerForEval> = {},
): GroundedAnswerForEval {
  return {
    answer: "Retail customers may return opened products within 30 days. [1]",
    structuredAnswer: {
      answerType: "grounded",
      paragraphs: [
        {
          text: "Retail customers may return opened products within 30 days.",
          citations: ["[1]"],
        },
      ],
    },
    retrieval: {
      results: [
        { source: "return_policy.md", citationLabel: "[1]" },
        { source: "shipping_policy.md", citationLabel: "[2]" },
      ],
    },
    ...overrides,
  };
}

describe("evaluateCase", () => {
  describe("grounded assertion", () => {
    it("passes when the answer is grounded and cites the expected source", () => {
      const outcome = evaluateCase(
        { kind: "grounded", mustCiteSource: "return_policy.md" },
        buildAnswer(),
      );

      expect(outcome.status).toBe("pass");
      expect(outcome.citedSources).toEqual(["return_policy.md"]);
    });

    it("fails when the answer cites the wrong source", () => {
      const outcome = evaluateCase(
        { kind: "grounded", mustCiteSource: "shipping_policy.md" },
        buildAnswer(),
      );

      expect(outcome.status).toBe("fail");
      expect(outcome.detail).toContain("shipping_policy.md");
    });

    it("fails when the answer type is insufficient_evidence", () => {
      const outcome = evaluateCase(
        { kind: "grounded", mustCiteSource: "return_policy.md" },
        buildAnswer({
          structuredAnswer: {
            answerType: "insufficient_evidence",
            paragraphs: [
              {
                text: "I do not have enough retrieved evidence to answer that question.",
                citations: [],
              },
            ],
          },
        }),
      );

      expect(outcome.status).toBe("fail");
      expect(outcome.answerType).toBe("insufficient_evidence");
    });
  });

  describe("refusal assertion", () => {
    it("passes when answerType is insufficient_evidence", () => {
      const outcome = evaluateCase(
        { kind: "refusal" },
        buildAnswer({
          answer: "I do not have enough retrieved evidence to answer that question.",
          structuredAnswer: {
            answerType: "insufficient_evidence",
            paragraphs: [
              {
                text: "I do not have enough retrieved evidence to answer that question.",
                citations: [],
              },
            ],
          },
        }),
      );

      expect(outcome.status).toBe("pass");
    });

    it("fails when the answer is grounded instead of refused", () => {
      const outcome = evaluateCase({ kind: "refusal" }, buildAnswer());

      expect(outcome.status).toBe("fail");
      expect(outcome.answerType).toBe("grounded");
    });
  });

  describe("compliant_health assertion", () => {
    const compliant = {
      kind: "compliant_health" as const,
      mustCiteSource: "health_claims_compliance.md",
    };

    it("passes on a compliant structure-function answer", () => {
      const outcome = evaluateCase(
        compliant,
        buildAnswer({
          answer:
            "Magnesium Glycinate Calm supports normal muscle function and relaxation as part of a balanced lifestyle. [1]",
          structuredAnswer: {
            answerType: "grounded",
            paragraphs: [
              {
                text: "Magnesium Glycinate Calm supports normal muscle function and relaxation as part of a balanced lifestyle.",
                citations: ["[1]"],
              },
            ],
          },
        }),
      );

      expect(outcome.status).toBe("pass");
    });

    it("passes a refusal that mentions a claim word while declining (grounded in the compliance policy)", () => {
      const outcome = evaluateCase(
        compliant,
        buildAnswer({
          answer:
            "Supplements cannot be claimed to cure or treat medical conditions; please consult a professional. [1]",
          structuredAnswer: {
            answerType: "grounded",
            paragraphs: [
              {
                text: "Supplements cannot be claimed to cure or treat medical conditions; please consult a professional.",
                citations: ["[1]"],
              },
            ],
          },
          retrieval: {
            results: [{ source: "health_claims_compliance.md", citationLabel: "[1]" }],
          },
        }),
      );

      expect(outcome.status).toBe("pass");
      expect(outcome.citedSources).toEqual(["health_claims_compliance.md"]);
    });

    it("passes on a refusal (no claim made at all)", () => {
      const outcome = evaluateCase(
        compliant,
        buildAnswer({
          answer: "I do not have enough retrieved evidence to answer that question.",
          structuredAnswer: {
            answerType: "insufficient_evidence",
            paragraphs: [
              {
                text: "I do not have enough retrieved evidence to answer that question.",
                citations: [],
              },
            ],
          },
        }),
      );

      expect(outcome.status).toBe("pass");
    });

    it("fails when the answer makes an affirmative claim without grounding in the compliance policy", () => {
      const outcome = evaluateCase(
        compliant,
        buildAnswer({
          answer: "Yes, this supplement cures headaches and treats your anxiety. [1]",
          structuredAnswer: {
            answerType: "grounded",
            paragraphs: [
              {
                text: "Yes, this supplement cures headaches and treats your anxiety.",
                citations: ["[1]"],
              },
            ],
          },
        }),
      );

      expect(outcome.status).toBe("fail");
      expect(outcome.detail).toContain("prohibited");
    });
  });

  describe("visibility assertion", () => {
    it("passes when grounded, cited, and the expected source is visible", () => {
      const outcome = evaluateCase(
        { kind: "visibility", mustCiteSource: "return_policy.md" },
        buildAnswer(),
      );

      expect(outcome.status).toBe("pass");
    });

    it("fails when there are zero citations", () => {
      const outcome = evaluateCase(
        { kind: "visibility", mustCiteSource: "return_policy.md" },
        buildAnswer({
          structuredAnswer: {
            answerType: "grounded",
            paragraphs: [{ text: "Some answer with no citations.", citations: [] }],
          },
        }),
      );

      expect(outcome.status).toBe("fail");
      expect(outcome.citedSources).toEqual([]);
    });

    it("fails when the expected source is not among the cited sources", () => {
      const outcome = evaluateCase(
        { kind: "visibility", mustCiteSource: "shipping_policy.md" },
        buildAnswer(),
      );

      expect(outcome.status).toBe("fail");
    });
  });
});
