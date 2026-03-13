import { expect, test, type Page } from "@playwright/test";

const createSeedBoard = () => ({
  columns: [
    { id: "col-backlog", title: "Backlog", cardIds: ["card-1", "card-2"] },
    { id: "col-discovery", title: "Discovery", cardIds: ["card-3"] },
    { id: "col-progress", title: "In Progress", cardIds: ["card-4", "card-5"] },
    { id: "col-review", title: "Review", cardIds: ["card-6"] },
    { id: "col-done", title: "Done", cardIds: ["card-7", "card-8"] },
  ],
  cards: {
    "card-1": {
      id: "card-1",
      title: "Align roadmap themes",
      details: "Draft quarterly themes with impact statements and metrics.",
    },
    "card-2": {
      id: "card-2",
      title: "Gather customer signals",
      details: "Review support tags, sales notes, and churn feedback.",
    },
    "card-3": {
      id: "card-3",
      title: "Prototype analytics view",
      details: "Sketch initial dashboard layout and key drill-downs.",
    },
    "card-4": {
      id: "card-4",
      title: "Refine status language",
      details: "Standardize column labels and tone across the board.",
    },
    "card-5": {
      id: "card-5",
      title: "Design card layout",
      details: "Add hierarchy and spacing for scanning dense lists.",
    },
    "card-6": {
      id: "card-6",
      title: "QA micro-interactions",
      details: "Verify hover, focus, and loading states.",
    },
    "card-7": {
      id: "card-7",
      title: "Ship marketing page",
      details: "Final copy approved and asset pack delivered.",
    },
    "card-8": {
      id: "card-8",
      title: "Close onboarding sprint",
      details: "Document release notes and share internally.",
    },
  },
});

test.beforeEach(async ({ page }) => {
  let board = createSeedBoard();
  await page.route("**/api/board", async (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      await route.fulfill({ status: 200, json: board });
      return;
    }
    if (request.method() === "PUT") {
      board = request.postDataJSON();
      await route.fulfill({ status: 200, json: board });
      return;
    }
    await route.fulfill({ status: 405, body: "Method not allowed" });
  });

  await page.route("**/api/ai/chat", async (route) => {
    const request = route.request();
    if (request.method() !== "POST") {
      await route.fulfill({ status: 405, body: "Method not allowed" });
      return;
    }

    const payload = request.postDataJSON() as { question?: string };
    if (payload.question?.toLowerCase().includes("move card-1 to done")) {
      board = {
        ...board,
        columns: board.columns.map((column) => {
          if (column.id === "col-backlog") {
            return {
              ...column,
              cardIds: column.cardIds.filter((cardId) => cardId !== "card-1"),
            };
          }
          if (column.id === "col-done") {
            return {
              ...column,
              cardIds: ["card-1", ...column.cardIds.filter((cardId) => cardId !== "card-1")],
            };
          }
          return column;
        }),
      };
    }

    await route.fulfill({
      status: 200,
      json: {
        assistantResponse: "Applied requested board updates.",
        board,
        appliedMutations: [],
        ignoredMutations: [],
      },
    });
  });
});

const signIn = async (page: Page) => {
  await page.goto("/");
  await page.getByLabel("Username").fill("user");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: /sign in/i }).click();
};

test("loads the kanban board", async ({ page }) => {
  await signIn(page);
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
});

test("adds a card to a column", async ({ page }) => {
  await signIn(page);
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill("Playwright card");
  await firstColumn.getByPlaceholder("Details").fill("Added via e2e.");
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await expect(firstColumn.getByText("Playwright card")).toBeVisible();
});

test("moves a card between columns", async ({ page }) => {
  await signIn(page);
  const card = page.getByTestId("card-card-1");
  const targetColumn = page.getByTestId("column-col-review");
  const cardBox = await card.boundingBox();
  const columnBox = await targetColumn.boundingBox();
  if (!cardBox || !columnBox) {
    throw new Error("Unable to resolve drag coordinates.");
  }

  await page.mouse.move(
    cardBox.x + cardBox.width / 2,
    cardBox.y + cardBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    columnBox.x + columnBox.width / 2,
    columnBox.y + 120,
    { steps: 12 }
  );
  await page.mouse.up();
  await expect(targetColumn.getByTestId("card-card-1")).toBeVisible();
});

test("sends chat request and updates board from AI response", async ({ page }) => {
  await signIn(page);
  await page.getByTestId("ai-chat-launcher").click();
  await page.getByTestId("ai-chat-input").fill("Move card-1 to Done");
  await page.getByRole("button", { name: /^send$/i }).click();
  await expect(page.getByText("Applied requested board updates.")).toBeVisible();
  await expect(page.getByTestId("column-col-done").getByTestId("card-card-1")).toBeVisible();
});
