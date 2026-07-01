import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FoundationOverview } from "./foundation-overview";

describe("FoundationOverview", () => {
  it("shows the foundation learning pipeline", () => {
    render(<FoundationOverview />);

    expect(
      screen.getByRole("heading", { name: "Nura RAG Copilot" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Foundation")).toBeInTheDocument();
    expect(screen.getByText("RAG visibility")).toBeInTheDocument();
    expect(screen.getByText("Retrieval loop")).toBeInTheDocument();
    expect(screen.getByText("Answer loop")).toBeInTheDocument();
    expect(screen.getByText("Manual eval")).toBeInTheDocument();
  });
});
