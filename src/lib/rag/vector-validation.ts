import { EMBEDDING_DIMENSIONS } from "./embedding-config";

export function validateEmbeddingDimensions(vector: number[]) {
  if (vector.length !== EMBEDDING_DIMENSIONS) {
    return {
      ok: false,
      actualDimensions: vector.length,
      expectedDimensions: EMBEDDING_DIMENSIONS,
      message: `Expected ${EMBEDDING_DIMENSIONS} dimensions but received ${vector.length}.`,
    };
  }

  return {
    ok: true,
    actualDimensions: vector.length,
    expectedDimensions: EMBEDDING_DIMENSIONS,
  };
}
