import { beforeEach, describe, expect, it, vi } from "vitest";

import { extractUploadedText } from "@/lib/rag/extract-upload";

const writeFile = vi.fn();
const fetchAction = vi.fn();
const revalidatePath = vi.fn();

vi.mock("node:fs", () => {
  const promises = { writeFile: (...args: unknown[]) => writeFile(...args) };
  return { promises, default: { promises } };
});

vi.mock("convex/nextjs", () => ({
  fetchAction: (...args: unknown[]) => fetchAction(...args),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}));

vi.mock("@/lib/rag/load-documents", () => ({
  loadSyntheticDocuments: vi.fn().mockResolvedValue([]),
}));

describe("extractUploadedText", () => {
  it("reads .md files as plain text and derives a title from the filename", async () => {
    const file = new File(["# Hello\n\nWorld"], "return_policy.md", {
      type: "text/markdown",
    });

    const result = await extractUploadedText(file);

    expect(result.title).toBe("return policy");
    expect(result.markdown).toBe("# Hello\n\nWorld");
  });

  it("reads .txt files as plain text", async () => {
    const file = new File(["Plain body text."], "warranty-notes.txt", {
      type: "text/plain",
    });

    const result = await extractUploadedText(file);

    expect(result.title).toBe("warranty notes");
    expect(result.markdown).toBe("Plain body text.");
  });

  it("normalizes separators and casing quirks in the derived title", async () => {
    const file = new File(["content"], "Shipping_And-Returns.MD", {
      type: "text/markdown",
    });

    const result = await extractUploadedText(file);

    expect(result.title).toBe("Shipping And Returns");
  });

  it("rejects unsupported file extensions", async () => {
    const file = new File(["<html></html>"], "notes.html", {
      type: "text/html",
    });

    await expect(extractUploadedText(file)).rejects.toThrow(
      /unsupported file type/i,
    );
  });

  it("rejects files over the max upload size", async () => {
    const bigContent = "a".repeat(5 * 1024 * 1024 + 1);
    const file = new File([bigContent], "large.txt", { type: "text/plain" });

    await expect(extractUploadedText(file)).rejects.toThrow(/too large/i);
  });

  it("rejects files that extract to empty or whitespace-only text", async () => {
    const file = new File(["   \n\n  "], "empty.md", {
      type: "text/markdown",
    });

    await expect(extractUploadedText(file)).rejects.toThrow(
      /did not contain any readable text/i,
    );
  });
});

describe("addSyntheticDocumentAction", () => {
  beforeEach(() => {
    vi.resetModules();
    writeFile.mockReset();
    fetchAction.mockReset();
    revalidatePath.mockReset();
  });

  async function importAction() {
    const mod = await import("./actions");
    return mod.addSyntheticDocumentAction;
  }

  function formDataOf(fields: Record<string, string>) {
    const formData = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      formData.set(key, value);
    }
    return formData;
  }

  it("rejects a title over 120 characters", async () => {
    const addSyntheticDocumentAction = await importAction();
    const formData = formDataOf({
      title: "a".repeat(121),
      body: "Some body text.",
    });

    await expect(addSyntheticDocumentAction(formData)).rejects.toThrow(
      /under 120 characters/i,
    );
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("rejects a body over 50,000 characters", async () => {
    const addSyntheticDocumentAction = await importAction();
    const formData = formDataOf({
      title: "Valid Title",
      body: "a".repeat(50_001),
    });

    await expect(addSyntheticDocumentAction(formData)).rejects.toThrow(
      /under 50,000 characters/i,
    );
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("rejects a title that slugifies to empty (no letters or numbers)", async () => {
    const addSyntheticDocumentAction = await importAction();
    const formData = formDataOf({
      title: "!!! *** ???",
      body: "Some body text.",
    });

    await expect(addSyntheticDocumentAction(formData)).rejects.toThrow(
      /letters or numbers/i,
    );
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("slugifies a normal title and writes within the synthetic-docs directory", async () => {
    writeFile.mockResolvedValue(undefined);
    fetchAction.mockResolvedValue({
      storedDocuments: 1,
      storedChunks: 1,
      embeddedChunks: 1,
      message: "ok",
    });

    const addSyntheticDocumentAction = await importAction();
    const formData = formDataOf({
      title: "Shipping & Returns Policy!",
      body: "Body text describing the policy.",
    });

    await addSyntheticDocumentAction(formData);

    expect(writeFile).toHaveBeenCalledTimes(1);
    const [writtenPath, contents, options] = writeFile.mock.calls[0];
    expect(writtenPath).toMatch(/synthetic-docs[\\/]shipping_returns_policy\.md$/);
    expect(writtenPath).not.toMatch(/\.\./);
    expect(contents).toContain("# Shipping & Returns Policy!");
    expect(options).toEqual({ flag: "wx" });
    expect(fetchAction).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("surfaces a clear error when embedding fails after a successful write", async () => {
    writeFile.mockResolvedValue(undefined);
    fetchAction.mockRejectedValue(new Error("model unreachable"));

    const addSyntheticDocumentAction = await importAction();
    const formData = formDataOf({
      title: "Another Policy",
      body: "Body text describing the policy.",
    });

    await expect(addSyntheticDocumentAction(formData)).rejects.toThrow(
      /added but embedding failed/i,
    );
    expect(writeFile).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("uses the uploaded file's derived title and text when title/body are blank", async () => {
    writeFile.mockResolvedValue(undefined);
    fetchAction.mockResolvedValue({
      storedDocuments: 1,
      storedChunks: 1,
      embeddedChunks: 1,
      message: "ok",
    });

    const addSyntheticDocumentAction = await importAction();
    const formData = new FormData();
    formData.set("title", "");
    formData.set("body", "");
    formData.set(
      "file",
      new File(["Uploaded document body."], "uploaded_policy.md", {
        type: "text/markdown",
      }),
    );

    await addSyntheticDocumentAction(formData);

    expect(writeFile).toHaveBeenCalledTimes(1);
    const [writtenPath, contents] = writeFile.mock.calls[0];
    expect(writtenPath).toMatch(/uploaded_policy\.md$/);
    expect(contents).toContain("# uploaded policy");
    expect(contents).toContain("Uploaded document body.");
  });
});
