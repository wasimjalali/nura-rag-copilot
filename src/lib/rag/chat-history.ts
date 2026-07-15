import type { GroundedAnswerResponse } from "./grounded-answer";

// A single question and its grounded answer (or the error that replaced it).
export type ChatTurn = {
  id: string;
  question: string;
  answer: GroundedAnswerResponse | null;
  error: string | null;
  errorRetryable?: boolean;
};

// A saved conversation. The full turns (including retrieval evidence) are kept
// so resuming a chat restores the answers, citations and Sources panel exactly.
export type Conversation = {
  id: string;
  title: string;
  turns: ChatTurn[];
  createdAt: number;
  updatedAt: number;
};

// Single-user, local tool: history lives in the browser rather than a Convex
// table (a server-side conversations store would be overkill for one user).
const STORAGE_KEY = "nura.conversations.v1";
const MIGRATION_KEY = "nura.conversations.migrated-to-convex.v1";
export const MAX_CONVERSATIONS = 30;

export function loadConversations(): Conversation[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isConversation).slice(0, MAX_CONVERSATIONS);
  } catch {
    return [];
  }
}

export function saveConversations(conversations: Conversation[]): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(conversations.slice(0, MAX_CONVERSATIONS)),
    );
  } catch {
    // Storage full or unavailable. History is best-effort, so drop it silently
    // rather than breaking the chat.
  }
}

export function loadLegacyConversationsForMigration(): Conversation[] {
  if (typeof window === "undefined") return [];
  if (window.localStorage.getItem(MIGRATION_KEY) === "true") return [];
  return loadConversations();
}

export function markLegacyConversationMigrationComplete(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MIGRATION_KEY, "true");
  window.localStorage.removeItem(STORAGE_KEY);
}

export function deriveConversationTitle(question: string): string {
  const normalized = question.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return "New chat";
  }
  return normalized.length > 60 ? `${normalized.slice(0, 57)}…` : normalized;
}

export function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id_${Date.now().toString(36)}_${Math.random().toString(16).slice(2)}`;
}

function isConversation(value: unknown): value is Conversation {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Conversation).id === "string" &&
    typeof (value as Conversation).title === "string" &&
    Array.isArray((value as Conversation).turns)
  );
}
