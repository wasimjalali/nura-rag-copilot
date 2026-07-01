import { RagVisibilityDashboard } from "@/components/rag-visibility-dashboard";
import { embeddingConfig } from "@/lib/rag/embedding-config";
import { chunkDocuments } from "@/lib/rag/chunk";
import { loadSyntheticDocuments } from "@/lib/rag/load-documents";

export default async function Home() {
  const documents = await loadSyntheticDocuments();
  const chunks = chunkDocuments(documents);

  return (
    <RagVisibilityDashboard
      chunks={chunks}
      documents={documents}
      embeddingConfig={embeddingConfig}
    />
  );
}
