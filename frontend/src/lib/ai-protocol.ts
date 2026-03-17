import { z } from "zod";
import type { BoardData } from "./kanban";

export const ChatHistoryMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
}).strict();

export const AIChatRequestSchema = z.object({
  question: z.string(),
  history: z.array(ChatHistoryMessageSchema).default([]),
}).strict();

export type ChatHistoryMessage = z.infer<typeof ChatHistoryMessageSchema>;
export type AIChatRequest = z.infer<typeof AIChatRequestSchema>;

export const CreateCardMutationSchema = z.object({
  type: z.literal("create_card"),
  columnId: z.string(),
  title: z.string(),
  details: z.string(),
  position: z.number().optional(),
}).strict();

export const EditCardMutationSchema = z.object({
  type: z.literal("edit_card"),
  cardId: z.string(),
  title: z.string().optional(),
  details: z.string().optional(),
}).strict();

export const MoveCardMutationSchema = z.object({
  type: z.literal("move_card"),
  cardId: z.string(),
  toColumnId: z.string(),
  position: z.number().optional(),
}).strict();

export const MutationSchema = z.union([
  CreateCardMutationSchema,
  EditCardMutationSchema,
  MoveCardMutationSchema,
]);

export type MutationModel = z.infer<typeof MutationSchema>;

export const AIStructuredResponseSchema = z.object({
  assistantResponse: z.string(),
  mutations: z.array(MutationSchema).default([]),
}).strict();

export type AIStructuredResponseModel = z.infer<typeof AIStructuredResponseSchema>;

export function buildAiChatPrompt(
  board: BoardData,
  question: string,
  history: ChatHistoryMessage[]
): string {
  const targetShape = {
    assistantResponse: "string",
    mutations: [
      { type: "create_card", columnId: "string", title: "string", details: "string", position: 0 },
      { type: "edit_card", cardId: "string", title: "string", details: "string" },
      { type: "move_card", cardId: "string", toColumnId: "string", position: 0 },
    ],
  };

  return (
    "You are a project management assistant for a Kanban board.\n" +
    "Return ONLY strict JSON.\n" +
    "Do NOT include any helper keys like shape_examples.\n" +
    "Top-level keys must be exactly: assistantResponse, mutations.\n" +
    `Target shape:\n${JSON.stringify(targetShape)}\n\n` +
    "Rules:\n" +
    "- Always include assistantResponse.\n" +
    "- mutations is optional, but if present must only include valid create_card, edit_card, or move_card objects.\n" +
    "- Do not include markdown, explanations, or code fences.\n\n" +
    `Current board JSON:\n${JSON.stringify(board)}\n\n` +
    `Conversation history JSON:\n${JSON.stringify(history)}\n\n` +
    `User question:\n${question}`
  );
}

function extractJsonPayload(rawText: string): any {
  const stripped = rawText.trim();
  
  try {
    const parsed = JSON.parse(stripped);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed;
    }
  } catch (e) {
    // ignore
  }

  const fencedMatch = stripped.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (fencedMatch) {
    try {
      const parsed = JSON.parse(fencedMatch[1]);
      if (typeof parsed === "object" && parsed !== null) {
        return parsed;
      }
    } catch (e) {
      // ignore
    }
  }

  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start !== -1 && end !== -1 && start < end) {
    try {
      const parsed = JSON.parse(stripped.slice(start, end + 1));
      if (typeof parsed === "object" && parsed !== null) {
        return parsed;
      }
    } catch (e) {
      // ignore
    }
  }

  throw new Error("AI response did not contain a valid JSON object.");
}

function normalizePayload(payload: any): any {
  if (!payload || !Array.isArray(payload.mutations)) {
    return payload;
  }

  const normalizedMutations = payload.mutations.map((mutation: any) => {
    if (typeof mutation !== "object" || mutation === null) {
      return mutation;
    }

    const shapeExamples = mutation.shape_examples;
    const mutationType = mutation.type;

    if (
      typeof shapeExamples === "object" &&
      shapeExamples !== null &&
      typeof mutationType === "string" &&
      typeof shapeExamples[mutationType] === "object" &&
      shapeExamples[mutationType] !== null
    ) {
      return shapeExamples[mutationType];
    }

    return mutation;
  });

  return {
    ...payload,
    mutations: normalizedMutations,
  };
}

