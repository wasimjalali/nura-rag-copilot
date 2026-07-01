import type { ChatMessage } from "./answerProvider";

export const INSUFFICIENT_EVIDENCE_ANSWER =
  "I do not have enough retrieved evidence to answer that question.";

export type RetrievalResultForAnswer = {
  rank: number;
  score: number;
  chunkId: string;
  source: string;
  section: string;
  text: string;
  tokenEstimate: number;
};

export type CitedRetrievalResult = RetrievalResultForAnswer & {
  citationLabel: string;
};

export function addCitationLabels(
  results: RetrievalResultForAnswer[],
): CitedRetrievalResult[] {
  return results.map((result) => ({
    ...result,
    citationLabel: `[${result.rank}]`,
  }));
}

export function buildGroundedAnswerMessages(
  question: string,
  evidence: CitedRetrievalResult[],
): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "You are Nura's support copilot.",
        "Answer only from the provided evidence.",
        "Do not invent policies, product facts, numbers, timelines, or exceptions.",
        "If the evidence is insufficient, say that the evidence does not contain enough information.",
        "Include source references using the provided citation labels.",
      ].join(" "),
    },
    {
      role: "user",
      content: [
        "Evidence:",
        formatEvidenceForPrompt(evidence),
        "",
        `Question: ${question}`,
        "Use the evidence above to answer clearly and concisely.",
      ].join("\n"),
    },
  ];
}

export function formatEvidenceForPrompt(evidence: CitedRetrievalResult[]) {
  return evidence
    .map((item) =>
      [
        `${item.citationLabel} ${item.source} > ${item.section}`,
        `Chunk ID: ${item.chunkId}`,
        `Score: ${item.score.toFixed(3)}`,
        `Text: ${item.text}`,
      ].join("\n"),
    )
    .join("\n\n");
}
