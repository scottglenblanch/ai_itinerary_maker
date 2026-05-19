# Itinerary Maker

Nx monorepo for the itinerary maker chat experience.

## Workspace layout

- `apps/chat-api` - FastAPI backend for chat, history, and ICS generation
- `apps/chat-ui` - Vite + React frontend for the chat experience

## Run locally

Install the Node workspace dependencies:

```bash
pnpm install
```

Install the API dependencies:

```bash
cd apps/chat-api
uv sync --all-extras
```

Run the API and UI from the repo root:

```bash
pnpm nx serve chat-api
pnpm nx serve chat-ui
```

The UI runs on Vite’s dev server and talks to the API over `/api/v1/*`.

## Redis cache

Chat responses are cached by `username + question` in Redis.

Environment variables:

- `REDIS_URL` (default: `redis://localhost:6379/0`)
- `REDIS_CACHE_TTL_SECONDS` (default: `3600`)

If Redis is unavailable, the API still works and falls back to non-cached responses.

## Helpful endpoints

- `GET /` - chat-api status message
- `GET /api/v1/health` - health check
- `POST /api/v1/chat/ask` - chat request endpoint
- `POST /api/v1/chat/history` - chat history lookup
- `GET /api/v1/chat/ics/{file_id}` - download an ICS file
- `GET /docs` - interactive OpenAPI docs

## Validation

```bash
pnpm nx run chat-api:test
```

