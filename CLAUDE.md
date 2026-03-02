# Athenaeum

> Personal semantic library platform — upload documents, search semantically, chat with AI.

Named for the Temple of Athena — the classical word for a library or reading room.

## Quick Start

```bash
source ~/.secrets/hercules.env    # REQUIRED before any docker/db commands

make run                          # Start all 3 services (db + api + frontend)
make build                        # Rebuild all containers
make dev                          # Local API hot-reload on port 8140
make logs                         # Tail API logs
make test                         # Run pytest suite (requires running containers)
make stop                         # Stop all containers
```

## Architecture

```
Upload PDF/text → Extract sections (pdfplumber) → Chunk (500 tokens, 50 overlap)
  → Embed (all-mpnet-base-v2, 768d, local) → pgvector HNSW cosine index
  → Semantic search → Top-k chunks + parent documents
  → RAG prompt (per-library persona from config JSONB) → LLM (free-llm gateway)
  → Response grounded in actual document excerpts
```

Multi-library: all content tables have `library_id` FK with CASCADE delete. Libraries are fully isolated namespaces.

## API (port 8140)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Health check |
| GET | `/api/libraries` | List all libraries |
| POST | `/api/libraries` | Create library `{name, slug, description, config}` |
| GET | `/api/libraries/{id}` | Library detail + corpus stats |
| GET | `/api/libraries/by-slug/{slug}` | Get library by URL slug |
| PATCH | `/api/libraries/{id}` | Update library (owner/admin) |
| DELETE | `/api/libraries/{id}` | Delete library + all content (owner/admin) |
| POST | `/api/libraries/{id}/upload` | Upload PDF/TXT/MD → auto-ingest (multi-file) |
| POST | `/api/libraries/{id}/retry-embeddings` | Retry failed embeddings (auth required) |
| GET | `/api/libraries/{id}/search?q=...` | Semantic search within library |
| POST | `/api/libraries/{id}/chat` | RAG chat `{message, context_limit, conversation_id}` |
| GET | `/api/libraries/{id}/conversations` | List chat conversations |
| POST | `/api/libraries/{id}/conversations` | Create conversation |
| GET | `/api/conversations/{id}` | Get conversation + messages |
| POST | `/api/conversations/{id}/messages` | Add message to conversation |
| DELETE | `/api/conversations/{id}` | Delete conversation |
| GET | `/api/libraries/{id}/documents` | Browse documents |
| GET | `/api/libraries/{id}/documents/{doc_id}` | Full document text |
| GET | `/api/libraries/{id}/topics` | Auto-discovered topics |
| GET | `/api/libraries/{id}/info` | Library metadata + corpus stats + failed embeddings |
| GET | `/api/settings` | Current LLM config |
| GET | `/api/user` | Current authenticated user info |

## Project Structure

```
config/
├── init.sql             # Schema: libraries, documents, chunks, topics, conversations,
│                        #   messages, failed_embeddings, rate_limits
└── settings.py          # DATABASE_URL, LLM config, embedding model
src/
├── mcp_server.py        # MCP server (stdio) — search/chat/browse tools
├── api/
│   ├── main.py          # FastAPI app + Authelia auth + Loki logging + rate limiting
│   ├── auth.py          # Auth helpers (require_auth, require_admin decorators)
│   ├── rate_limit.py    # DB-backed sliding window rate limiter (fallback: in-memory)
│   └── routes/
│       ├── libraries.py # Library CRUD (owner/admin gated)
│       ├── upload.py    # Multi-file upload + auto-ingest + failed embedding queue
│       ├── search.py    # Semantic search (pgvector cosine)
│       ├── chat.py      # RAG chat with inline citations [1][2], conversation history
│       ├── browse.py    # Documents, topics, info, retry-embeddings
│       ├── settings.py  # LLM provider config
│       └── user.py      # Current user endpoint
├── embeddings/provider.py  # Singleton SentenceTransformer (all-mpnet-base-v2)
├── ingestion/
│   ├── pdf_loader.py    # PDF section extraction (pdfplumber)
│   ├── chunker.py       # Token-based text chunking
│   ├── cluster.py       # K-means topic clustering (wired into ingestion)
│   ├── embed.py         # Batch embedding (Gemini)
│   └── embed_local.py   # Local embedding (sentence-transformers)
├── llm/provider.py      # Abstract LLM + 5 providers
└── db.py                # Shared connection helper
frontend/
├── app/
│   ├── page.tsx                        # Landing page + library catalog
│   ├── error.tsx                       # Global error boundary
│   ├── layout.tsx                      # Root layout
│   └── library/[slug]/
│       ├── page.tsx                    # Library dashboard (search + browse)
│       ├── layout.tsx                  # Library layout
│       ├── error.tsx                   # Library error boundary
│       ├── chat/page.tsx               # RAG chat (citations, sidebar, history)
│       ├── upload/page.tsx             # Multi-file drag-and-drop upload
│       └── settings/page.tsx           # Library settings
├── components/
│   ├── Nav.tsx                         # Breadcrumb navigation (responsive)
│   └── ErrorBoundary.tsx               # Reusable error boundary component
└── lib/
    ├── api.ts                          # All API calls (typed)
    ├── auth.tsx                        # Auth context provider
    └── useKeyboard.ts                  # Keyboard shortcuts hook (/, n, Esc)
tests/
└── test_api.py                         # 30 integration tests
mcp.json                                # MCP server config for Claude Code
```

