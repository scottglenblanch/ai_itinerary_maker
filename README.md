# Itinerary Maker

Nx monorepo for the itinerary maker chat experience.

## Workspace layout

- `apps/chat-api` - FastAPI backend for chat, history, and ICS generation
- `apps/chat-ui` - Vite + React frontend for the chat experience

## Run locally

### 1. Install dependencies

Install the Node workspace dependencies (Nx, Vite, etc.):

```bash
pnpm install
```

Install the Python API dependencies:

```bash
cd apps/chat-api
uv sync --all-extras
cd ../..
```

### 2. Start both apps

Run both apps in parallel from the repo root with a single command:

```bash
pnpm nx run-many --target=serve --all --parallel
```

Or start them individually in separate terminals:

```bash
# Terminal 1 - FastAPI backend
pnpm nx serve chat-api

# Terminal 2 - Vite + React frontend
pnpm nx serve chat-ui
```

### Default ports

| App      | Default URL           | Env var    |
|----------|-----------------------|------------|
| chat-api | http://127.0.0.1:8000 | `API_PORT` |
| chat-ui  | http://127.0.0.1:5173 | `UI_PORT`  |

Both ports can be overridden via a `.env` file at the repo root. The UI dev server proxies all `/api/*` requests to the API, so no CORS configuration is needed during development.

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