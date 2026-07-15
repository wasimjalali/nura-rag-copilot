import {
  isTransientProviderError,
  parseRetryAfter,
  ProviderRequestError,
  providerError,
  tagProviderFetchError,
  withProviderRetry,
  type ProviderRetryOptions,
} from "./providerRetry";

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

// Foundry caps how many inputs one embeddings request accepts, so send the
// inputs in fixed-size batches and concatenate the results in input order.
const EMBEDDING_BATCH_SIZE = 96;
const EMBEDDING_TIMEOUT_MS = 60000;

export async function requestEmbeddings(
  config: EmbeddingConfig,
  input: string[],
  retryOptions?: ProviderRetryOptions,
) {
  if (input.length === 0) {
    return [];
  }

  const vectors: number[][] = [];

  for (let start = 0; start < input.length; start += EMBEDDING_BATCH_SIZE) {
    const batch = input.slice(start, start + EMBEDDING_BATCH_SIZE);
    const batchVectors = await requestEmbeddingBatch(
      config,
      batch,
      retryOptions,
    );

    // A short or padded batch would silently misalign every downstream
    // chunk-to-vector pairing, so fail loud if the count does not match.
    if (batchVectors.length !== batch.length) {
      throw new Error(
        `Embedding batch returned ${batchVectors.length} vectors for ${batch.length} inputs.`,
      );
    }

    vectors.push(...batchVectors);
  }

  return vectors;
}

async function requestEmbeddingBatch(
  config: EmbeddingConfig,
  input: string[],
  retryOptions?: ProviderRetryOptions,
) {
  const body = await withProviderRetry(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), EMBEDDING_TIMEOUT_MS);

    try {
      let response: Response;

      try {
        response = await fetch(toEmbeddingsUrl(config.endpoint), {
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
          signal: controller.signal,
        });
      } catch (error) {
        throw tagProviderFetchError(error);
      }

      const responseBody = (await response
        .json()
        .catch(() => ({}))) as EmbeddingResponse;

      if (!response.ok) {
        throw providerError(
          response.status,
          responseBody.error?.message ??
            `Embedding request failed with status ${response.status}.`,
          parseRetryAfter(response.headers?.get("retry-after") ?? null),
        );
      }

      return responseBody;
    } finally {
      clearTimeout(timeout);
    }
  }, retryOptions);

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
  if (error instanceof ProviderRequestError) {
    if (error.status === 429) {
      return "The model service is rate limited. Try again shortly.";
    }

    if (error.status === 408 || error.status >= 500) {
      return "The model service is temporarily unavailable. Try again.";
    }

    return "The model request was rejected.";
  }

  if (isTransientProviderError(error)) {
    return "The model service is temporarily unavailable. Try again.";
  }

  if (
    error instanceof Error &&
    (error.message.startsWith("Set AZURE_OPENAI_") ||
      error.message.includes("before generating"))
  ) {
    return "The model connection is not configured.";
  }

  if (
    error instanceof Error &&
    (error.message.includes("response did not include") ||
      error.message.includes("response included") ||
      error.message.includes("batch returned"))
  ) {
    return "The model returned an invalid response.";
  }

  return "The model request failed.";
}
