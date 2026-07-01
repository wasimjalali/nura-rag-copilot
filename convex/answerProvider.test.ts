import { afterEach, describe, expect, it, vi } from "vitest";

import {
  requestChatCompletion,
  toChatCompletionsUrl,
  type ChatMessage,
} from "./answerProvider";

describe("answer provider helper", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds the OpenAI-compatible chat completions endpoint", () => {
    expect(toChatCompletionsUrl("https://example.com/openai/v1/")).toBe(
      "https://example.com/openai/v1/chat/completions",
    );
  });

  it("requests a chat completion and returns the assistant text", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: "Opened products can be returned within 30 days. [1]",
            },
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const messages: ChatMessage[] = [
      { role: "system", content: "Answer only from evidence." },
      { role: "user", content: "Question: Can I return an opened product?" },
    ];

    const answer = await requestChatCompletion(
      {
        endpoint: "https://example.com/openai/v1/",
        apiKey: "test-key",
        deployment: "gpt-5.4-mini",
      },
      messages,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/openai/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": "test-key",
        },
        body: JSON.stringify({
          model: "gpt-5.4-mini",
          messages,
          temperature: 0.2,
          max_completion_tokens: 500,
        }),
      }),
    );
    expect(answer).toBe("Opened products can be returned within 30 days. [1]");
  });

  it("rejects a chat response with no assistant text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: "" } }] }),
      }),
    );

    await expect(
      requestChatCompletion(
        {
          endpoint: "https://example.com/openai/v1/",
          apiKey: "test-key",
          deployment: "gpt-5.4-mini",
        },
        [{ role: "user", content: "Question" }],
      ),
    ).rejects.toThrow("Chat completion response did not include answer text.");
  });
});
