import { fetchQuery } from "convex/nextjs";

import { RagVisibilityDashboard } from "@/components/rag-visibility-dashboard";
import { api } from "../../convex/_generated/api";
import { embedSyntheticDocumentsAction } from "./actions";
import { embeddingConfig } from "@/lib/rag/embedding-config";
import { chunkDocuments } from "@/lib/rag/chunk";
import { loadSyntheticDocuments } from "@/lib/rag/load-documents";
import { emptyEmbeddingStorageStatus } from "@/lib/rag/storage-records";

export const dynamic = "force-dynamic";

export default async function Home() {
  const documents = await loadSyntheticDocuments();
  const chunks = chunkDocuments(documents);
  const embeddingStorageStatus = await getEmbeddingStorageStatus();

  return (
    <RagVisibilityDashboard
      chunks={chunks}
      documents={documents}
      embedAction={embedSyntheticDocumentsAction}
      embeddingConfig={embeddingConfig}
      embeddingStorageStatus={embeddingStorageStatus}
    />
  );
}

async function getEmbeddingStorageStatus() {
  try {
    return await fetchQuery(api.ragStorage.getStorageStatus);
  } catch {
    return emptyEmbeddingStorageStatus;
  }
}
