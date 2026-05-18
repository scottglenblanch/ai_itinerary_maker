# Itinerary Maker

FastAPI starter project.

## Run locally

```bash
python -m pip install -e .
uvicorn app.main:app --reload
```

Then open `http://127.0.0.1:8000`.

## Redis cache

Chat responses are cached by `username + question` in Redis.

Environment variables:

- `REDIS_URL` (default: `redis://localhost:6379/0`)
- `REDIS_CACHE_TTL_SECONDS` (default: `3600`)

If Redis is unavailable, the API still works and falls back to non-cached responses.

## Helpful endpoints

- `GET /chat` - simple HTML UI for asking questions
- `GET /api/v1/health` - health check
- `POST /api/v1/chat` - chat request endpoint
- `GET /docs` - interactive OpenAPI docs
