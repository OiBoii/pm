import json
import sqlite3
from pathlib import Path
from typing import Any

from app.board_data import INITIAL_BOARD

MVP_USERNAME = "user"


def init_db(db_path: Path) -> None:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(db_path) as conn:
        conn.execute("PRAGMA foreign_keys = ON;")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              username TEXT NOT NULL UNIQUE,
              created_at TEXT NOT NULL DEFAULT (datetime('now')),
              updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS boards (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL UNIQUE,
              board_json TEXT NOT NULL,
              schema_version INTEGER NOT NULL DEFAULT 1,
              created_at TEXT NOT NULL DEFAULT (datetime('now')),
              updated_at TEXT NOT NULL DEFAULT (datetime('now')),
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            """
        )
        user_id = _ensure_user(conn, MVP_USERNAME)
        _ensure_board(conn, user_id)
        conn.commit()


def get_board(db_path: Path, username: str = MVP_USERNAME) -> dict[str, Any]:
    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON;")
        user_id = _ensure_user(conn, username)
        _ensure_board(conn, user_id)
        row = conn.execute(
            "SELECT board_json FROM boards WHERE user_id = ?;",
            (user_id,),
        ).fetchone()
        conn.commit()
    if not row:
        return INITIAL_BOARD
    return json.loads(row["board_json"])


def update_board(db_path: Path, board: dict[str, Any], username: str = MVP_USERNAME) -> dict[str, Any]:
    board_json = json.dumps(board, separators=(",", ":"))
    with sqlite3.connect(db_path) as conn:
        conn.execute("PRAGMA foreign_keys = ON;")
        user_id = _ensure_user(conn, username)
        conn.execute(
            """
            INSERT INTO boards (user_id, board_json, schema_version, created_at, updated_at)
            VALUES (?, ?, 1, datetime('now'), datetime('now'))
            ON CONFLICT(user_id) DO UPDATE SET
              board_json = excluded.board_json,
              updated_at = datetime('now');
            """,
            (user_id, board_json),
        )
        conn.commit()
    return board


def _ensure_user(conn: sqlite3.Connection, username: str) -> int:
    conn.execute(
        """
        INSERT INTO users (username, created_at, updated_at)
        VALUES (?, datetime('now'), datetime('now'))
        ON CONFLICT(username) DO UPDATE SET updated_at = datetime('now');
        """,
        (username,),
    )
    row = conn.execute("SELECT id FROM users WHERE username = ?;", (username,)).fetchone()
    if not row:
        raise RuntimeError("Unable to find or create user.")
    return int(row[0])


def _ensure_board(conn: sqlite3.Connection, user_id: int) -> None:
    board_json = json.dumps(INITIAL_BOARD, separators=(",", ":"))
    conn.execute(
        """
        INSERT INTO boards (user_id, board_json, schema_version, created_at, updated_at)
        VALUES (?, ?, 1, datetime('now'), datetime('now'))
        ON CONFLICT(user_id) DO NOTHING;
        """,
        (user_id, board_json),
    )
