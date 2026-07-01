const DEFAULT_RETRIEVAL_LIMIT = 5;
const MIN_RETRIEVAL_LIMIT = 1;
const MAX_RETRIEVAL_LIMIT = 10;

export type RetrievalSearchMatch = {
  id: string;
  score: number;
};

export type RetrievalChunkRecord = {
  chunkId: string;
  source: string;
  section: string;
  text: string;
  tokenEstimate: number;
};

export type RetrievalResult = RetrievalChunkRecord & {
  rank: number;
  score: number;
};

export type RetrievalResponse = {
  question: string;
  embeddingModel: string;
  embeddingDimensions: number;
  results: RetrievalResult[];
};

export function validateRetrievalQuestion(question: string) {
  const normalized = question.trim();

  if (normalized.length === 0) {
    throw new Error("Enter a question to retrieve evidence.");
  }

  return normalized;
}

export function clampRetrievalLimit(limit = DEFAULT_RETRIEVAL_LIMIT) {
  if (!Number.isFinite(limit)) {
    return DEFAULT_RETRIEVAL_LIMIT;
  }

  return Math.min(
    MAX_RETRIEVAL_LIMIT,
    Math.max(MIN_RETRIEVAL_LIMIT, Math.trunc(limit)),
  );
}

export function buildRetrievalResults(
  matches: RetrievalSearchMatch[],
  chunksById: Map<string, RetrievalChunkRecord>,
): RetrievalResult[] {
  const results: RetrievalResult[] = [];

  for (const match of matches) {
    const chunk = chunksById.get(match.id);

    if (!chunk) {
      continue;
    }

    results.push({
      rank: results.length + 1,
      score: match.score,
      ...chunk,
    });
  }

  return results;
}

export function formatRetrievalScore(score: number) {
  return score.toFixed(3);
}
