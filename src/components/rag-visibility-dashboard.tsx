"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { DocumentChunk, KnowledgeDocument } from "@/lib/rag/types";
import type { GroundedAnswerResponse } from "@/lib/rag/grounded-answer";
import type { EmbeddingStorageStatus } from "@/lib/rag/storage-records";
import type { ActionResult } from "@/lib/rag/app-errors";
import { runEvalsAction } from "@/app/eval-actions";
import { EvaluationsWorkspace } from "@/components/evaluations/evaluations-workspace";
import { KnowledgeWorkspace } from "@/components/knowledge/knowledge-workspace";
import {
  buildEvidenceItems as buildChatEvidenceItems,
  ChatWorkspace,
  filterCitedEvidence as filterChatCitedEvidence,
} from "@/components/chat/chat-workspace";
import {
  EvidenceChunkDialog,
  EvidenceInspector,
  type EvidenceItem,
} from "@/components/chat/evidence-inspector";
import {
  WorkspaceShell,
  type WorkspaceView,
} from "@/components/workspace/workspace-shell";
import { WorkspaceNav } from "@/components/workspace/workspace-nav";
import {
  createId,
  deriveConversationTitle,
  loadConversations,
  MAX_CONVERSATIONS,
  saveConversations,
  type ChatTurn,
  type Conversation,
} from "@/lib/rag/chat-history";

type AskAction = (input: {
  question: string;
  history: { question: string; answer: string }[];
}) => Promise<ActionResult<GroundedAnswerResponse>>;

type RagVisibilityDashboardProps = {
  documents: KnowledgeDocument[];
  chunks: DocumentChunk[];
  addDocumentAction: (formData: FormData) => Promise<void>;
  embedAction: () => Promise<void>;
  askAction: AskAction;
  embeddingStorageStatus: EmbeddingStorageStatus;
};

