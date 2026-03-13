import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { initialData, type BoardData } from "@/lib/kanban";
import { KanbanBoard } from "@/components/KanbanBoard";
import { vi } from "vitest";

const getFirstColumn = async () => (await screen.findAllByTestId(/column-/i))[0];

describe("KanbanBoard", () => {
  it("renders five columns", async () => {
    render(<KanbanBoard />);
    expect(await screen.findAllByTestId(/column-/i)).toHaveLength(5);
  });

  it("renames a column", async () => {
    render(<KanbanBoard />);
    const column = await getFirstColumn();
    const input = within(column).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.type(input, "New Name");
    expect(input).toHaveValue("New Name");
  });

  it("adds and removes a card", async () => {
    render(<KanbanBoard />);
    const column = await getFirstColumn();
    const addButton = within(column).getByRole("button", {
      name: /add a card/i,
    });
    await userEvent.click(addButton);

    const titleInput = within(column).getByPlaceholderText(/card title/i);
    await userEvent.type(titleInput, "New card");
    const detailsInput = within(column).getByPlaceholderText(/details/i);
    await userEvent.type(detailsInput, "Notes");

    await userEvent.click(within(column).getByRole("button", { name: /add card/i }));

    expect(within(column).getByText("New card")).toBeInTheDocument();

    const deleteButton = within(column).getByRole("button", {
      name: /delete new card/i,
    });
    await userEvent.click(deleteButton);

    expect(within(column).queryByText("New card")).not.toBeInTheDocument();
  });

  it("renders AI sidebar and sends a chat request", async () => {
    render(<KanbanBoard />);
    expect(await screen.findByTestId("ai-chat-launcher")).toBeInTheDocument();
    await userEvent.click(screen.getByTestId("ai-chat-launcher"));
    expect(screen.getByTestId("ai-chat-sidebar")).toBeInTheDocument();

    const input = screen.getByTestId("ai-chat-input");
    await userEvent.type(input, "Rename card-1 to Updated by AI");
    await userEvent.click(screen.getByRole("button", { name: /^send$/i }));

    expect(await screen.findByText("Rename card-1 to Updated by AI")).toBeInTheDocument();
    expect(await screen.findByText("No board changes needed.")).toBeInTheDocument();
  });

  it("applies board updates returned by AI endpoint", async () => {
    let boardState: BoardData = JSON.parse(JSON.stringify(initialData)) as BoardData;
    vi.mocked(global.fetch).mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        const method = init?.method ?? "GET";

        if (url.endsWith("/api/board") && method === "GET") {
          return new Response(JSON.stringify(boardState), { status: 200 });
        }
        if (url.endsWith("/api/board") && method === "PUT") {
          const raw = typeof init?.body === "string" ? init.body : "{}";
          boardState = JSON.parse(raw) as BoardData;
          return new Response(JSON.stringify(boardState), { status: 200 });
        }
        if (url.endsWith("/api/ai/chat") && method === "POST") {
          boardState = {
            ...boardState,
            cards: {
              ...boardState.cards,
              "card-1": { ...boardState.cards["card-1"], title: "Renamed by assistant" },
            },
          };
          return new Response(
            JSON.stringify({
              assistantResponse: "Updated card-1 title.",
              board: boardState,
              appliedMutations: [{ type: "edit_card", cardId: "card-1" }],
              ignoredMutations: [],
            }),
            { status: 200 }
          );
        }

        return Promise.reject(new Error(`Unhandled fetch URL in tests: ${url}`));
      }
    );

    render(<KanbanBoard />);
    await screen.findByText("Align roadmap themes");
    await userEvent.click(screen.getByTestId("ai-chat-launcher"));

    await userEvent.type(screen.getByTestId("ai-chat-input"), "Rename card-1");
    await userEvent.click(screen.getByRole("button", { name: /^send$/i }));

    expect(await screen.findByText("Renamed by assistant")).toBeInTheDocument();
    expect(await screen.findByText("Updated card-1 title.")).toBeInTheDocument();
  });

  it("shows AI error and restores input on failed chat request", async () => {
    vi.mocked(global.fetch).mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        const method = init?.method ?? "GET";
        if (url.endsWith("/api/board") && method === "GET") {
          return new Response(JSON.stringify(initialData), { status: 200 });
        }
        if (url.endsWith("/api/ai/chat") && method === "POST") {
          return new Response("bad gateway", { status: 502 });
        }
        if (url.endsWith("/api/board") && method === "PUT") {
          return new Response(JSON.stringify(initialData), { status: 200 });
        }
        return Promise.reject(new Error(`Unhandled fetch URL in tests: ${url}`));
      }
    );

    render(<KanbanBoard />);
    await userEvent.click(await screen.findByTestId("ai-chat-launcher"));
    const input = await screen.findByTestId("ai-chat-input");
    await userEvent.type(input, "Move card-1");
    await userEvent.click(screen.getByRole("button", { name: /^send$/i }));

    expect(
      await screen.findByText("Request failed with status 502")
    ).toBeInTheDocument();
    expect(screen.getByTestId("ai-chat-input")).toHaveValue("Move card-1");
  });
});
