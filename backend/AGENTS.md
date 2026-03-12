# Backend Notes

## Current scope (Part 2 scaffold)

- FastAPI app entrypoint at `backend/app/main.py`.
- Static hello page served at `/` from `backend/static/index.html`.
- Example API endpoint at `/api/hello`.
- Unit tests in `backend/tests/test_main.py`.
- Python dependencies and tooling declared in `backend/pyproject.toml`.

## Run model

- App runs in Docker from project root `Dockerfile`.
- Container starts `uvicorn app.main:app --host 0.0.0.0 --port 8000`.
- Dependency install inside Docker uses `uv` as package manager.