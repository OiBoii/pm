import type { BoardData } from "@/lib/kanban";

const BOARD_ENDPOINT = "/api/board";
const AI_CHAT_ENDPOINT = "/api/ai/chat";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AIChatResponse = {
  assistantResponse: string;
  board: BoardData;
  appliedMutations: Array<Record<string, unknown>>;
  ignoredMutations: Array<Record<string, unknown>>;
};

const asJson = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    let detail = `Request failed with status ${response.status}`;
    try {
      const payload = (await response.json()) as { detail?: string; message?: string };
      detail = payload.detail ?? payload.message ?? detail;
    } catch {
      // Keep fallback message when response is not JSON.
    }
    throw new Error(detail);
  }
  return (await response.json()) as T;
};

export const fetchBoard = async (): Promise<BoardData> => {
  const response = await fetch(BOARD_ENDPOINT, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });
  return asJson<BoardData>(response);
};

export const saveBoard = async (board: BoardData): Promise<BoardData> => {
  const response = await fetch(BOARD_ENDPOINT, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(board),
  });
  return asJson<BoardData>(response);
};

export const sendAIChat = async (
  question: string,
  history: ChatMessage[]
): Promise<AIChatResponse> => {
  const response = await fetch(AI_CHAT_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      question,
      history,
    }),
  });
  return asJson<AIChatResponse>(response);
};
