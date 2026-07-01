"use server";

import { promises as fs } from "node:fs";
import path from "node:path";

import { fetchAction } from "convex/nextjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { api } from "../../convex/_generated/api";
import { chunkDocuments } from "@/lib/rag/chunk";
import { extractUploadedText } from "@/lib/rag/extract-upload";
import { loadSyntheticDocuments } from "@/lib/rag/load-documents";
import {
  toDocumentChunkRecords,
  toSourceDocumentRecords,
} from "@/lib/rag/storage-records";

const MAX_QUESTION_LENGTH = 2000;

const SYNTHETIC_DOCS_DIR = path.join(process.cwd(), "content", "synthetic-docs");

// SECURITY: the mutating actions below (embed, add-document) are intentionally
// unauthenticated. This is a local, single-user learning tool where the person
// running it is the only actor. Before ANY multi-user or public deployment,
// gate these behind an auth check: they write files and trigger paid model
// calls, and added documents flow into the RAG prompt as retrieved evidence
// (indirect prompt-injection surface, mitigated in the answer system prompt).

export async function embedSyntheticDocumentsAction() {
  const documents = await loadSyntheticDocuments();
  const chunks = chunkDocuments(documents);

  try {
    await fetchAction(api.ragEmbedding.embedReviewedChunks, {
      documents: toSourceDocumentRecords(documents),
      chunks: toDocumentChunkRecords(chunks),
    });
  } catch (error) {
    // Surface a friendly message to the caller (the Knowledge view catches it
    // and shows it inline) instead of an unhandled server-action rejection.
    // Keep the "already in progress" signal, which is actionable (retry soon),
    // but do not forward raw upstream error text to the client.
    const inProgress =
      error instanceof Error && error.message.includes("already in progress");
    throw new Error(
      inProgress
        ? "An embedding run is already in progress. Try again in a moment."
        : "Embedding failed. Check the model connection and try again.",
    );
  }

  revalidatePath("/");
}

export async function generateGroundedAnswerAction(formData: FormData) {
  const question = String(formData.get("question") ?? "").trim();

  if (!question) {
    redirect("/?answerError=empty");
  }

  if (question.length > MAX_QUESTION_LENGTH) {
    redirect("/?answerError=too_long");
  }

  redirect(`/?question=${encodeURIComponent(question)}`);
}

/**
 * Add a synthetic support document, either pasted (title + body) or uploaded
 * (file). Writes a sanitized markdown file into the synthetic-docs directory,
 * then re-embeds the corpus so the new document is immediately queryable.
 * Synthetic documents only.
 */
export async function addSyntheticDocumentAction(formData: FormData) {
  let title = String(formData.get("title") ?? "").trim();
  let body = String(formData.get("body") ?? "").trim();

  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    const extracted = await extractUploadedText(file);
    title = title || extracted.title;
    body = extracted.markdown.trim();
  }

  if (!title || !body) {
    throw new Error("A title and document text are both required.");
  }

  if (title.length > 120) {
    throw new Error("Keep the title under 120 characters.");
  }

  if (body.length > 50_000) {
    throw new Error("Keep the document under 50,000 characters.");
  }

  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);

  if (!slug) {
    throw new Error("Use a title that contains letters or numbers.");
  }

  const filePath = path.resolve(SYNTHETIC_DOCS_DIR, `${slug}.md`);

  if (!filePath.startsWith(path.resolve(SYNTHETIC_DOCS_DIR) + path.sep)) {
    throw new Error("That title is not a valid document name.");
  }

  const markdown = body.startsWith("# ") ? body : `# ${title}\n\n${body}`;

  try {
    await fs.writeFile(filePath, `${markdown}\n`, { flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error("A document with a similar title already exists.");
    }
    // Do not forward the raw fs error (it includes the absolute file path).
    throw new Error("Could not save the document. Please try again.");
  }

  try {
    const documents = await loadSyntheticDocuments();
    const chunks = chunkDocuments(documents);

    await fetchAction(api.ragEmbedding.embedReviewedChunks, {
      documents: toSourceDocumentRecords(documents),
      chunks: toDocumentChunkRecords(chunks),
    });
  } catch {
    revalidatePath("/");
    throw new Error(
      "The document was added but embedding failed. Store and embed the corpus again from the Knowledge view.",
    );
  }

  revalidatePath("/");
}
