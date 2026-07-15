import {
  parseRetryAfter,
  providerError,
  withProviderRetry,
  type ProviderRetryOptions,
} from "./providerRetry";

export type AnswerConfig = {
  endpoint: string;
  apiKey: string;
  deployment: string;
};

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
  error?: {
    message?: string;
  };
};

export function readAnswerConfig(): AnswerConfig {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT?.trim();
  const apiKey = process.env.AZURE_OPENAI_API_KEY?.trim();
  const deployment = process.env.AZURE_OPENAI_CHAT_DEPLOYMENT?.trim();

  if (!endpoint) {
    throw new Error("Set AZURE_OPENAI_ENDPOINT before generating answers.");
  }

  if (!apiKey) {
    throw new Error("Set AZURE_OPENAI_API_KEY before generating answers.");
  }

  if (!deployment) {
    throw new Error(
      "Set AZURE_OPENAI_CHAT_DEPLOYMENT before generating answers.",
    );
  }

  return {
    endpoint,
    apiKey,
    deployment,
  };
}

const ANSWER_TIMEOUT_MS = 60000;

export async function requestChatCompletion(
  config: AnswerConfig,
  messages: ChatMessage[],
  retryOptions?: ProviderRetryOptions,
) {
  const body = await withProviderRetry(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ANSWER_TIMEOUT_MS);

    try {
      const response = await fetch(toChatCompletionsUrl(config.endpoint), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": config.apiKey,
        },
        body: JSON.stringify({
          model: config.deployment,
          messages,
          temperature: 0.2,
          max_completion_tokens: 500,
        }),
        signal: controller.signal,
      });
      const responseBody = (await response
        .json()
        .catch(() => ({}))) as ChatCompletionResponse;

      if (!response.ok) {
        throw providerError(
          response.status,
          responseBody.error?.message ??
            `Chat completion request failed with status ${response.status}.`,
          parseRetryAfter(response.headers?.get("retry-after") ?? null),
        );
      }

      return responseBody;
    } finally {
      clearTimeout(timeout);
    }
  }, retryOptions);

  const content = body.choices?.[0]?.message?.content;

  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("Chat completion response did not include answer text.");
  }

  return content.trim();
}

export function toChatCompletionsUrl(endpoint: string) {
  return `${endpoint.replace(/\/+$/, "")}/chat/completions`;
}
