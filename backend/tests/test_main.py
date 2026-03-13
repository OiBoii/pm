import sqlite3
from pathlib import Path

from fastapi.testclient import TestClient

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
