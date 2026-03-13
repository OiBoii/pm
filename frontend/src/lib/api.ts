import type { BoardData } from "@/lib/kanban";

const BOARD_ENDPOINT = "/api/board";

const asJson = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
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
