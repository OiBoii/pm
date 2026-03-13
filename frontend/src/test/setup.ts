import "@testing-library/jest-dom";
import { afterEach, beforeEach, vi } from "vitest";
import { initialData, type BoardData } from "@/lib/kanban";

const cloneBoard = (): BoardData => JSON.parse(JSON.stringify(initialData)) as BoardData;

let boardState: BoardData;

beforeEach(() => {
  boardState = cloneBoard();
  vi.spyOn(globalThis, "fetch").mockImplementation(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (!url.endsWith("/api/board")) {
        return Promise.reject(new Error(`Unhandled fetch URL in tests: ${url}`));
      }

      const method = init?.method ?? "GET";
      if (method === "GET") {
        return new Response(JSON.stringify(boardState), { status: 200 });
      }

      if (method === "PUT") {
        const raw = typeof init?.body === "string" ? init.body : "{}";
        boardState = JSON.parse(raw) as BoardData;
        return new Response(JSON.stringify(boardState), { status: 200 });
      }

      return new Response(null, { status: 405 });
    }
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});
