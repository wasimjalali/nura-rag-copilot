import { describe, expect, it } from "vitest";

import nextConfig from "./next.config";

describe("Next.js local development origins", () => {
  it("allows the 127.0.0.1 handoff URL to load the interactive client", () => {
    expect(nextConfig.allowedDevOrigins).toContain("127.0.0.1");
  });
});
