"use client";

import { useCallback, useEffect, useState } from "react";
import {
  type Collision,
  type CollisionDetection,
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { KanbanColumn } from "@/components/KanbanColumn";
import { KanbanCardPreview } from "@/components/KanbanCardPreview";
import { createId, moveCard, type BoardData } from "@/lib/kanban";
import { fetchBoard, saveBoard, sendAIChat, type ChatMessage } from "@/lib/api";

const COLUMN_DROP_ZONE_PREFIX = "column-drop::";

const isColumnDropZoneId = (id: string) => id.startsWith(COLUMN_DROP_ZONE_PREFIX);

const normalizeOverId = (id: string) =>
  isColumnDropZoneId(id) ? id.slice(COLUMN_DROP_ZONE_PREFIX.length) : id;

const filterDropZoneHits = (hits: Collision[]) =>
  hits.filter((collision) => isColumnDropZoneId(String(collision.id)));

export const KanbanBoard = () => {
  const [board, setBoard] = useState<BoardData | null>(null);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatError, setChatError] = useState<string | null>(null);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const collisionDetectionStrategy: CollisionDetection = useCallback((args) => {
    const pointerHits = pointerWithin(args);
    if (pointerHits.length > 0) {
      const cardHits = pointerHits.filter((c) => !isColumnDropZoneId(String(c.id)));
      if (cardHits.length > 0) return cardHits;
      return filterDropZoneHits(pointerHits);
    }

    const rectHits = rectIntersection(args);
    if (rectHits.length > 0) {
      const cardHits = rectHits.filter((c) => !isColumnDropZoneId(String(c.id)));
      if (cardHits.length > 0) return cardHits;
      return filterDropZoneHits(rectHits);
    }

    return closestCorners(args);
  }, []);

  const persistBoard = useCallback(async (nextBoard: BoardData) => {
    try {
      await saveBoard(nextBoard);
      setSaveError(null);
    } catch {
      setSaveError("Could not save changes. Please try again.");
    }
  }, []);

  const applyBoardUpdate = useCallback(
    (update: (prev: BoardData) => BoardData) => {
      setBoard((prev) => {
        if (!prev) {
          return prev;
        }
        const next = update(prev);
        void persistBoard(next);
        return next;
      });
    },
    [persistBoard]
  );

  const loadBoard = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const loaded = await fetchBoard();
      setBoard(loaded);
      setSaveError(null);
    } catch {
      setBoard(null);
      setLoadError("Could not load board data.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveCardId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const {
      active,
      over,
      active: { rect: activeRect },
      over: overTarget,
    } = event;
    setActiveCardId(null);

    if (!over || active.id === over.id || !overTarget) {
      return;
    }

    const overId = normalizeOverId(String(over.id));
    const isOverDropZone = isColumnDropZoneId(String(over.id));

    let insertAfter = false;

    // If dropping onto a specific card, determine if we should insert before or after it
    if (!isOverDropZone && overTarget.rect) {
      const translatedRect = activeRect.current.translated;
      if (translatedRect) {
        const overRect = overTarget.rect;
        // If the active card's center is below the over card's center, we insert after
        const activeCenter = translatedRect.top + translatedRect.height / 2;
        const overCenter = overRect.top + overRect.height / 2;
        insertAfter = activeCenter > overCenter;
      }
    }

    applyBoardUpdate((prev) => ({
      ...prev,
      columns: moveCard(prev.columns, active.id as string, overId, insertAfter),
    }));
  };

  const handleRenameColumn = (columnId: string, title: string) => {
    applyBoardUpdate((prev) => ({
      ...prev,
      columns: prev.columns.map((column) =>
        column.id === columnId ? { ...column, title } : column
      ),
    }));
  };

  const handleAddCard = (columnId: string, title: string, details: string) => {
    const id = createId("card");
    applyBoardUpdate((prev) => ({
      ...prev,
      cards: {
        ...prev.cards,
        [id]: { id, title, details: details || "No details yet." },
      },
      columns: prev.columns.map((column) =>
        column.id === columnId
          ? { ...column, cardIds: [...column.cardIds, id] }
          : column
      ),
    }));
  };

  const handleDeleteCard = (columnId: string, cardId: string) => {
    applyBoardUpdate((prev) => ({
      ...prev,
      cards: Object.fromEntries(
        Object.entries(prev.cards).filter(([id]) => id !== cardId)
      ),
      columns: prev.columns.map((column) =>
        column.id === columnId
          ? { ...column, cardIds: column.cardIds.filter((id) => id !== cardId) }
          : column
      ),
    }));
  };

  const handleSendChat = async () => {
    const question = chatInput.trim();
    if (!question || isSendingChat) {
      return;
    }

    setIsSendingChat(true);
    setChatError(null);
    setChatInput("");

    const userMessage: ChatMessage = { role: "user", content: question };
    const requestHistory = [...chatHistory];
    setChatHistory((prev) => [...prev, userMessage]);

    try {
      const response = await sendAIChat(question, requestHistory);
      setBoard(response.board);
      setChatHistory((prev) => [
        ...prev,
        { role: "assistant", content: response.assistantResponse },
      ]);
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : "Could not reach AI assistant. Please try again.";
      setChatError(message);
      // Roll back optimistic user message to avoid false history on failed request.
      setChatHistory((prev) => prev.slice(0, -1));
      setChatInput(question);
    } finally {
      setIsSendingChat(false);
    }
  };

  const activeCard = activeCardId && board ? board.cards[activeCardId] : null;

  if (isLoading) {
    return (
      <main className="mx-auto flex min-h-screen max-w-[1500px] items-center justify-center px-6 py-12">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
          Loading board...
        </p>
      </main>
    );
  }

  if (loadError || !board) {
    return (
      <main className="mx-auto flex min-h-screen max-w-[1500px] items-center justify-center px-6 py-12">
        <section className="rounded-2xl border border-[var(--stroke)] bg-white p-8 shadow-[var(--shadow)]">
          <p className="text-sm font-medium text-[var(--secondary-purple)]">
            {loadError ?? "Could not load board data."}
          </p>
          <button
            type="button"
            onClick={() => void loadBoard()}
            className="mt-4 rounded-full bg-[var(--secondary-purple)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110"
          >
            Retry
          </button>
        </section>
      </main>
    );
  }

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.25)_0%,_rgba(32,157,215,0.05)_55%,_transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.18)_0%,_rgba(117,57,145,0.05)_55%,_transparent_75%)]" />

      <main className="relative mx-auto flex min-h-screen max-w-[1500px] flex-col gap-10 px-6 pb-16 pt-12">
        <header className="flex flex-col gap-6 rounded-[32px] border border-[var(--stroke)] bg-white/80 p-8 shadow-[var(--shadow)] backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
                Single Board Kanban
              </p>
              <h1 className="mt-3 font-display text-4xl font-semibold text-[var(--navy-dark)]">
                Kanban Studio
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--gray-text)]">
                Keep momentum visible. Rename columns, drag cards between stages,
                and capture quick notes without getting buried in settings.
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
                Focus
              </p>
              <p className="mt-2 text-lg font-semibold text-[var(--primary-blue)]">
                One board. Five columns. Zero clutter.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {board.columns.map((column) => (
              <div
                key={column.id}
                className="flex items-center gap-2 rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)]"
              >
                <span className="h-2 w-2 rounded-full bg-[var(--accent-yellow)]" />
                {column.title}
              </div>
            ))}
          </div>
          {saveError ? (
            <p className="text-sm font-medium text-[var(--secondary-purple)]">{saveError}</p>
          ) : null}
        </header>

        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetectionStrategy}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <section className="grid gap-6 lg:grid-cols-5">
            {board.columns.map((column) => (
              <KanbanColumn
                key={column.id}
                column={column}
                cards={column.cardIds.map((cardId) => board.cards[cardId])}
                dropZoneId={`${COLUMN_DROP_ZONE_PREFIX}${column.id}`}
                onRename={handleRenameColumn}
                onAddCard={handleAddCard}
                onDeleteCard={handleDeleteCard}
              />
            ))}
          </section>
          <DragOverlay>
            {activeCard ? (
              <div className="w-[260px]">
                <KanbanCardPreview card={activeCard} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        <button
          type="button"
          data-testid="ai-chat-launcher"
          onClick={() => setIsChatOpen((open) => !open)}
          className="fixed bottom-8 right-6 z-30 h-14 w-14 rounded-full bg-[var(--secondary-purple)] text-sm font-semibold uppercase tracking-wide text-white shadow-[0_16px_30px_rgba(117,57,145,0.4)] transition hover:scale-[1.03] hover:brightness-110"
          aria-label={isChatOpen ? "Close AI chat" : "Open AI chat"}
        >
          {isChatOpen ? "x" : "AI"}
        </button>

        <aside
          data-testid="ai-chat-sidebar"
          className={`fixed bottom-28 right-6 z-20 flex h-[72vh] min-h-[520px] w-[360px] max-w-[calc(100vw-2.5rem)] flex-col rounded-3xl border border-[var(--stroke)] bg-white p-5 shadow-[var(--shadow)] transition duration-200 ${
            isChatOpen
              ? "pointer-events-auto translate-y-0 opacity-100"
              : "pointer-events-none translate-y-3 opacity-0"
          }`}
        >
          <div className="flex items-start justify-between border-b border-[var(--stroke)] pb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
                AI Assistant
              </p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-[var(--navy-dark)]">
                Board Chat
              </h2>
              <p className="mt-2 text-sm text-[var(--gray-text)]">
                Ask for card edits, moves, and creation. Changes apply automatically.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsChatOpen(false)}
              className="rounded-full border border-[var(--stroke)] px-2 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
            >
              Close
            </button>
          </div>

          <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
            {chatHistory.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[var(--stroke)] px-4 py-3 text-sm text-[var(--gray-text)]">
                No messages yet. Try: Move card-1 to Done.
              </p>
            ) : null}
            {chatHistory.map((message, index) => (
              <article
                key={`${message.role}-${index}-${message.content}`}
                className={`rounded-2xl px-4 py-3 text-sm leading-6 ${
                  message.role === "user"
                    ? "ml-8 border border-[var(--primary-blue)]/20 bg-[var(--primary-blue)]/10 text-[var(--navy-dark)]"
                    : "mr-8 border border-[var(--secondary-purple)]/20 bg-[var(--secondary-purple)]/10 text-[var(--navy-dark)]"
                }`}
              >
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
                  {message.role === "user" ? "You" : "Assistant"}
                </p>
                <p>{message.content}</p>
              </article>
            ))}
          </div>

          {chatError ? (
            <p className="mt-3 text-sm font-medium text-[var(--secondary-purple)]">{chatError}</p>
          ) : null}

          <form
            className="mt-4 space-y-3 border-t border-[var(--stroke)] pt-4"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSendChat();
            }}
          >
            <label htmlFor="ai-chat-input" className="sr-only">
              Chat message
            </label>
            <textarea
              id="ai-chat-input"
              data-testid="ai-chat-input"
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
              placeholder="Ask the AI to update your board..."
              className="min-h-[96px] w-full resize-none rounded-2xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
              disabled={isSendingChat}
            />
            <button
              type="submit"
              className="w-full rounded-full bg-[var(--secondary-purple)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSendingChat || !chatInput.trim()}
            >
              {isSendingChat ? "Sending..." : "Send"}
            </button>
          </form>
        </aside>
      </main>
    </div>
  );
};
