# Project Management MVP Delivery Plan

This plan turns the high-level roadmap into implementation-ready steps.

Guiding constraints from `AGENTS.md`:
- Keep the MVP simple and avoid over-engineering.
- Use Next.js frontend + FastAPI backend in one Dockerized local setup.
- Use SQLite (create DB if missing) and support multi-user schema shape for future.
- Add moderate tests: core happy paths + key edge/error cases.
- Keep docs concise and request user approval at required gates.

## Current implementation status

- Parts 1-7: completed.
- Parts 8-10: not started.
- Approval gates completed:
  - Gate 1 (rewritten plan): completed.
  - Gate 2 (DB schema sign-off for Part 5): completed.
  - Gate 3 (AI structured schema validation): pending (Part 9).

Key decisions captured during implementation:
- Auth/session separation is enforced: auth gate owns login/logout/session, Kanban board remains domain-only.
- Drag/drop uses explicit column drop zones and container-aware collision handling for reliable empty/full-column behavior.
- Backend persistence is source of truth for board state:
  - `GET /api/board` for load
  - `PUT /api/board` for save
- Frontend uses minimal loading/save error states and persists board mutations to backend.

## Part 1: Plan and Documentation Baseline

### Checklist
- [x] Rewrite this file (`docs/PLAN.md`) with detailed checklists, tests, and success criteria for all parts.
- [x] Create `frontend/AGENTS.md` to document the existing frontend architecture and behavior.
- [x] Request user review/approval before beginning implementation parts.

### Tests
- [x] Manual doc quality check: each part includes implementation steps, tests, and success criteria.
- [x] Manual consistency check with root `AGENTS.md` requirements.

### Success criteria
- [x] The plan is explicit enough to execute without guessing.
- [x] `frontend/AGENTS.md` accurately describes current code.
- [x] User explicitly approves the plan to proceed.

## Part 2: Scaffolding (Docker + FastAPI + scripts)

### Checklist
- [x] Add backend scaffold in `backend/` with FastAPI app entrypoint.
- [x] Add Docker setup to run the app locally in one container.
- [x] Configure Python dependency management with `uv` in container flow.
- [x] Add start/stop scripts for Mac, Windows, and Linux under `scripts/`.
- [x] Serve example static HTML at `/` and at least one example API endpoint.
- [x] Add concise run notes in docs.

### Tests
- [x] Backend unit test for example API route (status + response shape).
- [x] Container smoke test: service starts and routes respond.
- [x] Script sanity checks (Linux execution tested directly; Mac/Windows scripts validated for correct commands and paths).

### Success criteria
- [x] Running startup script launches the app locally in Docker.
- [x] `/` returns example HTML and API route responds correctly.
- [x] Setup is repeatable from a clean environment.

## Part 3: Serve Built Frontend via Backend

### Checklist
- [x] Configure frontend static build output for backend serving.
- [x] Update FastAPI static serving so `/` shows the existing Kanban UI.
- [x] Ensure static routing and API routing do not conflict.
- [x] Keep config minimal and local-first.

### Tests
- [x] Frontend unit tests continue passing after build/serve wiring.
- [x] Integration test: backend-served `/` contains Kanban heading and board columns.

### Success criteria
- [x] Opening `/` shows the existing Kanban app served through backend.
- [x] No broken asset paths in browser console for local run.

## Part 4: Fake Sign-In Experience

### Checklist
- [x] Add login page/gate for unauthenticated users.
- [x] Implement hardcoded credential check (`user` / `password`).
- [x] Add logout action that returns user to login gate.
- [x] Keep implementation intentionally lightweight for MVP.

### Tests
- [x] Unit tests: valid login succeeds, invalid login fails with clear message.
- [x] Unit tests: logout clears authenticated state.
- [x] Integration test: user cannot access board before login.

### Success criteria
- [x] Board is visible only after successful login.
- [x] Logout consistently returns user to login screen.

## Part 5: Database Modeling (Proposal + Sign-Off)

### Checklist
- [x] Propose SQLite schema for users and one board per user (future-ready for multiple users).
- [x] Represent board payload as JSON with minimal required metadata.
- [x] Document schema and initialization approach in `docs/`.
- [x] Request and obtain explicit user sign-off before implementing persistence layer details.

