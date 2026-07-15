import { describe, expect, it } from "vitest";

import {
  actionFailure,
  actionSuccess,
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
    ["No active corpus is ready for retrieval.", "CORPUS_NOT_READY", false],
    ["An answer is already in progress.", "RATE_LIMITED", true],
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

  it("round-trips action success and failure results through JSON", () => {
    const success = actionSuccess({ answer: "Grounded answer" });
    const failure = actionFailure(
      new AppError(
        "PROVIDER_TEMPORARY",
        "The model service is temporarily unavailable.",
        true,
      ),
    );

    expect(JSON.parse(JSON.stringify(success))).toEqual({
      ok: true,
      data: { answer: "Grounded answer" },
    });
    expect(JSON.parse(JSON.stringify(failure))).toEqual({
      ok: false,
      error: {
        code: "PROVIDER_TEMPORARY",
        message: "The model service is temporarily unavailable.",
        retryable: true,
      },
    });
  });

  it("maps backend authorization markers to safe recovery copy", () => {
    expect(toPublicAppError(new Error("ConvexError: AUTH_REQUIRED"))).toEqual({
      code: "AUTH_REQUIRED",
      message: "Sign in to continue.",
      retryable: false,
    });
    expect(toPublicAppError(new Error("ConvexError: FORBIDDEN"))).toEqual({
      code: "FORBIDDEN",
      message: "You do not have permission to perform this action.",
      retryable: false,
    });
  });
});
