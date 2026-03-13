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
- AI connectivity debug endpoint:
  - `GET /api/ai/debug` (OpenAI `2+2` connectivity check)
- AI chat endpoint:
  - `POST /api/ai/chat` (structured assistant response + optional board mutations)
- Unit tests in `backend/tests/test_main.py`.
- Python dependencies and tooling declared in `backend/pyproject.toml`.
- SQLite persistence layer:
  - `backend/app/db.py` initializes DB/tables and reads/writes board JSON.
  - `backend/app/board_data.py` defines initial seeded board.
  - `backend/app/models.py` defines request/response payload models.
- OpenAI client:
  - `backend/app/ai_client.py` sends chat completions to OpenAI.
  - Reads API key from `OPENAI_API_KEY`.
  - Uses `gpt-4.1-mini` by default (override with `OPENAI_MODEL`).
- AI protocol and mutation logic:
  - `backend/app/ai_protocol.py` defines request/response schema and safe mutation application.
  - Supported mutation types: `create_card`, `edit_card`, `move_card`.
  - Invalid mutations are ignored with reasons; valid mutations persist.

## Run model

- App runs in Docker from project root `Dockerfile`.
- Dockerfile is multi-stage and builds frontend static assets before runtime image.
- Container starts `uvicorn app.main:app --host 0.0.0.0 --port 8000`.
- Dependency install inside Docker uses `uv` as package manager.