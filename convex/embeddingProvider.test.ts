import { afterEach, describe, expect, it, vi } from "vitest";

import {
  EMBEDDING_DIMENSIONS,
  requestEmbeddings,
  toEmbeddingsUrl,
} from "./embeddingProvider";

describe("embedding provider helper", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds the OpenAI-compatible embeddings endpoint", () => {
    expect(toEmbeddingsUrl("https://example.com/openai/v1/")).toBe(
      "https://example.com/openai/v1/embeddings",
    );
  });

  it("requests embeddings and returns vectors in response index order", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { index: 1, embedding: [0.3, 0.4] },
          { index: 0, embedding: [0.1, 0.2] },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const vectors = await requestEmbeddings(
      {
        endpoint: "https://example.com/openai/v1/",
        apiKey: "test-key",
        deployment: "text-embedding-3-small",
      },
      ["first chunk", "second chunk"],
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/openai/v1/embeddings",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": "test-key",
        },
        body: JSON.stringify({
          model: "text-embedding-3-small",
          input: ["first chunk", "second chunk"],
          dimensions: EMBEDDING_DIMENSIONS,
          encoding_format: "float",
        }),
      }),
    );
    expect(vectors).toEqual([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);
  });
});
