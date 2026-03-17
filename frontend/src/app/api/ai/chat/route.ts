import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getBoard, updateBoard } from "@/lib/db";
import {
  AIChatRequestSchema,
  buildAiChatPrompt,
  parseAiStructuredResponse,
  applyKanbanMutations,
} from "@/lib/ai-protocol";

const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";

function validateBoardIntegrity(board: any) {
  const cards = board.cards || {};
  for (const column of board.columns || []) {
    for (const cardId of column.cardIds || []) {
      if (!cards[cardId]) {
        throw new Error(`Column references missing card id: ${cardId}`);
      }
    }
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payloadResult = AIChatRequestSchema.safeParse(body);
    
    if (!payloadResult.success) {
      return NextResponse.json(
        { detail: `Invalid request payload: ${payloadResult.error.message}` },
        { status: 400 }
      );
    }
    
    const payload = payloadResult.data;
    const currentBoard = await getBoard();
    
    const prompt = buildAiChatPrompt(
      currentBoard,
      payload.question,
      payload.history
    );

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { detail: "Missing API key for OpenAI. Set OPENAI_API_KEY." },
        { status: 503 }
      );
    }

    const openai = new OpenAI({
      apiKey,
      baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
    });

    const model = process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL;
    
    let rawResponse = "";
    try {
      const completion = await openai.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
      });
      rawResponse = completion.choices[0]?.message?.content || "";
    } catch (error: any) {
      const detail = error.message || String(error);
      if (error.status === 400 && detail.toLowerCase().includes("invalid model")) {
        return NextResponse.json(
          { detail: `OpenAI rejected model '${model}'. Set OPENAI_MODEL to a valid model (for example: gpt-4.1-mini). Raw response: ${detail}` },
          { status: 502 }
        );
      }
      return NextResponse.json(
        { detail: `OpenAI request failed: ${detail}` },
        { status: 502 }
      );
    }

    if (!rawResponse) {
      return NextResponse.json(
        { detail: "OpenAI response missing assistant text content." },
        { status: 502 }
      );
    }

    let structured;
    try {
      structured = parseAiStructuredResponse(rawResponse);
    } catch (error: any) {
      return NextResponse.json(
        { detail: error.message },
        { status: 502 }
      );
    }

    const { updatedBoard, applied, ignored } = applyKanbanMutations(
      currentBoard,
      structured.mutations
    );

    try {
      validateBoardIntegrity(updatedBoard);
    } catch (error: any) {
      return NextResponse.json(
        { detail: `Board integrity validation failed: ${error.message}` },
        { status: 500 }
      );
    }

    if (applied.length > 0) {
      await updateBoard(updatedBoard);
    }

    return NextResponse.json({
      assistantResponse: structured.assistantResponse,
      board: updatedBoard,
      appliedMutations: applied,
      ignoredMutations: ignored,
    });
  } catch (error: any) {
    console.error("AI chat error:", error);
    return NextResponse.json(
      { detail: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
