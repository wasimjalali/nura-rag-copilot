import { fetchAction, fetchQuery } from "convex/nextjs";

import { RagVisibilityDashboard } from "@/components/rag-visibility-dashboard";
import { api } from "../../convex/_generated/api";
import {
  addSyntheticDocumentAction,
  embedSyntheticDocumentsAction,
  generateGroundedAnswerAction,
} from "./actions";
import { chunkDocuments } from "@/lib/rag/chunk";
import { loadSyntheticDocuments } from "@/lib/rag/load-documents";
import { emptyEmbeddingStorageStatus } from "@/lib/rag/storage-records";
import type { GroundedAnswerResponse } from "@/lib/rag/grounded-answer";
import type { DocumentChunk, KnowledgeDocument } from "@/lib/rag/types";

export const dynamic = "force-dynamic";

type HomeProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type GroundedAnswerState = {
  groundedAnswer: GroundedAnswerResponse | null;
  generateAnswerError: string | null;
  submittedQuestion: string;
};

export default async function Home({ searchParams }: HomeProps) {
  const [corpus, embeddingStorageStatus] = await Promise.all([
    loadCorpus(),
    getEmbeddingStorageStatus(),
  ]);
  const { documents, chunks } = corpus;
  const params = await searchParams;
  const submittedQuestion = getSingleSearchParam(params, "question")?.trim() ?? "";
  const answerErrorParam = getSingleSearchParam(params, "answerError");
  const answerState = await getGroundedAnswerState({
    embeddedChunks: embeddingStorageStatus.embeddedChunks,
    answerErrorParam,
    submittedQuestion,
  });

  return (
    <RagVisibilityDashboard
      chunks={chunks}
      documents={documents}
      addDocumentAction={addSyntheticDocumentAction}
      embedAction={embedSyntheticDocumentsAction}
      generateAnswerAction={generateGroundedAnswerAction}
      embeddingStorageStatus={embeddingStorageStatus}
      groundedAnswer={answerState.groundedAnswer}
      generateAnswerError={answerState.generateAnswerError}
      submittedQuestion={answerState.submittedQuestion}
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

async function getGroundedAnswerState({
  embeddedChunks,
  answerErrorParam,
  submittedQuestion,
}: {
  embeddedChunks: number;
  answerErrorParam: string | undefined;
  submittedQuestion: string;
}): Promise<GroundedAnswerState> {
  if (answerErrorParam === "empty") {
    return {
      groundedAnswer: null,
      generateAnswerError: "Enter a question to get an answer.",
      submittedQuestion: "",
    };
  }

  if (answerErrorParam === "too_long") {
    return {
      groundedAnswer: null,
      generateAnswerError:
        "That question is too long. Keep it under 2000 characters.",
      submittedQuestion: "",
    };
  }

  if (!submittedQuestion) {
    return {
      groundedAnswer: null,
      generateAnswerError: null,
      submittedQuestion: "",
    };
  }

  if (embeddedChunks === 0) {
    return {
      groundedAnswer: null,
      generateAnswerError: "Store and embed chunks before answer generation.",
      submittedQuestion,
    };
  }

  try {
    const groundedAnswer = await fetchAction(api.ragAnswer.generateGroundedAnswer, {
      question: submittedQuestion,
      limit: 5,
    });

    return {
      groundedAnswer,
      generateAnswerError: null,
      submittedQuestion,
    };
  } catch (error) {
    return {
      groundedAnswer: null,
      generateAnswerError: toSafePageError(error),
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
