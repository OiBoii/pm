import sqlite3
from pathlib import Path

from fastapi.testclient import TestClient

from app.ai_client import AIConfigError, AIRequestError
from app.main import create_app


def create_test_client(db_path: Path) -> TestClient:
    app = create_app(db_path=db_path)
    return TestClient(app)


def test_root_serves_static_html_page(tmp_path: Path) -> None:
    client = create_test_client(tmp_path / "root.db")
    response = client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "<html" in response.text.lower()


def test_api_hello_response(tmp_path: Path) -> None:
    client = create_test_client(tmp_path / "hello.db")
    response = client.get("/api/hello")
    assert response.status_code == 200
    assert response.json() == {
        "message": "hello from fastapi",
        "status": "ok",
    }


def test_board_is_seeded_on_first_read(tmp_path: Path) -> None:
    db_path = tmp_path / "pm.db"
    client = create_test_client(db_path)

    response = client.get("/api/board")
    assert response.status_code == 200
    payload = response.json()
    assert "columns" in payload
    assert "cards" in payload
    assert len(payload["columns"]) == 5


def test_write_board_persists_changes(tmp_path: Path) -> None:
    db_path = tmp_path / "pm.db"
    client = create_test_client(db_path)
    current = client.get("/api/board").json()
    current["columns"][0]["title"] = "Renamed Backlog"

    write_response = client.put("/api/board", json=current)
    assert write_response.status_code == 200
    assert write_response.json()["columns"][0]["title"] == "Renamed Backlog"

    read_back = client.get("/api/board")
    assert read_back.status_code == 200
    assert read_back.json()["columns"][0]["title"] == "Renamed Backlog"


def test_write_board_rejects_missing_card_references(tmp_path: Path) -> None:
    db_path = tmp_path / "pm.db"
    client = create_test_client(db_path)
    current = client.get("/api/board").json()
    current["columns"][0]["cardIds"].append("card-does-not-exist")

    response = client.put("/api/board", json=current)
    assert response.status_code == 400
    assert "missing card id" in response.json()["detail"].lower()


def test_database_file_and_tables_are_created(tmp_path: Path) -> None:
    db_path = tmp_path / "fresh.db"
    assert not db_path.exists()

    client = create_test_client(db_path)
    assert client.get("/api/board").status_code == 200
    assert db_path.exists()

    with sqlite3.connect(db_path) as conn:
        tables = {
            row[0]
            for row in conn.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table';"
            ).fetchall()
        }
    assert "users" in tables
    assert "boards" in tables


def test_ai_debug_endpoint_returns_connectivity_payload(
    tmp_path: Path, monkeypatch
) -> None:
    class StubOpenAIClient:
        def __init__(self) -> None:
            self.model = "gpt-4.1-mini"

        def chat_completion(self, prompt: str) -> str:
            assert "2+2" in prompt
            return "4"

    monkeypatch.setattr("app.main.OpenAIClient", StubOpenAIClient)

    client = create_test_client(tmp_path / "ai-debug.db")
    response = client.get("/api/ai/debug")
    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "model": "gpt-4.1-mini",
        "prompt": "2+2",
        "response": "4",
    }


def test_ai_debug_endpoint_returns_runtime_config_error(
    tmp_path: Path, monkeypatch
) -> None:
    class StubOpenAIClient:
        def __init__(self) -> None:
            self.model = "gpt-4.1-mini"

        def chat_completion(self, prompt: str) -> str:
            raise AIConfigError("missing key")

    monkeypatch.setattr("app.main.OpenAIClient", StubOpenAIClient)

    client = create_test_client(tmp_path / "ai-config-error.db")
    response = client.get("/api/ai/debug")
    assert response.status_code == 503
    assert response.json()["detail"] == "missing key"


def test_ai_debug_endpoint_returns_runtime_request_error(
    tmp_path: Path, monkeypatch
) -> None:
    class StubOpenAIClient:
        def __init__(self) -> None:
            self.model = "gpt-4.1-mini"

        def chat_completion(self, prompt: str) -> str:
            raise AIRequestError("upstream error")

    monkeypatch.setattr("app.main.OpenAIClient", StubOpenAIClient)

    client = create_test_client(tmp_path / "ai-request-error.db")
    response = client.get("/api/ai/debug")
    assert response.status_code == 502
    assert response.json()["detail"] == "upstream error"


def test_ai_chat_endpoint_applies_mutations_and_persists(
    tmp_path: Path, monkeypatch
) -> None:
    class StubOpenAIClient:
        def __init__(self) -> None:
            self.model = "gpt-4.1-mini"

        def chat_completion(self, prompt: str) -> str:
            assert "Current board JSON" in prompt
            assert "User question" in prompt
            return """
            {
              "assistantResponse": "Applied updates.",
              "mutations": [
                {
                  "type": "create_card",
                  "columnId": "col-backlog",
                  "title": "Create from AI",
                  "details": "Created by assistant"
                },
                {
                  "type": "edit_card",
                  "cardId": "card-1",
                  "title": "Edited by AI"
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

    monkeypatch.setattr("app.main.OpenAIClient", StubOpenAIClient)

    db_path = tmp_path / "ai-chat.db"
    client = create_test_client(db_path)
    response = client.post(
        "/api/ai/chat",
        json={
            "question": "Please create, edit, and move cards.",
            "history": [{"role": "assistant", "content": "Ready to help."}],
        },
    )
    assert response.status_code == 200
    payload = response.json()

    assert payload["assistantResponse"] == "Applied updates."
    assert len(payload["appliedMutations"]) == 3
    assert payload["ignoredMutations"] == []
    assert payload["board"]["cards"]["card-1"]["title"] == "Edited by AI"
    assert payload["board"]["columns"][4]["cardIds"][0] == "card-2"

    persisted = client.get("/api/board").json()
    assert persisted["cards"]["card-1"]["title"] == "Edited by AI"
    assert persisted["columns"][4]["cardIds"][0] == "card-2"


def test_ai_chat_endpoint_handles_invalid_model_output(
    tmp_path: Path, monkeypatch
) -> None:
    class StubOpenAIClient:
        def __init__(self) -> None:
            self.model = "gpt-4.1-mini"

        def chat_completion(self, prompt: str) -> str:
            _ = prompt
            return '{"assistant":"not matching schema"}'

    monkeypatch.setattr("app.main.OpenAIClient", StubOpenAIClient)

    client = create_test_client(tmp_path / "ai-chat-invalid.db")
    response = client.post("/api/ai/chat", json={"question": "hello", "history": []})
    assert response.status_code == 502
    assert "validation failed" in response.json()["detail"].lower()


def test_ai_chat_endpoint_non_mutation_response_keeps_board_same(
    tmp_path: Path, monkeypatch
) -> None:
    class StubOpenAIClient:
        def __init__(self) -> None:
            self.model = "gpt-4.1-mini"

        def chat_completion(self, prompt: str) -> str:
            _ = prompt
            return '{"assistantResponse":"No board changes needed.","mutations":[]}'

    monkeypatch.setattr("app.main.OpenAIClient", StubOpenAIClient)

    client = create_test_client(tmp_path / "ai-chat-no-mutations.db")
    before = client.get("/api/board").json()
    response = client.post(
        "/api/ai/chat",
        json={"question": "just summarize", "history": [{"role": "user", "content": "hi"}]},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["appliedMutations"] == []
    assert payload["ignoredMutations"] == []
    assert payload["assistantResponse"] == "No board changes needed."
    assert payload["board"] == before
