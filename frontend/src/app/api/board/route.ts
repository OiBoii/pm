import { NextResponse } from "next/server";
import { getBoard, updateBoard } from "@/lib/db";
import type { BoardData } from "@/lib/kanban";

export async function GET() {
  try {
    const board = await getBoard();
    return NextResponse.json(board);
  } catch (error) {
    console.error("Failed to fetch board:", error);
    return NextResponse.json(
      { detail: "Failed to fetch board data" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const boardData = (await request.json()) as BoardData;
    
    // Basic validation
    if (!boardData || !boardData.columns || !boardData.cards) {
      return NextResponse.json(
        { detail: "Invalid board data payload" },
        { status: 400 }
      );
    }
    
    // Validate integrity (similar to backend)
    for (const column of boardData.columns) {
      for (const cardId of column.cardIds || []) {
        if (!boardData.cards[cardId]) {
          return NextResponse.json(
            { detail: `Column references missing card id: ${cardId}` },
            { status: 400 }
          );
        }
      }
    }

    const updatedBoard = await updateBoard(boardData);
    return NextResponse.json(updatedBoard);
  } catch (error) {
    console.error("Failed to update board:", error);
    return NextResponse.json(
      { detail: "Failed to update board data" },
      { status: 500 }
    );
  }
}
