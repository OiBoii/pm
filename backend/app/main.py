from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
FRONTEND_BUILD_DIR = PROJECT_ROOT / "frontend" / "out"


def resolve_static_dir() -> Path:
    if FRONTEND_BUILD_DIR.exists():
        return FRONTEND_BUILD_DIR
    return BACKEND_STATIC_DIR


def create_app() -> FastAPI:
    app = FastAPI(title="Project Management MVP API")

    @app.get("/api/hello")
    def read_hello() -> dict[str, str]:
        return {
            "message": "hello from fastapi",
            "status": "ok",
        }

    # Mount static app at root so built frontend assets and index are served.
    app.mount("/", StaticFiles(directory=resolve_static_dir(), html=True), name="frontend")
    return app


app = create_app()
