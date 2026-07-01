"use server";

import { promises as fs } from "node:fs";
import path from "node:path";

import { fetchAction } from "convex/nextjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { api } from "../../convex/_generated/api";
import { chunkDocuments } from "@/lib/rag/chunk";
import { loadSyntheticDocuments } from "@/lib/rag/load-documents";
import {
  toDocumentChunkRecords,
  toSourceDocumentRecords,
} from "@/lib/rag/storage-records";

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

  await fetchAction(api.ragEmbedding.embedReviewedChunks, {
    documents: toSourceDocumentRecords(documents),
    chunks: toDocumentChunkRecords(chunks),
  });

  revalidatePath("/");
}

export async function retrieveSyntheticChunksAction(formData: FormData) {
  const question = String(formData.get("question") ?? "").trim();

  if (!question) {
    redirect("/?retrievalError=empty");
  }

  redirect(`/?question=${encodeURIComponent(question)}`);
}

export async function generateGroundedAnswerAction(formData: FormData) {
  const question = String(formData.get("question") ?? "").trim();

  if (!question) {
    redirect("/?answerError=empty");
  }

  redirect(`/?question=${encodeURIComponent(question)}`);
}

/**
 * Add a synthetic support document. Writes a sanitized markdown file into the
 * synthetic-docs directory so it is picked up on the next load, chunked
 * automatically, and made embeddable. Synthetic documents only.
 */
export async function addSyntheticDocumentAction(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

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
    throw error;
  }

  revalidatePath("/");
}
