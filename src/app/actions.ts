"use server";

import { promises as fs } from "node:fs";
import path from "node:path";

import { fetchAction, fetchMutation, fetchQuery } from "convex/nextjs";
import { revalidatePath } from "next/cache";

import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { chunkDocuments } from "@/lib/rag/chunk";
import {
  actionFailure,
  actionSuccess,
  AppError,
  toPublicAppError,
  type ActionResult,
  type PublicAppError,
} from "@/lib/rag/app-errors";
import { extractUploadedText } from "@/lib/rag/extract-upload";
import type { GroundedAnswerResponse } from "@/lib/rag/grounded-answer";
import type { Conversation } from "@/lib/rag/chat-history";
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
    throwPublicAppError(
      error,
      inProgress
        ? {
            code: "RATE_LIMITED",
            message:
              "An embedding run is already in progress. Try again in a moment.",
            retryable: true,
          }
        : {
            code: "PROVIDER_TEMPORARY",
            message: "Embedding failed. Check the model connection and try again.",
            retryable: true,
          },
    );
  }

  revalidatePath("/");
}

export async function promoteCorpusVersionAction(versionId: string) {
  try {
    await fetchMutation(api.corpusVersions.promoteReady, {
      versionId: versionId as Id<"corpusVersions">,
    });
  } catch (error) {
    throwPublicAppError(error, {
      code: "INTERNAL_ERROR",
      message: "The ready corpus could not be promoted.",
      retryable: true,
    });
  }
  revalidatePath("/");
}

const RETRIEVAL_LIMIT = 5;

/**
 * Answer a support question against the live RAG loop, carrying the recent
 * conversation so follow-ups resolve. Returns the grounded answer (with its
 * retrieval evidence); the chat UI appends it to the transcript.
 */
export async function askGroundedQuestion(input: {
  question: string;
  conversationId: string | null;
  requestId: string;
}): Promise<ActionResult<GroundedAnswerResponse>> {
  const question = input.question.trim();

  if (!question) {
    return actionFailure(
      new AppError(
        "VALIDATION_FAILED",
        "Enter a question to get an answer.",
        false,
      ),
    );
  }

  if (question.length > MAX_QUESTION_LENGTH) {
    return actionFailure(
      new AppError(
        "VALIDATION_FAILED",
        `That question is too long. Keep it under ${MAX_QUESTION_LENGTH} characters.`,
        false,
      ),
    );
  }

  try {
    return actionSuccess(
      await fetchAction(api.ragAnswer.generateGroundedAnswer, {
        question,
        conversationId: input.conversationId
          ? (input.conversationId as Id<"conversations">)
          : undefined,
        requestId: input.requestId,
        limit: RETRIEVAL_LIMIT,
      }),
    );
  } catch (error) {
    return actionFailure(error, {
      code: "INTERNAL_ERROR",
      message: "The answer could not be generated.",
      retryable: false,
    });
  }
}

export async function loadConversationAction(conversationId: string) {
  try {
    return actionSuccess(
      await fetchQuery(api.conversations.getById, {
        conversationId: conversationId as Id<"conversations">,
      }),
    );
  } catch (error) {
    return actionFailure(error, {
      code: "INTERNAL_ERROR",
      message: "The conversation could not be loaded.",
      retryable: true,
    });
  }
}

export async function deleteConversationAction(conversationId: string) {
  try {
    await fetchMutation(api.conversations.remove, {
      conversationId: conversationId as Id<"conversations">,
    });
    return actionSuccess(null);
  } catch (error) {
    return actionFailure(error, {
      code: "INTERNAL_ERROR",
      message: "The conversation could not be deleted.",
      retryable: true,
    });
  }
}

export async function importLegacyConversationsAction(
  conversations: Conversation[],
) {
  try {
    await fetchMutation(api.conversations.importLegacy, {
      conversations: conversations.slice(0, 30).map((conversation) => ({
        legacyId: conversation.id,
        title: conversation.title,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        turns: conversation.turns.slice(0, 50).map((turn) => ({
          turnId: turn.id,
          question: turn.question,
          error: turn.error ?? undefined,
          answer: turn.answer
            ? {
                answer: turn.answer.answer,
                answerModel: turn.answer.answerModel,
                structuredAnswer: turn.answer.structuredAnswer,
                retrieval: turn.answer.retrieval,
              }
            : undefined,
        })),
      })),
    });
    return actionSuccess(null);
  } catch (error) {
    return actionFailure(error, {
      code: "INTERNAL_ERROR",
      message: "Existing local conversations could not be migrated.",
      retryable: true,
    });
  }
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
    throw new AppError(
      "VALIDATION_FAILED",
      "A title and document text are both required.",
      false,
    );
  }

  if (title.length > 120) {
    throw new AppError(
      "VALIDATION_FAILED",
      "Keep the title under 120 characters.",
      false,
    );
  }

  if (body.length > 50_000) {
    throw new AppError(
      "VALIDATION_FAILED",
      "Keep the document under 50,000 characters.",
      false,
    );
  }

  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);

  if (!slug) {
    throw new AppError(
      "VALIDATION_FAILED",
      "Use a title that contains letters or numbers.",
      false,
    );
  }

  const filePath = path.resolve(SYNTHETIC_DOCS_DIR, `${slug}.md`);

  if (!filePath.startsWith(path.resolve(SYNTHETIC_DOCS_DIR) + path.sep)) {
    throw new AppError(
      "VALIDATION_FAILED",
      "That title is not a valid document name.",
      false,
    );
  }

  const markdown = body.startsWith("# ") ? body : `# ${title}\n\n${body}`;

  try {
    await fs.writeFile(filePath, `${markdown}\n`, { flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new AppError(
        "VALIDATION_FAILED",
        "A document with a similar title already exists.",
        false,
      );
    }
    // Do not forward the raw fs error (it includes the absolute file path).
    throw new AppError(
      "INTERNAL_ERROR",
      "Could not save the document. Please try again.",
      true,
    );
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
    throw new AppError(
      "PROVIDER_TEMPORARY",
      "The document was added but embedding failed. Store and embed the corpus again from the Knowledge view.",
      true,
    );
  }

  revalidatePath("/");
}

function throwPublicAppError(
  error: unknown,
  fallback: PublicAppError,
): never {
  const publicError = toPublicAppError(error, fallback);
  throw new AppError(
    publicError.code,
    publicError.message,
    publicError.retryable,
  );
}
