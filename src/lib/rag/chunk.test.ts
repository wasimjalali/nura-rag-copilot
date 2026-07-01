import { describe, expect, it } from "vitest";

import { chunkDocuments } from "./chunk";
import type { KnowledgeDocument } from "./types";

function doc(overrides: Partial<KnowledgeDocument>): KnowledgeDocument {
  return {
    source: "doc.md",
    title: "Doc",
    text: "",
    ...overrides,
  };
}

describe("chunkDocuments", () => {
  it("does not treat a heading inside a fenced code block as a section boundary", () => {
    const text = [
      "## Setup",
      "Install the package first.",
      "",
      "```",
      "## This is not a heading",
      "npm install nura",
      "```",
      "",
      "Finish the setup after installing.",
    ].join("\n");

    const chunks = chunkDocuments([doc({ source: "setup.md", text })]);
    const sections = new Set(chunks.map((chunk) => chunk.section));

    expect(sections).toEqual(new Set(["Setup"]));
    expect(chunks.some((chunk) => chunk.text.includes("## This is not a heading"))).toBe(
      true,
    );
  });

  it("labels preamble content before the first H2 as (Introduction)", () => {
    const text = [
      "# Title",
      "This is the intro paragraph before any H2 heading.",
      "",
      "## Real Section",
      "Section body text.",
    ].join("\n");

    const chunks = chunkDocuments([doc({ source: "intro.md", text })]);

    expect(chunks[0].section).toBe("(Introduction)");
    expect(chunks.some((chunk) => chunk.section === "Real Section")).toBe(true);
  });

  it("folds source names to a lowercase slug regardless of case", () => {
    const text = "## Section\nSome body text.";

    const chunks = chunkDocuments([doc({ source: "Return-Policy.md", text })]);

    expect(chunks[0].id).toBe("return_policy__chunk_001");
  });

  it("folds README.md style names to lowercase slugs", () => {
    const text = "## Section\nSome body text.";

    const chunks = chunkDocuments([doc({ source: "README.md", text })]);

    expect(chunks[0].id).toBe("readme__chunk_001");
  });

  it("throws when two documents produce the same slug", () => {
    const text = "## Section\nSome body text.";

    expect(() =>
      chunkDocuments([
        doc({ source: "Return-Policy.md", text }),
        doc({ source: "return_policy.md", text }),
      ]),
    ).toThrow(/Duplicate source slug/);
  });

  it("sub-splits a paragraph that exceeds the long-paragraph threshold", () => {
    const longSentence = "This is a fairly long sentence about the policy details.";
    const paragraph = Array.from({ length: 40 }, () => longSentence).join(" ");
    const text = `## Long Section\n${paragraph}`;

    const chunks = chunkDocuments([doc({ source: "long.md", text })]);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.section === "Long Section")).toBe(true);
  });

  it("produces no chunks for an empty or whitespace-only document", () => {
    const chunks = chunkDocuments([doc({ source: "empty.md", text: "   \n\n  " })]);

    expect(chunks).toEqual([]);
  });
});
