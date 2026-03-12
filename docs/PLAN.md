# Project Management MVP Delivery Plan

This plan turns the high-level roadmap into implementation-ready steps.

Guiding constraints from `AGENTS.md`:
- Keep the MVP simple and avoid over-engineering.
- Use Next.js frontend + FastAPI backend in one Dockerized local setup.
- Use SQLite (create DB if missing) and support multi-user schema shape for future.
- Add moderate tests: core happy paths + key edge/error cases.
- Keep docs concise and request user approval at required gates.

## Part 1: Plan and Documentation Baseline

### Checklist
- [ ] Rewrite this file (`docs/PLAN.md`) with detailed checklists, tests, and success criteria for all parts.
- [ ] Create `frontend/AGENTS.md` to document the existing frontend architecture and behavior.
- [ ] Request user review/approval before beginning implementation parts.

### Tests
- [ ] Manual doc quality check: each part includes implementation steps, tests, and success criteria.
- [ ] Manual consistency check with root `AGENTS.md` requirements.

### Success criteria
- [ ] The plan is explicit enough to execute without guessing.
- [ ] `frontend/AGENTS.md` accurately describes current code.
- [ ] User explicitly approves the plan to proceed.

## Part 2: Scaffolding (Docker + FastAPI + scripts)

### Checklist
- [ ] Add backend scaffold in `backend/` with FastAPI app entrypoint.
- [ ] Add Docker setup to run the app locally in one container.
- [ ] Configure Python dependency management with `uv` in container flow.
- [ ] Add start/stop scripts for Mac, Windows, and Linux under `scripts/`.
- [ ] Serve example static HTML at `/` and at least one example API endpoint.
- [ ] Add concise run notes in docs.

### Tests
- [ ] Backend unit test for example API route (status + response shape).
- [ ] Container smoke test: service starts and routes respond.
- [ ] Script sanity checks (Linux execution tested directly; Mac/Windows scripts validated for correct commands and paths).

### Success criteria
- [ ] Running startup script launches the app locally in Docker.
- [ ] `/` returns example HTML and API route responds correctly.
- [ ] Setup is repeatable from a clean environment.

## Part 3: Serve Built Frontend via Backend

### Checklist
- [ ] Configure frontend static build output for backend serving.
- [ ] Update FastAPI static serving so `/` shows the existing Kanban UI.
- [ ] Ensure static routing and API routing do not conflict.
- [ ] Keep config minimal and local-first.

### Tests
- [ ] Frontend unit tests continue passing after build/serve wiring.
- [ ] Integration test: backend-served `/` contains Kanban heading and board columns.

### Success criteria
- [ ] Opening `/` shows the existing Kanban app served through backend.
- [ ] No broken asset paths in browser console for local run.

## Part 4: Fake Sign-In Experience

### Checklist
- [ ] Add login page/gate for unauthenticated users.
- [ ] Implement hardcoded credential check (`user` / `password`).
- [ ] Add logout action that returns user to login gate.
- [ ] Keep implementation intentionally lightweight for MVP.

### Tests
- [ ] Unit tests: valid login succeeds, invalid login fails with clear message.
- [ ] Unit tests: logout clears authenticated state.
- [ ] Integration test: user cannot access board before login.

### Success criteria
- [ ] Board is visible only after successful login.
- [ ] Logout consistently returns user to login screen.

## Part 5: Database Modeling (Proposal + Sign-Off)

### Checklist
- [ ] Propose SQLite schema for users and one board per user (future-ready for multiple users).
- [ ] Represent board payload as JSON with minimal required metadata.
- [ ] Document schema and initialization approach in `docs/`.
- [ ] Request and obtain explicit user sign-off before implementing persistence layer details.

### Tests
- [ ] Add schema validation tests for board JSON assumptions.
- [ ] Add first-run initialization test (DB/tables created when missing).

### Success criteria
- [ ] Schema and JSON contract are documented and approved.
- [ ] Initialization behavior is clear and testable.

## Part 6: Backend Kanban API

### Checklist
- [ ] Add backend routes to read and modify Kanban data for the signed-in user.
- [ ] Implement persistence layer using SQLite.
- [ ] Ensure DB is created automatically if missing.
- [ ] Add concise error handling for invalid payloads and missing records.
- [ ] Document API request/response shapes.

### Tests
- [ ] Backend unit tests for repository/service logic.
- [ ] API tests for happy paths (read/update) and key invalid inputs.
- [ ] Persistence tests across restart (write, restart, read).

### Success criteria
- [ ] Backend can reliably persist and return the user board.
- [ ] Invalid inputs fail predictably with non-200 responses.

## Part 7: Connect Frontend to Backend Persistence

### Checklist
- [ ] Replace in-memory frontend board source with backend API reads/writes.
- [ ] Keep drag/drop and edit flows working with persisted data.
- [ ] Add minimal loading and error states.
- [ ] Ensure refresh reloads the latest saved board state.

### Tests
- [ ] Frontend tests for initial load, update, and error fallback behavior.
- [ ] Integration test: mutate board, reload, and verify persistence.

### Success criteria
- [ ] Board state is persistent rather than demo-only memory state.
- [ ] Core board interactions remain smooth and reliable.

## Part 8: AI Connectivity via OpenRouter

### Checklist
- [ ] Add backend AI client integration via OpenRouter.
- [ ] Configure model usage as `openai/gpt-oss-120b`.
- [ ] Load API key/config from environment variables.
- [ ] Add a simple connectivity check flow (`2+2`) for verification.

### Tests
- [ ] Unit tests with mocked AI client responses.
- [ ] Optional live connectivity smoke check when env vars are present.

### Success criteria
- [ ] Backend can make a successful AI call and parse a valid response.
- [ ] Missing/invalid config produces clear startup or runtime errors.

## Part 9: Structured Output Protocol for Board Updates

### Checklist
- [ ] Define one structured output schema containing:
  - [ ] assistant text response
  - [ ] optional Kanban mutation instructions
- [ ] Send board JSON + user question + conversation history to AI request.
- [ ] Validate AI output strictly against the schema.
- [ ] Apply valid mutations; ignore/handle invalid mutations safely.
- [ ] Document schema/protocol in docs.

### Tests
- [ ] Schema validation tests: valid, malformed, and partial outputs.
- [ ] Mutation tests: create/edit/move operations update board correctly.
- [ ] Regression tests: non-mutation responses do not change board.

### Success criteria
- [ ] AI output is consistently parseable.
- [ ] Valid structured mutations reliably update persisted board state.

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