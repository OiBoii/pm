import os
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles

from app.db import MVP_USERNAME, get_board, init_db, update_board
from app.models import BoardModel

PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
FRONTEND_BUILD_DIR = PROJECT_ROOT / "frontend" / "out"
DEFAULT_DB_PATH = PROJECT_ROOT / "backend" / "data" / "pm.db"


def resolve_static_dir() -> Path:
    if FRONTEND_BUILD_DIR.exists():
        return FRONTEND_BUILD_DIR
    return BACKEND_STATIC_DIR


def _resolve_db_path(db_path: Path | None = None) -> Path:
    if db_path:
        return db_path
    configured = os.getenv("PM_DB_PATH")
    if configured:
        return Path(configured)
    return DEFAULT_DB_PATH


def _validate_board_integrity(board: dict[str, Any]) -> None:
    cards = board.get("cards", {})
    for column in board.get("columns", []):
        for card_id in column.get("cardIds", []):
            if card_id not in cards:
                raise HTTPException(
                    status_code=400,
                    detail=f"Column references missing card id: {card_id}",
                )


def create_app(db_path: Path | None = None) -> FastAPI:
    resolved_db_path = _resolve_db_path(db_path)
    init_db(resolved_db_path)
    app = FastAPI(title="Project Management MVP API")

    @app.get("/api/hello")
    def read_hello() -> dict[str, str]:
        return {
            "message": "hello from fastapi",
            "status": "ok",
        }

    @app.get("/api/board")
    def read_board() -> dict[str, Any]:
        return get_board(resolved_db_path, MVP_USERNAME)

    @app.put("/api/board")
    def write_board(payload: BoardModel) -> dict[str, Any]:
        board = payload.model_dump(by_alias=True)
        _validate_board_integrity(board)
        return update_board(resolved_db_path, board, MVP_USERNAME)

    app.mount("/", StaticFiles(directory=resolve_static_dir(), html=True), name="frontend")
    return app


app = create_app()
