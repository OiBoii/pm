import json
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError


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
    return (
        "You are a Kanban assistant. Return ONLY valid JSON with keys "
        "`assistantResponse` and optional `mutations`.\n"
        "Mutation types allowed: create_card, edit_card, move_card.\n"
        "Use shape:\n"
        '{"assistantResponse":"...",'
        '"mutations":[{"type":"create_card","columnId":"...","title":"...","details":"...","position":0},'
        '{"type":"edit_card","cardId":"...","title":"...","details":"..."},'
        '{"type":"move_card","cardId":"...","toColumnId":"...","position":0}]}\n\n'
        f"Current board JSON:\n{json.dumps(board)}\n\n"
        f"Conversation history JSON:\n{json.dumps(history)}\n\n"
        f"User question:\n{question}"
    )


def parse_ai_structured_response(raw_text: str) -> AIStructuredResponseModel:
    try:
        parsed = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        raise ValueError("AI response did not contain valid JSON.") from exc

    try:
        return AIStructuredResponseModel.model_validate(parsed)
    except ValidationError as exc:
        raise ValueError(f"AI structured response validation failed: {exc}") from exc


def apply_kanban_mutations(
    board: dict[str, Any], mutations: list[MutationModel]
) -> tuple[dict[str, Any], list[dict[str, Any]], list[dict[str, Any]]]:
    updated = json.loads(json.dumps(board))
    applied: list[dict[str, Any]] = []
    ignored: list[dict[str, Any]] = []

    for mutation in mutations:
        if isinstance(mutation, CreateCardMutationModel):
            target = next(
                (column for column in updated.get("columns", []) if column.get("id") == mutation.column_id),
                None,
            )
            if target is None:
                ignored.append({"type": mutation.type, "reason": f"Unknown columnId: {mutation.column_id}"})
                continue
            next_id = _next_card_id(updated)
            updated["cards"][next_id] = {
                "id": next_id,
                "title": mutation.title,
                "details": mutation.details,
            }
            card_ids = target.setdefault("cardIds", [])
            index = len(card_ids) if mutation.position is None else max(0, min(mutation.position, len(card_ids)))
            card_ids.insert(index, next_id)
            applied.append({"type": mutation.type, "cardId": next_id, "columnId": mutation.column_id})
            continue

        if isinstance(mutation, EditCardMutationModel):
            card = updated.get("cards", {}).get(mutation.card_id)
            if not isinstance(card, dict):
                ignored.append({"type": mutation.type, "reason": f"Unknown cardId: {mutation.card_id}"})
                continue
            if mutation.title is not None:
                card["title"] = mutation.title
            if mutation.details is not None:
                card["details"] = mutation.details
            applied.append({"type": mutation.type, "cardId": mutation.card_id})
            continue

        if isinstance(mutation, MoveCardMutationModel):
            if mutation.card_id not in updated.get("cards", {}):
                ignored.append({"type": mutation.type, "reason": f"Unknown cardId: {mutation.card_id}"})
                continue
            target = next(
                (column for column in updated.get("columns", []) if column.get("id") == mutation.to_column_id),
                None,
            )
            if target is None:
                ignored.append(
                    {"type": mutation.type, "reason": f"Unknown toColumnId: {mutation.to_column_id}"}
                )
                continue
            for column in updated.get("columns", []):
                card_ids = column.get("cardIds", [])
                if mutation.card_id in card_ids:
                    card_ids.remove(mutation.card_id)
            target_ids = target.setdefault("cardIds", [])
            index = len(target_ids) if mutation.position is None else max(0, min(mutation.position, len(target_ids)))
            target_ids.insert(index, mutation.card_id)
            applied.append(
                {"type": mutation.type, "cardId": mutation.card_id, "toColumnId": mutation.to_column_id}
            )

    return updated, applied, ignored


def _next_card_id(board: dict[str, Any]) -> str:
    highest = 0
    for card_id in board.get("cards", {}).keys():
        if card_id.startswith("card-"):
            suffix = card_id[5:]
            if suffix.isdigit():
                highest = max(highest, int(suffix))
    return f"card-{highest + 1}"
