# AI Structured Output Protocol

This protocol defines the backend contract used by `POST /api/ai/chat`.

## Request shape

```json
{
  "question": "string",
  "history": [
    { "role": "user | assistant", "content": "string" }
  ]
}
```

Backend behavior:
- Loads the latest persisted board state from SQLite.
- Sends board JSON + conversation history + current user question to OpenAI.
- Expects a strict JSON response matching the schema below.

## AI response schema

```json
{
  "assistantResponse": "string",
  "mutations": [
    {
      "type": "create_card",
      "columnId": "string",
      "title": "string",
      "details": "string",
      "position": 0
    },
    {
      "type": "edit_card",
      "cardId": "string",
      "title": "string",
      "details": "string"
    },
    {
      "type": "move_card",
      "cardId": "string",
      "toColumnId": "string",
      "position": 0
    }
  ]
}
```

Rules:
- `assistantResponse` is always required.
- `mutations` is optional; defaults to an empty list.
- Mutations are validated strictly; unknown fields are rejected.

## Mutation application semantics

- `create_card`: creates a new card id (`card-N`) and inserts it into `columnId`.
- `edit_card`: updates title/details for an existing card.
- `move_card`: removes card from current column and inserts into `toColumnId`.

Safety behavior:
- Invalid mutations are ignored with a reason in `ignoredMutations`.
- Valid mutations still apply when some mutations are invalid.
- Board integrity is validated before persistence.

## API response shape

```json
{
  "assistantResponse": "string",
  "board": { "columns": [], "cards": {} },
  "appliedMutations": [],
  "ignoredMutations": []
}
```
