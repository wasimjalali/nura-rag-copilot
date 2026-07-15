import { createHash } from "node:crypto";

import { CHUNKER_VERSION } from "./chunk";
import type { DocumentChunk, KnowledgeDocument } from "./types";

export type SourceDocumentRecordInput = {
  source: string;
  title: string;
  textHash: string;
  wordCount: number;
};

export type DocumentChunkRecordInput = {
  chunkId: string;
  source: string;
  section: string;
  text: string;
  textHash: string;
  chunkerVersion: string;
  tokenEstimate: number;
};

export type EmbeddingStorageStatus = {
  storedDocuments: number;
  storedChunks: number;
  embeddedChunks: number;
  lastRunStatus: "not_started" | "running" | "succeeded" | "failed";
  lastRunMessage: string | null;
  lastEmbeddedAt: number | null;
  activeVersionId?: string | null;
  readyVersionId?: string | null;
  corpusStatus?:
    | "legacy"
    | "not_started"
    | "processing"
    | "ready"
    | "active"
    | "failed";
};

export type EmbeddingStorageStatusSummary = {
  storedDocumentsLabel: string;
  storedChunksLabel: string;
  embeddedChunksLabel: string;
  lastRunLabel: string;
  lastRunMessage: string;
  lastEmbeddedAtLabel: string;
};

export const emptyEmbeddingStorageStatus: EmbeddingStorageStatus = {
  storedDocuments: 0,
  storedChunks: 0,
  embeddedChunks: 0,
  lastRunStatus: "not_started",
  lastRunMessage: null,
  lastEmbeddedAt: null,
  activeVersionId: null,
  readyVersionId: null,
  corpusStatus: "not_started",
};

export function toSourceDocumentRecords(
  documents: KnowledgeDocument[],
): SourceDocumentRecordInput[] {
  return documents.map((document) => ({
    source: document.source,
    title: document.title,
    textHash: hashText(document.text),
    wordCount: countWords(document.text),
  }));
}

export function toDocumentChunkRecords(
  chunks: DocumentChunk[],
): DocumentChunkRecordInput[] {
  return chunks.map((chunk) => ({
    chunkId: chunk.id,
    source: chunk.source,
    section: chunk.section,
    text: chunk.text,
    textHash: hashText(chunk.text),
    chunkerVersion: CHUNKER_VERSION,
    tokenEstimate: chunk.tokenEstimate,
  }));
}

export function summarizeEmbeddingStorageStatus(
  status: EmbeddingStorageStatus,
): EmbeddingStorageStatusSummary {
  return {
    storedDocumentsLabel: `${status.storedDocuments.toLocaleString("en-US")} documents`,
    storedChunksLabel: `${status.storedChunks.toLocaleString("en-US")} stored`,
    embeddedChunksLabel: `${status.embeddedChunks.toLocaleString("en-US")} embedded`,
    lastRunLabel: status.lastRunStatus.replace(/_/g, " "),
    lastRunMessage: status.lastRunMessage ?? "No embedding run yet.",
    lastEmbeddedAtLabel: formatTimestamp(status.lastEmbeddedAt),
  };
}

function hashText(text: string) {
  return createHash("sha256").update(text).digest("hex");
}

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function formatTimestamp(timestamp: number | null) {
  if (timestamp === null) {
    return "Never";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(timestamp));
}
