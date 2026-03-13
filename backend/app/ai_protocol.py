import json
import re
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError

MutationType = Literal["create_card", "edit_card", "move_card"]


class ChatHistoryMessageModel(BaseModel):
    role: Literal["user", "assistant"]
    content: str

    model_config = ConfigDict(extra="forbid")


class AIChatRequestModel(BaseModel):
    question: str
    history: list[ChatHistoryMessageModel] = Field(default_factory=list)

    model_config = ConfigDict(extra="forbid")


class CreateCardMutationModel(BaseModel):
    type: Literal["create_card"]
    column_id: str = Field(alias="columnId")
    title: str
    details: str
    position: int | None = None

    model_config = ConfigDict(populate_by_name=True, extra="forbid")


class EditCardMutationModel(BaseModel):
    type: Literal["edit_card"]
    card_id: str = Field(alias="cardId")
    title: str | None = None
    details: str | None = None

    model_config = ConfigDict(populate_by_name=True, extra="forbid")


class MoveCardMutationModel(BaseModel):
    type: Literal["move_card"]
    card_id: str = Field(alias="cardId")
    to_column_id: str = Field(alias="toColumnId")
    position: int | None = None

    model_config = ConfigDict(populate_by_name=True, extra="forbid")


MutationModel = CreateCardMutationModel | EditCardMutationModel | MoveCardMutationModel


class AIStructuredResponseModel(BaseModel):
    assistant_response: str = Field(alias="assistantResponse")
    mutations: list[MutationModel] = Field(default_factory=list)

    model_config = ConfigDict(populate_by_name=True, extra="forbid")


def build_ai_chat_prompt(
    board: dict[str, Any],
    question: str,
    history: list[dict[str, str]],
) -> str:
    schema = {
        "assistantResponse": "string",
        "mutations": [
            {
                "type": "create_card | edit_card | move_card",
                "shape_examples": {
                    "create_card": {
                        "type": "create_card",
                        "columnId": "col-backlog",
                        "title": "New task",
                        "details": "Task details",
                        "position": 0,
                    },
                    "edit_card": {
                        "type": "edit_card",
                        "cardId": "card-1",
                        "title": "Updated title",
                        "details": "Updated details",
                    },
                    "move_card": {
                        "type": "move_card",
                        "cardId": "card-1",
                        "toColumnId": "col-progress",
                        "position": 0,
                    },
                },
            }
        ],
    }
    return (
        "You are a project management assistant for a Kanban board.\n"
        "Return ONLY strict JSON with this exact shape and keys:\n"
        f"{json.dumps(schema)}\n\n"
        "Rules:\n"
        "- Always include assistantResponse.\n"
        "- mutations is optional, but if present must only include valid create_card, edit_card, or move_card objects.\n"
        "- Do not include markdown, explanations, or code fences.\n\n"
        f"Current board JSON:\n{json.dumps(board)}\n\n"
        f"Conversation history JSON:\n{json.dumps(history)}\n\n"
        f"User question:\n{question}"
    )


def parse_ai_structured_response(raw_text: str) -> AIStructuredResponseModel:
    payload = _extract_json_payload(raw_text)
    try:
        return AIStructuredResponseModel.model_validate(payload)
    except ValidationError as exc:
        raise ValueError(f"AI structured response validation failed: {exc}") from exc


def _extract_json_payload(raw_text: str) -> dict[str, Any]:
    stripped = raw_text.strip()
    try:
        parsed = json.loads(stripped)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    fenced_match = re.search(r"```(?:json)?\s*(\{.*\})\s*```", stripped, re.DOTALL)
    if fenced_match:
        candidate = fenced_match.group(1)
        parsed = json.loads(candidate)
        if isinstance(parsed, dict):
            return parsed

    start = stripped.find("{")
    end = stripped.rfind("}")
    if start != -1 and end != -1 and start < end:
        candidate = stripped[start : end + 1]
        parsed = json.loads(candidate)
        if isinstance(parsed, dict):
            return parsed

    raise ValueError("AI response did not contain a valid JSON object.")


def apply_kanban_mutations(
    board: dict[str, Any], mutations: list[MutationModel]
) -> tuple[dict[str, Any], list[dict[str, Any]], list[dict[str, Any]]]:
    updated_board = json.loads(json.dumps(board))
    applied: list[dict[str, Any]] = []
    ignored: list[dict[str, Any]] = []

    for mutation in mutations:
        if isinstance(mutation, CreateCardMutationModel):
            if not _column_exists(updated_board, mutation.column_id):
                ignored.append(
                    {
                        "type": mutation.type,
                        "reason": f"Unknown columnId: {mutation.column_id}",
                    }
                )
                continue
            card_id = _next_card_id(updated_board)
            updated_board["cards"][card_id] = {
                "id": card_id,
                "title": mutation.title,
                "details": mutation.details,
            }
            _insert_card_in_column(
                updated_board,
                mutation.column_id,
                card_id,
                mutation.position,
            )
            applied.append(
                {
                    "type": mutation.type,
                    "cardId": card_id,
                    "columnId": mutation.column_id,
                }
            )
            continue

        if isinstance(mutation, EditCardMutationModel):
            card = updated_board.get("cards", {}).get(mutation.card_id)
            if not isinstance(card, dict):
                ignored.append(
                    {
                        "type": mutation.type,
                        "reason": f"Unknown cardId: {mutation.card_id}",
                    }
                )
                continue
            if mutation.title is not None:
                card["title"] = mutation.title
            if mutation.details is not None:
                card["details"] = mutation.details
            applied.append({"type": mutation.type, "cardId": mutation.card_id})
            continue

        if isinstance(mutation, MoveCardMutationModel):
            if mutation.card_id not in updated_board.get("cards", {}):
                ignored.append(
                    {
                        "type": mutation.type,
                        "reason": f"Unknown cardId: {mutation.card_id}",
                    }
                )
                continue
            if not _column_exists(updated_board, mutation.to_column_id):
                ignored.append(
                    {
                        "type": mutation.type,
                        "reason": f"Unknown toColumnId: {mutation.to_column_id}",
                    }
                )
                continue

            for column in updated_board.get("columns", []):
                card_ids = column.get("cardIds", [])
                if mutation.card_id in card_ids:
                    card_ids.remove(mutation.card_id)

            _insert_card_in_column(
                updated_board,
                mutation.to_column_id,
                mutation.card_id,
                mutation.position,
            )
            applied.append(
                {
                    "type": mutation.type,
                    "cardId": mutation.card_id,
                    "toColumnId": mutation.to_column_id,
                }
            )

    return updated_board, applied, ignored


def _column_exists(board: dict[str, Any], column_id: str) -> bool:
    return any(column.get("id") == column_id for column in board.get("columns", []))


def _insert_card_in_column(
    board: dict[str, Any], column_id: str, card_id: str, position: int | None
) -> None:
    for column in board.get("columns", []):
        if column.get("id") != column_id:
            continue
        card_ids = column.setdefault("cardIds", [])
        if card_id in card_ids:
            card_ids.remove(card_id)
        index = len(card_ids) if position is None else max(0, min(position, len(card_ids)))
        card_ids.insert(index, card_id)
        return


def _next_card_id(board: dict[str, Any]) -> str:
    highest = 0
    for card_id in board.get("cards", {}).keys():
        match = re.fullmatch(r"card-(\d+)", card_id)
        if match:
            highest = max(highest, int(match.group(1)))
    return f"card-{highest + 1}"
