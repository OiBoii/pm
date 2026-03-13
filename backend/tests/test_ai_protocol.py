from app.ai_protocol import (
    apply_kanban_mutations,
    parse_ai_structured_response,
)
from app.board_data import INITIAL_BOARD


def test_parse_ai_structured_response_accepts_valid_payload() -> None:
    response = parse_ai_structured_response(
        '{"assistantResponse":"done","mutations":[{"type":"move_card","cardId":"card-1","toColumnId":"col-progress","position":0}]}'
    )
    assert response.assistant_response == "done"
    assert len(response.mutations) == 1


def test_parse_ai_structured_response_rejects_invalid_shape() -> None:
    try:
        parse_ai_structured_response('{"message":"wrong shape"}')
        assert False, "Expected parse failure"
    except ValueError as exc:
        assert "validation failed" in str(exc).lower()


def test_apply_kanban_mutations_supports_create_edit_move() -> None:
    board = INITIAL_BOARD
    structured = parse_ai_structured_response(
        """
        {
          "assistantResponse": "Applied requested updates.",
          "mutations": [
            {
              "type": "create_card",
              "columnId": "col-backlog",
              "title": "New card",
              "details": "New details"
            },
            {
              "type": "edit_card",
              "cardId": "card-1",
              "title": "Edited card 1"
            },
            {
              "type": "move_card",
              "cardId": "card-2",
              "toColumnId": "col-done",
              "position": 0
            }
          ]
        }
        """
    )
    updated, applied, ignored = apply_kanban_mutations(board, structured.mutations)

    assert len(applied) == 3
    assert ignored == []
    assert updated["cards"]["card-1"]["title"] == "Edited card 1"
    assert updated["columns"][4]["cardIds"][0] == "card-2"
    created = [entry for entry in applied if entry["type"] == "create_card"][0]
    created_id = created["cardId"]
    assert created_id in updated["cards"]


def test_apply_kanban_mutations_ignores_invalid_mutations() -> None:
    board = INITIAL_BOARD
    structured = parse_ai_structured_response(
        """
        {
          "assistantResponse": "Tried some updates.",
          "mutations": [
            {
              "type": "move_card",
              "cardId": "card-does-not-exist",
              "toColumnId": "col-done"
            }
          ]
        }
        """
    )
    updated, applied, ignored = apply_kanban_mutations(board, structured.mutations)
    assert applied == []
    assert len(ignored) == 1
    assert "unknown cardid" in ignored[0]["reason"].lower()
    assert updated == board
