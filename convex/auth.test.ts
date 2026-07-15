import { describe, expect, it } from "vitest";

import { getActorFromIdentity } from "./auth";

describe("getActorFromIdentity", () => {
  it("rejects anonymous users when development access is disabled", () => {
    expect(() => getActorFromIdentity(null, false)).toThrow("AUTH_REQUIRED");
  });

  it("creates the explicit development operator only when enabled", () => {
    expect(getActorFromIdentity(null, true)).toEqual({
      subject: "development-user",
      role: "operator",
      isDevelopment: true,
    });
  });

  it("normalizes unknown production roles to agent", () => {
    expect(
      getActorFromIdentity({ subject: "user-1", role: "unknown" }, false),
    ).toEqual({ subject: "user-1", role: "agent", isDevelopment: false });
  });
});
