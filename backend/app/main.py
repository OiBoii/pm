from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse

app = FastAPI(title="Project Management MVP API")

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
HELLO_PAGE = STATIC_DIR / "index.html"


@app.get("/")
def read_root() -> FileResponse:
    return FileResponse(HELLO_PAGE)


@app.get("/api/hello")
def read_hello() -> dict[str, str]:
    return {
        "message": "hello from fastapi",
        "status": "ok",
    }
