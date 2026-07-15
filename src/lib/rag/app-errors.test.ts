import { describe, expect, it } from "vitest";

import {
  AppError,
  toPublicAppError,
  type PublicAppError,
} from "./app-errors";

describe("public application errors", () => {
  it("preserves the stable code, message and retryable contract", () => {
    const expected = {
      code: "PROVIDER_TEMPORARY",
      message: "The model service is temporarily unavailable.",
      retryable: true,
    } satisfies PublicAppError;

    expect(
      toPublicAppError(
        new AppError(expected.code, expected.message, expected.retryable),
      ),
    ).toEqual(expected);
  });

  it("does not expose an unknown internal error message", () => {
    expect(
      toPublicAppError(new Error("api-key=secret-value"), {
        code: "INTERNAL_ERROR",
        message: "The request could not be completed.",
        retryable: false,
      }),
    ).toEqual({
      code: "INTERNAL_ERROR",
      message: "The request could not be completed.",
      retryable: false,
    });
  });

  it.each([
    [
      "The model service is rate limited. Try again shortly.",
      "RATE_LIMITED",
      true,
    ],
    [
      "The model service is temporarily unavailable. Try again.",
      "PROVIDER_TEMPORARY",
      true,
    ],
    [
      "The model returned an invalid response.",
      "INVALID_MODEL_RESPONSE",
      false,
    ],
    [
      "The model connection is not configured.",
      "INTERNAL_ERROR",
      false,
    ],
    ["The model request was rejected.", "INTERNAL_ERROR", false],
  ] as const)(
    "maps a sanitized provider message to %s",
    (message, code, retryable) => {
      expect(toPublicAppError(new Error(message))).toEqual({
        code,
        message,
        retryable,
      });
    },
  );
});
