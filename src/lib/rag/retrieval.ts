export function formatRetrievalScore(score: number) {
  if (!Number.isFinite(score)) {
    return "n/a";
  }

  return score.toFixed(3);
}