export function parseAiStructuredResponse(rawText: string): AIStructuredResponseModel {
  let payload = extractJsonPayload(rawText);
  payload = normalizePayload(payload);

  const result = AIStructuredResponseSchema.safeParse(payload);
  if (!result.success) {
    throw new Error(`AI structured response validation failed: ${result.error.message}`);
  }

  return result.data;
}

function columnExists(board: BoardData, columnId: string): boolean {
  return board.columns.some((col) => col.id === columnId);
}

function insertCardInColumn(
  board: BoardData,
  columnId: string,
  cardId: string,
  position?: number
): void {
  for (const column of board.columns) {
    if (column.id !== columnId) continue;
    
    if (!column.cardIds) {
      column.cardIds = [];
    }
    
    const existingIndex = column.cardIds.indexOf(cardId);
    if (existingIndex !== -1) {
      column.cardIds.splice(existingIndex, 1);
    }
    
    const index = position === undefined ? column.cardIds.length : Math.max(0, Math.min(position, column.cardIds.length));
    column.cardIds.splice(index, 0, cardId);
    return;
  }
}

function nextCardId(board: BoardData): string {
  let highest = 0;
  for (const cardId of Object.keys(board.cards || {})) {
    const match = cardId.match(/^card-(\d+)$/);
    if (match) {
      highest = Math.max(highest, parseInt(match[1], 10));
    }
  }
  return `card-${highest + 1}`;
}

export function applyKanbanMutations(
  board: BoardData,
  mutations: MutationModel[]
): {
  updatedBoard: BoardData;
  applied: any[];
  ignored: any[];
} {
  const updatedBoard: BoardData = JSON.parse(JSON.stringify(board));
  const applied: any[] = [];
  const ignored: any[] = [];

  if (!updatedBoard.cards) updatedBoard.cards = {};
  if (!updatedBoard.columns) updatedBoard.columns = [];

  for (const mutation of mutations) {
    if (mutation.type === "create_card") {
      if (!columnExists(updatedBoard, mutation.columnId)) {
        ignored.push({ type: mutation.type, reason: `Unknown columnId: ${mutation.columnId}` });
        continue;
      }
      
      const cardId = nextCardId(updatedBoard);
      updatedBoard.cards[cardId] = {
        id: cardId,
        title: mutation.title,
        details: mutation.details,
      };
      
      insertCardInColumn(updatedBoard, mutation.columnId, cardId, mutation.position);
      applied.push({ type: mutation.type, cardId, columnId: mutation.columnId });
      continue;
    }

    if (mutation.type === "edit_card") {
      const card = updatedBoard.cards[mutation.cardId];
      if (!card) {
        ignored.push({ type: mutation.type, reason: `Unknown cardId: ${mutation.cardId}` });
        continue;
      }
      
      if (mutation.title !== undefined) card.title = mutation.title;
      if (mutation.details !== undefined) card.details = mutation.details;
      
      applied.push({ type: mutation.type, cardId: mutation.cardId });
      continue;
    }

    if (mutation.type === "move_card") {
      if (!updatedBoard.cards[mutation.cardId]) {
        ignored.push({ type: mutation.type, reason: `Unknown cardId: ${mutation.cardId}` });
        continue;
      }
      if (!columnExists(updatedBoard, mutation.toColumnId)) {
        ignored.push({ type: mutation.type, reason: `Unknown toColumnId: ${mutation.toColumnId}` });
        continue;
      }

      for (const column of updatedBoard.columns) {
        if (column.cardIds) {
          const index = column.cardIds.indexOf(mutation.cardId);
          if (index !== -1) {
            column.cardIds.splice(index, 1);
          }
        }
      }

      insertCardInColumn(updatedBoard, mutation.toColumnId, mutation.cardId, mutation.position);
      applied.push({ type: mutation.type, cardId: mutation.cardId, toColumnId: mutation.toColumnId });
    }
  }

  return { updatedBoard, applied, ignored };
}