### Tests
- [x] Add schema validation tests for board JSON assumptions.
- [x] Add first-run initialization test (DB/tables created when missing).

### Success criteria
- [x] Schema and JSON contract are documented and approved.
- [x] Initialization behavior is clear and testable.

## Part 6: Backend Kanban API

### Checklist
- [x] Add backend routes to read and modify Kanban data for the signed-in user.
- [x] Implement persistence layer using SQLite.
- [x] Ensure DB is created automatically if missing.
- [x] Add concise error handling for invalid payloads and missing records.
- [x] Document API request/response shapes.

### Tests
- [x] Backend unit tests for repository/service logic.
- [x] API tests for happy paths (read/update) and key invalid inputs.
- [x] Persistence tests across restart (write, restart, read).

### Success criteria
- [x] Backend can reliably persist and return the user board.
- [x] Invalid inputs fail predictably with non-200 responses.

## Part 7: Connect Frontend to Backend Persistence

### Checklist
- [x] Replace in-memory frontend board source with backend API reads/writes.
- [x] Keep drag/drop and edit flows working with persisted data.
- [x] Add minimal loading and error states.
- [x] Ensure refresh reloads the latest saved board state.

### Tests
- [x] Frontend tests for initial load, update, and error fallback behavior.
- [x] Integration test: mutate board, reload, and verify persistence.

### Success criteria
- [x] Board state is persistent rather than demo-only memory state.
- [x] Core board interactions remain smooth and reliable.

## Part 8: AI Connectivity via OpenAI

### Checklist
- [x] Add backend AI client integration via OpenAI.
- [x] Configure model usage through `OPENAI_MODEL` (default `gpt-4.1-mini`).
- [x] Load API key/config from environment variables using `OPENAI_API_KEY`.
- [x] Add a dedicated backend test/debug endpoint for a simple connectivity check flow (`2+2`).
- [x] Do not run AI connectivity checks at app startup.
- [x] Keep startup allowed even if AI env vars are missing.

### Tests
- [x] Unit tests with mocked AI client responses.
- [ ] Optional live connectivity smoke check through the debug endpoint when env vars are present.

### Success criteria
- [ ] Backend can make a successful AI call and parse a valid response.
- [x] Missing/invalid AI config produces a clear runtime error only when the AI endpoint is called.
- [x] Part 8 stays limited to client wiring + debug verification endpoint (structured output/chat protocol remains in Parts 9-10).

## Part 9: Structured Output Protocol for Board Updates

### Checklist
- [x] Define one structured output schema containing:
  - [x] assistant text response
  - [x] optional Kanban mutation instructions
- [x] Send board JSON + user question + conversation history to AI request.
- [x] Validate AI output strictly against the schema.
- [x] Apply valid mutations; ignore/handle invalid mutations safely.
- [x] Document schema/protocol in docs.

### Tests
- [x] Schema validation tests: valid, malformed, and partial outputs.
- [x] Mutation tests: create/edit/move operations update board correctly.
- [x] Regression tests: non-mutation responses do not change board.

### Success criteria
- [x] AI output is consistently parseable.
- [x] Valid structured mutations reliably update persisted board state.

## Part 10: AI Sidebar in Frontend

### Checklist
- [ ] Add sidebar chat UI integrated into the board page.
- [ ] Render conversation history and submit user prompts.
- [ ] Wire chat requests to backend AI endpoint.
- [ ] Apply backend-confirmed board updates and refresh UI automatically.
- [ ] Keep styling aligned with project color scheme in `AGENTS.md`.

### Tests
- [ ] Component tests for chat input/send/render/error states.
- [ ] Integration test: AI response updates cards/columns and UI reflects change.

### Success criteria
- [ ] User can chat in sidebar and receive responses.
- [ ] AI-triggered board updates appear without manual page refresh.

## Cross-cutting checks (all implementation parts)

### Checklist
- [ ] Run lint and relevant tests at each part completion.
- [ ] Keep changes focused to requested scope only.
- [ ] Update docs only where needed and keep wording concise.
- [ ] Root-cause issues before applying fixes.

### Done definition for each part
- [ ] Checklist complete.
- [ ] Part-specific tests pass.
- [ ] Success criteria met.
- [ ] Any required approval gate is satisfied.