import { fetchQuery } from "convex/nextjs";

import { RagVisibilityDashboard } from "@/components/rag-visibility-dashboard";
import { api } from "../../convex/_generated/api";
import {
  addSyntheticDocumentAction,
  askGroundedQuestion,
  embedSyntheticDocumentsAction,
} from "./actions";
import { chunkDocuments } from "@/lib/rag/chunk";
import { loadSyntheticDocuments } from "@/lib/rag/load-documents";
import { emptyEmbeddingStorageStatus } from "@/lib/rag/storage-records";
import type { DocumentChunk, KnowledgeDocument } from "@/lib/rag/types";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [corpus, embeddingStorageStatus] = await Promise.all([
    loadCorpus(),
    getEmbeddingStorageStatus(),
  ]);
  const { documents, chunks } = corpus;

  return (
    <RagVisibilityDashboard
      chunks={chunks}
      documents={documents}
      addDocumentAction={addSyntheticDocumentAction}
      embedAction={embedSyntheticDocumentsAction}
      askAction={askGroundedQuestion}
      embeddingStorageStatus={embeddingStorageStatus}
    />
  );
}

// Loading and chunking run on every request. Chunking throws loudly on a bad
// corpus (e.g. a slug collision), which is correct for tests, but here it would
// crash the whole page on every render with no way to recover from the UI. So
// degrade to an empty corpus (chat still works via Convex retrieval) and log
// server-side instead of bricking the app.
async function loadCorpus(): Promise<{
  documents: KnowledgeDocument[];
  chunks: DocumentChunk[];
}> {
  try {
    const documents = await loadSyntheticDocuments();
    return { documents, chunks: chunkDocuments(documents) };
  } catch (error) {
    console.error("Failed to load or chunk the synthetic corpus:", error);
    return { documents: [], chunks: [] };
  }
}

async function getEmbeddingStorageStatus() {
  try {
    return await fetchQuery(api.ragStorage.getStorageStatus);
  } catch {
    return emptyEmbeddingStorageStatus;
  }
}