export function RagVisibilityDashboard({
  documents,
  chunks,
  addDocumentAction,
  embedAction,
  askAction,
  embeddingStorageStatus,
}: RagVisibilityDashboardProps) {
  const [activeView, setActiveView] = useState<WorkspaceView>("chat");
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [selectedChunk, setSelectedChunk] = useState<EvidenceItem | null>(null);
  const [focusToken, setFocusToken] = useState(0);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [focusText, setFocusText] = useState<string | null>(null);

  // Conversation state lives here so the sources panel (a sibling of the chat)
  // can read the active turn's evidence.
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [activeTurnId, setActiveTurnId] = useState<string | null>(null);
  // Saved conversations (localStorage). Loaded after mount to avoid an SSR
  // mismatch; activeConversationId ties the on-screen transcript to a record.
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  // Bumped on New chat / switching chats so an in-flight answer from an
  // abandoned conversation is dropped instead of landing in the current one.
  const conversationRef = useRef(0);
  const turnSeq = useRef(0);

  useEffect(() => {
    // One-time client hydration of persisted history. Reading localStorage
    // during render would cause an SSR/client mismatch, so it happens here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConversations(loadConversations());
  }, []);

  const retrievalReady = embeddingStorageStatus.embeddedChunks > 0;

  const activeAnswer = useMemo(
    () => turns.find((turn) => turn.id === activeTurnId)?.answer ?? null,
    [turns, activeTurnId],
  );
  const retrievedItems = useMemo(
    () => buildChatEvidenceItems(activeAnswer),
    [activeAnswer],
  );
  const citedItems = useMemo(
    () => filterChatCitedEvidence(activeAnswer, retrievedItems),
    [activeAnswer, retrievedItems],
  );

  // Save (or update) the active conversation to localStorage after each turn.
  function persistConversation(nextTurns: ChatTurn[]) {
    const id = activeConversationId ?? createId();
    if (!activeConversationId) {
      setActiveConversationId(id);
    }
    const title = deriveConversationTitle(nextTurns[0]?.question ?? "");
    setConversations((current) => {
      const existing = current.find((conversation) => conversation.id === id);
      const updated: Conversation = {
        id,
        title,
        turns: nextTurns,
        createdAt: existing?.createdAt ?? Date.now(),
        updatedAt: Date.now(),
      };
      const next = [
        updated,
        ...current.filter((conversation) => conversation.id !== id),
      ].slice(0, MAX_CONVERSATIONS);
      saveConversations(next);
      return next;
    });
  }

  async function submitQuestion(rawValue: string) {
    const question = rawValue.trim();
    if (!question || pendingQuestion) {
      return;
    }

    const guardToken = conversationRef.current;
    const priorTurns = turns;
    const history = priorTurns
      .filter((turn) => turn.answer)
      .map((turn) => ({ question: turn.question, answer: turn.answer!.answer }));

    setPendingQuestion(question);
    try {
      const result = await askAction({ question, history });
      if (conversationRef.current !== guardToken) {
        return;
      }
      turnSeq.current += 1;

      if (!result.ok) {
        const nextTurns = [
          ...priorTurns,
          {
            id: `turn_${turnSeq.current}`,
            question,
            answer: null,
            error: result.error.message,
          },
        ];
        setTurns(nextTurns);
        persistConversation(nextTurns);
        return;
      }

      const answer = result.data;
      const nextTurns = [
        ...priorTurns,
        { id: `turn_${turnSeq.current}`, question, answer, error: null },
      ];
      setTurns(nextTurns);
      persistConversation(nextTurns);
    } catch {
      if (conversationRef.current !== guardToken) {
        return;
      }
      turnSeq.current += 1;
      const nextTurns = [
        ...priorTurns,
        {
          id: `turn_${turnSeq.current}`,
          question,
          answer: null,
          error: "Could not generate an answer.",
        },
      ];
      setTurns(nextTurns);
      persistConversation(nextTurns);
    } finally {
      if (conversationRef.current === guardToken) {
        setPendingQuestion(null);
      }
    }
  }

  function startNewChat() {
    conversationRef.current += 1;
    setTurns([]);
    setPendingQuestion(null);
    setActiveTurnId(null);
    setActiveConversationId(null);
    setSourcesOpen(false);
    setFocusId(null);
    setFocusText(null);
    setSelectedChunk(null);
  }

  function selectConversation(id: string) {
    const conversation = conversations.find((item) => item.id === id);
    if (!conversation) {
      return;
    }
    conversationRef.current += 1;
    setTurns(conversation.turns);
    setActiveConversationId(id);
    setPendingQuestion(null);
    setActiveTurnId(null);
    setSourcesOpen(false);
    setFocusId(null);
    setFocusText(null);
    setSelectedChunk(null);
  }

  function deleteConversation(id: string) {
    setConversations((current) => {
      const next = current.filter((conversation) => conversation.id !== id);
      saveConversations(next);
      return next;
    });
    if (id === activeConversationId) {
      conversationRef.current += 1;
      setTurns([]);
      setActiveConversationId(null);
      setPendingQuestion(null);
      setActiveTurnId(null);
      setSourcesOpen(false);
      setFocusId(null);
      setFocusText(null);
    }
  }

  function openSources(turnId: string) {
    if (turnId !== activeTurnId) {
      setFocusId(null);
      setFocusText(null);
    }
    setActiveTurnId(turnId);
    setSourcesOpen(true);
  }

  function focusEvidence(
    turnId: string,
    id: string,
    matchedSentence: string,
  ) {
    setActiveTurnId(turnId);
    setSourcesOpen(true);
    setFocusId(id);
    setFocusText(matchedSentence);
    setFocusToken((token) => token + 1);
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }
      // A dialog owns Escape while it is open; let it close only itself so the
      // sources panel behind it does not collapse at the same time.
      if (selectedChunk) {
        return;
      }
      setSourcesOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedChunk]);

  function selectWorkspaceView(view: WorkspaceView) {
    setActiveView(view);
    setSourcesOpen(false);
  }

  return (
    <WorkspaceShell
      activeView={activeView}
      inspector={
        activeView === "chat" && sourcesOpen ? (
          <>
            <button
              aria-label="Close sources"
              className="fixed inset-0 z-30 bg-ink/30 lg:hidden"
              onClick={() => setSourcesOpen(false)}
              type="button"
            />
            <EvidenceInspector
              citedItems={citedItems}
              focusId={focusId}
              focusText={focusText}
              focusToken={focusToken}
              onClose={() => setSourcesOpen(false)}
              onOpenChunk={setSelectedChunk}
              retrievedItems={retrievedItems}
            />
          </>
        ) : undefined
      }
      navigation={
        <WorkspaceNav
          activeConversationId={activeConversationId}
          activeView={activeView}
          conversations={conversations}
          documentsCount={documents.length}
          embeddedChunks={embeddingStorageStatus.embeddedChunks}
          onDeleteConversation={deleteConversation}
          onSelectConversation={selectConversation}
          onSelectView={selectWorkspaceView}
          retrievalReady={retrievalReady}
        />
      }
      onSelectView={selectWorkspaceView}
    >
      {activeView === "chat" ? (
        <ChatWorkspace
          askDisabled={!retrievalReady}
          canReset={turns.length > 0 || pendingQuestion !== null}
          focusedEvidenceId={focusId}
          onFocusEvidence={focusEvidence}
          onNewChat={startNewChat}
          onOpenSources={openSources}
          onSubmit={submitQuestion}
          pendingQuestion={pendingQuestion}
          ready={retrievalReady}
          turns={turns}
        />
      ) : (
        <ScrollView>
          {activeView === "knowledge" ? (
            <KnowledgeWorkspace
              addDocumentAction={addDocumentAction}
              chunks={chunks}
              documents={documents}
              embedAction={embedAction}
              embeddingStorageStatus={embeddingStorageStatus}
              indexActionLabel={
                retrievalReady ? "Re-embed corpus" : "Store and embed chunks"
              }
            />
          ) : null}
          {activeView === "evaluations" ? (
            <EvaluationsWorkspace
              history={[]}
              initialRun={null}
              runAction={runEvalsAction}
              runLabel="Run evals"
            />
          ) : null}
        </ScrollView>
      )}

      {selectedChunk ? (
        <EvidenceChunkDialog
          focusText={focusText}
          item={selectedChunk}
          onClose={() => setSelectedChunk(null)}
        />
      ) : null}
    </WorkspaceShell>
  );
}

function ScrollView({ children }: { children: ReactNode }) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="panel-in mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 sm:py-10">
        {children}
      </div>
    </div>
  );
}
