# Running the App (Parts 2-3)

## Start

- Linux: `./scripts/start-linux.sh`
- macOS: `./scripts/start-mac.sh`
- Windows: `scripts\\start-windows.bat` (or `start-windows.ps1`)

## Stop

- Linux: `./scripts/stop-linux.sh`
- macOS: `./scripts/stop-mac.sh`
- Windows: `scripts\\stop-windows.bat` (or `stop-windows.ps1`)

## Verify

- Kanban board page: `http://127.0.0.1:8000/`
- API endpoint: `http://127.0.0.1:8000/api/hello`

Expected checks:
- `/` loads the built Next.js Kanban UI and includes the "Kanban Studio" heading.
- `/api/hello` returns:

```json
{
  "message": "hello from fastapi",
  "status": "ok"
}
```
