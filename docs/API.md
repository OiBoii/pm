# Backend API (Part 6)

## `GET /api/hello`

Health/smoke endpoint.

Response:

```json
{
  "message": "hello from fastapi",
  "status": "ok"
}
```

## `GET /api/board`

Returns the persisted board JSON for the MVP user (`user`).

Response shape:

```json
{
  "columns": [
    {
      "id": "col-backlog",
      "title": "Backlog",
      "cardIds": ["card-1"]
    }
  ],
  "cards": {
    "card-1": {
      "id": "card-1",
      "title": "Example",
      "details": "Example details"
    }
  }
}
```

## `PUT /api/board`

Replaces the persisted board for the MVP user.

Request body: same shape as `GET /api/board` response.

Validation rules:
- `columns[].cardIds[]` entries must exist as keys in `cards`.
- Invalid references return HTTP `400`.

Response:
- Returns the updated board JSON.