## Database

```
PostgreSQL 16 + pgvector @ 127.0.0.1:5442

libraries          → namespace table (slug, name, config JSONB)
documents          → full document text (library_id FK, content_hash dedup)
chunks             → vectorized text (embedding vector(768), HNSW index)
topics             → auto-discovered topics per library
conversations      → chat sessions per library/user
messages           → chat messages with sources_json
failed_embeddings  → retry queue for embedding failures
rate_limits        → DB-backed sliding window rate limit entries
```

```bash
source ~/.secrets/hercules.env
docker compose exec db psql -U athenaeum athenaeum
```

## Auth

Authelia SSO via nginx. Headers injected into every request:
- `Remote-User` → `request.state.remote_user`
- `Remote-Groups` → `request.state.remote_groups`

Library ownership: only the owner or `admins` group can update/delete.

## Environment

```bash
# Required
ATHENAEUM_DB_PASSWORD=...

# LLM (defaults wired in docker-compose.yml)
LLM_PROVIDER=openai        # Uses free-llm gateway
LLM_MODEL=auto
LLM_API_KEY=free
LLM_BASE_URL=http://free_llm_api:8000/v1
```

## Testing

```bash
make test                         # Run all 30 tests (requires running containers)
pytest tests/ -v                  # Same, without Makefile
pytest tests/test_api.py -k chat  # Run only chat-related tests
```

## Deployment

```bash
source ~/.secrets/hercules.env

# Full rebuild with production URL baked into Next.js:
NEXT_PUBLIC_API_URL=https://athenaeum.herakles.dev docker compose up -d --build

# Just restart API (picks up src/ changes via volume mount):
docker compose restart api
```

**URLs**: `https://athenaeum.herakles.dev` | API: `127.0.0.1:8140` | DB: `127.0.0.1:5442` | Frontend: `127.0.0.1:3140`

## Extension Patterns

### Add an API Route
1. Create `src/api/routes/myroute.py`
2. Register in `src/api/main.py`: `app.include_router(myroute.router, prefix="/api")`
3. Add types + fetch call in `frontend/lib/api.ts`

### Add a Frontend Page
1. Create `frontend/app/mypage/page.tsx` (Next.js App Router)
2. Add nav link in `frontend/components/Nav.tsx`
3. Use CSS vars: `var(--bg)` `var(--accent)` and classes: `.card` `.btn` `.badge`

## Critical Rules

### MUST
- `source ~/.secrets/hercules.env` before docker/db commands
- Read files before editing
- DB binds to `127.0.0.1` only — never `0.0.0.0`
- `NEXT_PUBLIC_API_URL` must be set at build time (baked into client bundle)

### NEVER
- Expose database port to internet
- Hardcode API keys or passwords
- Create docs files unless asked

---

**Port**: 8140 | **Status**: active | **Forked from**: alan-watts scaffold
