"use server";

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
