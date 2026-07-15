const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 500;
const TRANSIENT_NETWORK_CODES = new Set([
  "EAI_AGAIN",
  "ECONNREFUSED",
  "ECONNRESET",
  "ENETDOWN",
  "ENETUNREACH",
  "ENOTFOUND",
  "ETIMEDOUT",
  "UND_ERR_BODY_TIMEOUT",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_SOCKET",
]);

export type ProviderRetryOptions = {
  sleep?: (milliseconds: number) => Promise<void>;
  random?: () => number;
  onRetry?: (event: ProviderRetryEvent) => void;
};

export type ProviderRetryEvent = {
  attempt: number;
  delayMs: number;
  status?: number;
};

export class ProviderRequestError extends Error {
  readonly status: number;
  readonly retryAfterMs?: number;

  constructor(status: number, message: string, retryAfterMs?: number) {
    super(message);
    this.name = "ProviderRequestError";
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

export class TransientNetworkError extends Error {
  constructor(cause: unknown) {
    super("The provider network request failed.", { cause });
    this.name = "TransientNetworkError";
  }
}

export function providerError(
  status: number,
  message: string,
  retryAfterMs?: number,
) {
  return new ProviderRequestError(status, message, retryAfterMs);
}

export function transientNetworkError(cause: unknown) {
  return new TransientNetworkError(cause);
}

export function tagProviderFetchError(error: unknown) {
  if (error instanceof TransientNetworkError) {
    return error;
  }

  if (!(error instanceof TypeError)) {
    return error;
  }

  const code = readErrorCode(error.cause);

  return code && TRANSIENT_NETWORK_CODES.has(code)
    ? transientNetworkError(error)
    : error;
}

export async function withProviderRetry<T>(
  operation: () => Promise<T>,
  options: ProviderRetryOptions = {},
): Promise<T> {
  const sleep = options.sleep ?? defaultSleep;
  const random = options.random ?? Math.random;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === MAX_ATTEMPTS || !isTransientProviderError(error)) {
        throw error;
      }

      const delayMs = retryDelayMs(error, attempt, random);
      options.onRetry?.({
        attempt,
        delayMs,
        status:
          error instanceof ProviderRequestError ? error.status : undefined,
      });
      await sleep(delayMs);
    }
  }

  throw new Error("Provider retry loop ended without a result.");
}

export function parseRetryAfter(
  value: string | null,
  now = Date.now(),
): number | undefined {
  if (!value) {
    return undefined;
  }

  const seconds = Number(value);

  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.round(seconds * 1000);
  }

  const retryAt = Date.parse(value);

  if (Number.isNaN(retryAt)) {
    return undefined;
  }

  return Math.max(0, retryAt - now);
}

export function isTransientProviderError(error: unknown) {
  if (error instanceof TransientNetworkError) {
    return true;
  }

  if (error instanceof ProviderRequestError) {
    return (
      error.status === 408 ||
      error.status === 429 ||
      (error.status >= 500 && error.status <= 599)
    );
  }

  if (typeof error !== "object" || error === null || !("name" in error)) {
    return false;
  }

  return error.name === "AbortError" || error.name === "TimeoutError";
}

function readErrorCode(value: unknown) {
  if (typeof value !== "object" || value === null || !("code" in value)) {
    return undefined;
  }

  return typeof value.code === "string" ? value.code : undefined;
}

function retryDelayMs(
  error: unknown,
  attempt: number,
  random: () => number,
) {
  if (
    error instanceof ProviderRequestError &&
    error.retryAfterMs !== undefined
  ) {
    return error.retryAfterMs;
  }

  const exponentialDelay = BASE_DELAY_MS * 2 ** (attempt - 1);
  const jitterMultiplier = 0.5 + random();

  return Math.max(0, Math.round(exponentialDelay * jitterMultiplier));
}

function defaultSleep(milliseconds: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
