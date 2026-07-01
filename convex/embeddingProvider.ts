export const EMBEDDING_DIMENSIONS = 1536;

export type EmbeddingConfig = {
  endpoint: string;
  apiKey: string;
  deployment: string;
};

type EmbeddingResponse = {
  data?: Array<{
    index?: number;
    embedding?: unknown;
  }>;
  error?: {
    message?: string;
  };
};

export function readEmbeddingConfig(): EmbeddingConfig {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT?.trim();
  const apiKey = process.env.AZURE_OPENAI_API_KEY?.trim();
  const deployment = process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT?.trim();

  if (!endpoint) {
    throw new Error("Set AZURE_OPENAI_ENDPOINT before generating embeddings.");
  }

  if (!apiKey) {
    throw new Error("Set AZURE_OPENAI_API_KEY before generating embeddings.");
  }

  if (!deployment) {
    throw new Error(
      "Set AZURE_OPENAI_EMBEDDING_DEPLOYMENT before generating embeddings.",
    );
  }

  return {
    endpoint,
    apiKey,
    deployment,
  };
}

export async function requestEmbeddings(
  config: EmbeddingConfig,
  input: string[],
) {
  if (input.length === 0) {
    return [];
  }

  const response = await fetch(toEmbeddingsUrl(config.endpoint), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": config.apiKey,
    },
    body: JSON.stringify({
      model: config.deployment,
      input,
      dimensions: EMBEDDING_DIMENSIONS,
      encoding_format: "float",
    }),
  });

  const body = (await response.json().catch(() => ({}))) as EmbeddingResponse;

  if (!response.ok) {
    throw new Error(
      body.error?.message ??
        `Embedding request failed with status ${response.status}.`,
    );
  }

  if (!Array.isArray(body.data)) {
    throw new Error("Embedding response did not include a data array.");
  }

  return body.data
    .slice()
    .sort((left, right) => (left.index ?? 0) - (right.index ?? 0))
    .map((item) => {
      if (!Array.isArray(item.embedding)) {
        throw new Error("Embedding response included a missing embedding.");
      }

      return item.embedding.map((value) => {
        if (typeof value !== "number") {
          throw new Error("Embedding response included a non-number value.");
        }
        return value;
      });
    });
}

export function toEmbeddingsUrl(endpoint: string) {
  return `${endpoint.replace(/\/+$/, "")}/embeddings`;
}

export function toSafeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Embedding generation failed.";
}
