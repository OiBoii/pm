# Backend Notes

## Current scope (Part 2 scaffold)

- FastAPI app entrypoint at `backend/app/main.py`.
- Root `/` serves static files via `StaticFiles` with `html=True`.
- Static source priority:
  - `frontend/out` (when a frontend static build exists)
  - fallback: `backend/static`
- Example API endpoint at `/api/hello`.
- Kanban persistence endpoints:
  - `GET /api/board`
  - `PUT /api/board`
- Unit tests in `backend/tests/test_main.py`.
- Python dependencies and tooling declared in `backend/pyproject.toml`.
- SQLite persistence layer:
  - `backend/app/db.py` initializes DB/tables and reads/writes board JSON.
  - `backend/app/board_data.py` defines initial seeded board.
  - `backend/app/models.py` defines request/response payload models.

## Run model

- App runs in Docker from project root `Dockerfile`.
- Dockerfile is multi-stage and builds frontend static assets before runtime image.
- Container starts `uvicorn app.main:app --host 0.0.0.0 --port 8000`.
- Dependency install inside Docker uses `uv` as package manager.