# Part 5 Database Schema Proposal (SQLite)

This document proposes the persistence schema for the Kanban MVP.

Goals:
- Keep MVP implementation simple.
- Store one board per signed-in user for now.
- Keep schema future-ready for multiple users.
- Store board state as JSON, as requested.

## Proposed tables

### `users`

Purpose: user identity record, future multi-user support.

```sql
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Notes:
- `username` is unique and indexed by the UNIQUE constraint.
- For MVP, we will upsert/find the `user` account and use that identity.

### `boards`

Purpose: one persisted Kanban board per user, stored as JSON.

```sql
CREATE TABLE IF NOT EXISTS boards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  board_json TEXT NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

Notes:
- `user_id UNIQUE` enforces exactly one board per user (MVP requirement).
- `board_json` stores the full board document.
- `schema_version` supports future JSON evolution.

## Board JSON contract

`board_json` will store the same canonical shape used in frontend domain logic.

```json
{
  "columns": [
    {
      "id": "col-backlog",
      "title": "Backlog",
      "cardIds": ["card-1", "card-2"]
    }
  ],
  "cards": {
    "card-1": {
      "id": "card-1",
      "title": "Example task",
      "details": "Example details"
    }
  }
}
```

Validation rules on write:
- `columns` must be an array with string `id`, `title`, and `cardIds`.
- `cards` must be an object keyed by card id with `id`, `title`, `details`.
- Every card id in `cardIds` must exist in `cards`.

## Initialization approach

On backend startup (or first request that needs DB):
1. Create database file if missing.
2. Create `users` and `boards` tables if missing.
3. Ensure default MVP user row exists (`username = 'user'`).
4. Ensure that user has a board row:
   - if missing, seed with current `initialData` JSON.

This keeps first-run behavior deterministic and supports clean local setup.

## Migration approach (minimal, MVP-safe)

- Start with `schema_version = 1`.
- Future breaking shape changes:
  - increment `schema_version`
  - migrate existing JSON documents with explicit transform functions
  - keep migrations idempotent and test-backed

No migration framework is required for MVP; simple versioned SQL scripts/functions are enough.

## Test cases for Part 5/6 handoff

1. DB file is created automatically when absent.
2. Tables are created automatically when absent.
3. Default user (`user`) is created once (no duplicates).
4. Board row is created once per user (enforced by unique `user_id`).
5. Seed board JSON matches expected shape.
6. Invalid JSON payloads fail validation and are not persisted.

## Sign-off request

Please confirm this schema approach is approved for implementation in Part 6.

