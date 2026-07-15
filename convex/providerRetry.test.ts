import { describe, expect, it, vi } from "vitest";

import {
  providerError,
  tagProviderFetchError,
  transientNetworkError,
  withProviderRetry,
} from "./providerRetry";

describe("provider retry", () => {
  it("retries transient failures and respects the attempt cap", async () => {
    let attempts = 0;
    const result = await withProviderRetry(
      async () => {
        attempts += 1;
        if (attempts < 3) throw providerError(429, "busy");
        return "ok";
      },
      { sleep: async () => undefined },
    );

    expect(result).toBe("ok");
    expect(attempts).toBe(3);
  });

  it("does not retry authentication failures", async () => {
    let attempts = 0;

    await expect(
      withProviderRetry(
        async () => {
          attempts += 1;
          throw providerError(401, "unauthorized");
        },
        { sleep: async () => undefined },
      ),
    ).rejects.toMatchObject({ status: 401 });
    expect(attempts).toBe(1);
  });

  it.each([408, 429, 500, 503])("retries HTTP %s failures", async (status) => {
    let attempts = 0;

    await expect(
      withProviderRetry(
        async () => {
          attempts += 1;
          throw providerError(status, "temporary");
        },
        { sleep: async () => undefined },
      ),
    ).rejects.toMatchObject({ status });
    expect(attempts).toBe(3);
  });

  it.each([400, 403, 404])("does not retry HTTP %s failures", async (status) => {
    let attempts = 0;

    await expect(
      withProviderRetry(
        async () => {
          attempts += 1;
          throw providerError(status, "not retryable");
        },
        { sleep: async () => undefined },
      ),
    ).rejects.toMatchObject({ status });
    expect(attempts).toBe(1);
  });

  it("does not retry an untagged TypeError", async () => {
    const failure = new TypeError("invalid request options");
    let attempts = 0;

    await expect(
      withProviderRetry(
        async () => {
          attempts += 1;
          throw failure;
        },
        { sleep: async () => undefined },
      ),
    ).rejects.toBe(failure);
    expect(attempts).toBe(1);
  });

  it("retries an explicitly tagged network failure", async () => {
    const failure = transientNetworkError(new TypeError("fetch failed"));
    let attempts = 0;

    await expect(
      withProviderRetry(
        async () => {
          attempts += 1;
          throw failure;
        },
        { sleep: async () => undefined },
      ),
    ).rejects.toBe(failure);
    expect(attempts).toBe(3);
  });

  it("retries request timeouts", async () => {
    const failure = new DOMException("request timed out", "AbortError");
    let attempts = 0;

    await expect(
      withProviderRetry(
        async () => {
          attempts += 1;
          throw failure;
        },
        { sleep: async () => undefined },
      ),
    ).rejects.toBe(failure);
    expect(attempts).toBe(3);
  });

  it("tags only fetch TypeErrors with an explicit network cause", () => {
    const networkFailure = Object.assign(new TypeError("fetch failed"), {
      cause: { code: "ECONNRESET" },
    });
    const invalidUrl = Object.assign(new TypeError("Invalid URL"), {
      cause: { code: "ERR_INVALID_URL" },
    });

    expect(tagProviderFetchError(networkFailure)).toMatchObject({
      name: "TransientNetworkError",
    });
    expect(tagProviderFetchError(invalidUrl)).toBe(invalidUrl);
  });

  it("respects Retry-After before using backoff", async () => {
    const sleep = vi.fn(async () => undefined);
    let attempts = 0;

    await withProviderRetry(
      async () => {
        attempts += 1;
        if (attempts === 1) {
          throw providerError(429, "busy", 2_000);
        }
        return "ok";
      },
      { sleep, random: () => 0 },
    );

    expect(sleep).toHaveBeenCalledWith(2_000);
  });

  it("uses exponential backoff with deterministic jitter", async () => {
    const sleep = vi.fn(async () => undefined);
    let attempts = 0;

    await withProviderRetry(
      async () => {
        attempts += 1;
        if (attempts < 3) {
          throw providerError(500, "temporary");
        }
        return "ok";
      },
      { sleep, random: () => 0 },
    );

    expect(sleep.mock.calls).toEqual([[250], [500]]);
  });

  it("reports each retry for safe operation counting", async () => {
    const onRetry = vi.fn();
    let attempts = 0;

    await withProviderRetry(
      async () => {
        attempts += 1;
        if (attempts === 1) {
          throw providerError(503, "temporary");
        }
        return "ok";
      },
      {
        sleep: async () => undefined,
        random: () => 0,
        onRetry,
      },
    );

    expect(onRetry).toHaveBeenCalledWith({
      attempt: 1,
      delayMs: 250,
      status: 503,
    });
  });
});
