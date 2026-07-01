import { fetchAction, fetchQuery } from "convex/nextjs";

import { RagVisibilityDashboard } from "@/components/rag-visibility-dashboard";
import { api } from "../../convex/_generated/api";
import {
  embedSyntheticDocumentsAction,
  retrieveSyntheticChunksAction,
} from "./actions";
import { embeddingConfig } from "@/lib/rag/embedding-config";
import { chunkDocuments } from "@/lib/rag/chunk";
import { loadSyntheticDocuments } from "@/lib/rag/load-documents";
import { emptyEmbeddingStorageStatus } from "@/lib/rag/storage-records";
import type { RetrievalResponse } from "@/lib/rag/retrieval";

export const dynamic = "force-dynamic";

type HomeProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type RetrievalState = {
  retrieval: RetrievalResponse | null;
  retrievalError: string | null;
  submittedQuestion: string;
};

export default async function Home({ searchParams }: HomeProps) {
  const documents = await loadSyntheticDocuments();
  const chunks = chunkDocuments(documents);
  const embeddingStorageStatus = await getEmbeddingStorageStatus();
  const params = await searchParams;
  const submittedQuestion = getSingleSearchParam(params, "question")?.trim() ?? "";
  const retrievalErrorParam = getSingleSearchParam(params, "retrievalError");
  const retrievalState = await getRetrievalState({
    embeddedChunks: embeddingStorageStatus.embeddedChunks,
    retrievalErrorParam,
    submittedQuestion,
  });

  return (
    <RagVisibilityDashboard
      chunks={chunks}
      documents={documents}
      embedAction={embedSyntheticDocumentsAction}
      embeddingConfig={embeddingConfig}
      embeddingStorageStatus={embeddingStorageStatus}
      retrieval={retrievalState.retrieval}
      retrievalError={retrievalState.retrievalError}
      retrieveAction={retrieveSyntheticChunksAction}
      submittedQuestion={retrievalState.submittedQuestion}
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

async function getRetrievalState({
  embeddedChunks,
  retrievalErrorParam,
  submittedQuestion,
}: {
  embeddedChunks: number;
  retrievalErrorParam: string | undefined;
  submittedQuestion: string;
}): Promise<RetrievalState> {
  if (retrievalErrorParam === "empty") {
    return {
      retrieval: null,
      retrievalError: "Enter a question to retrieve evidence.",
      submittedQuestion: "",
    };
  }

  if (!submittedQuestion) {
    return {
      retrieval: null,
      retrievalError: null,
      submittedQuestion: "",
    };
  }

  if (embeddedChunks === 0) {
    return {
      retrieval: null,
      retrievalError: "Store and embed chunks before retrieval.",
      submittedQuestion,
    };
  }

  try {
    const retrieval = await fetchAction(api.ragRetrieval.retrieveRelevantChunks, {
      question: submittedQuestion,
      limit: 5,
    });

    return {
      retrieval,
      retrievalError: null,
      submittedQuestion,
    };
  } catch (error) {
    return {
      retrieval: null,
      retrievalError: toSafePageError(error),
      submittedQuestion,
    };
  }
}

function getSingleSearchParam(
  params: Record<string, string | string[] | undefined> | undefined,
  key: string,
) {
  const value = params?.[key];

  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function toSafePageError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Retrieval failed.";
}
