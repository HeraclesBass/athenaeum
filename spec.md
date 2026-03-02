# Athenaeum — V11 Launch Spec

**Status: ALL 5 PHASES COMPLETE** (2026-03-02)

## Intent

Personal semantic library platform for a small team. Upload documents (PDF, text, markdown),
search semantically via vector embeddings, and chat with AI grounded in your content.
Multi-library isolation with per-library personas. Research-grade citation UX.

**Target**: Authelia SSO users (friends/team), with public library sharing for visitors.
**Live**: https://athenaeum.herakles.dev
**Forked from**: alan-watts RAG scaffold

## Stack

| Component | Tech | Port |
|-----------|------|------|
| Backend | FastAPI (Python 3.11) | 8140 |
| Database | PostgreSQL 16 + pgvector | 5442 |
| Embeddings | all-mpnet-base-v2 (local, 768d) | — |
| Frontend | Next.js 14 + TypeScript + Tailwind | 3140 |
| LLM | Free-LLM gateway (OpenAI-compatible) | — |
| Auth | Authelia SSO (nginx header injection) | — |
| Domain | athenaeum.herakles.dev | — |

## Current State (post-launch)

- 4 libraries deployed (256 docs, 717 chunks — labor law corpus)
- Full CRUD, multi-file upload, semantic search, RAG chat with inline citations
- Conversation history with DB persistence and sidebar UI
- Landing page with hero, feature cards, and public library directory
- MCP server implemented (search, chat, browse, read tools via stdio)
- 30 integration tests passing (health, CRUD, upload, search, chat, browse, auth)
- Loki structured logging on API container
- DB-backed rate limiting with in-memory fallback
- Topic clustering wired into ingestion pipeline
- Mobile-responsive UI with keyboard shortcuts
- Error boundaries at global and library route levels
- Failed embedding retry queue with admin endpoint

## Protocol

V11

## Constraints

- DB binds 127.0.0.1 only
- Secrets in ~/.secrets/hercules.env, never committed
- NEXT_PUBLIC_API_URL baked at Docker build time
- Free-LLM gateway: no SSE streaming support — use chunked responses
- Budget: $0 infrastructure (all self-hosted, free LLM tier)

---

## Launch Roadmap

### Phase 1: Foundation (Bug Fixes + Observability)

**Goal**: Make the existing app reliable and debuggable.

| # | Task | File(s) | Priority |
|---|------|---------|----------|
| 1.1 | Fix homepage 0/0/0 stats — public libraries exist but stats query fails | `frontend/app/page.tsx`, `src/api/routes/libraries.py` | P0 |
| 1.2 | Add Loki structured logging to API | `src/api/main.py`, `docker-compose.yml` | P0 |
| 1.3 | Audit auth on all write endpoints (upload, create, update, delete) | `src/api/routes/*.py`, `src/api/auth.py` | P0 |
| 1.4 | Wire topic clustering into ingestion pipeline | `src/ingestion/cluster.py`, `src/api/routes/upload.py` | P1 |
| 1.5 | Ingest Maryland labor law data (on disk, not in DB) | `data/maryland-labor-laws/` | P2 |

**Exit criteria**: Homepage shows real stats. API logs visible in Loki. All write endpoints verified behind auth.

---

### Phase 2: Chat UX Overhaul (Core Research Experience)

**Goal**: Make chat responses research-grade — clear AI commentary vs. verbatim source blocks.

| # | Task | Details |
|---|------|---------|
| 2.1 | Structured response layout | AI answer in one section, sources in collapsible section below |
| 2.2 | Inline citations `[1][2]` | Numbered references in AI text, linked to source cards |
| 2.3 | Source cards with metadata | Each source shows: document title, section name, page range, relevance score, verbatim excerpt |
| 2.4 | Conversation history (DB-backed) | New `conversations` + `messages` tables; persist chat sessions per library |
| 2.5 | Loading states | Skeleton UI during LLM response; chunked structured response (no SSE) |
| 2.6 | Follow-up suggestions | 2-3 suggested follow-up questions after each response, derived from context |
| 2.7 | Chat sidebar | List of past conversations per library, click to resume |

**Backend changes**:
- Modify `/api/libraries/{id}/chat` to return structured JSON: `{answer, citations[], sources[], suggestions[]}`
- Prompt engineering: instruct LLM to use `[1]`, `[2]` inline references
- New tables: `conversations(id, library_id, user, title, created_at)`, `messages(id, conversation_id, role, content, sources_json, created_at)`
- New endpoints: `GET/POST /api/libraries/{id}/conversations`, `GET /api/conversations/{id}/messages`

**Frontend changes**:
- New `ChatMessage` component with citation rendering
- New `SourceCard` component (expandable, shows verbatim excerpt)
- Conversation sidebar with history list
- Loading skeleton component

**Exit criteria**: Chat responses show numbered inline citations. Clicking a citation scrolls to the verbatim source excerpt. Conversations persist across sessions.

---

### Phase 3: Landing Page + Public Sharing

**Goal**: Make Athenaeum presentable to visitors and shareable.

| # | Task | Details |
|---|------|---------|
| 3.1 | Marketing hero section | "Your documents, searchable and conversational" — explain what Athenaeum does |
| 3.2 | Feature highlights | 3-4 cards: Semantic Search, AI Chat, Multi-Library, Local Embeddings |
| 3.3 | Public library directory | Below hero: browse public libraries as cards with stats (doc count, chunk count) |
| 3.4 | Library preview page | Unauthenticated users can browse + search public libraries; chat requires sign-in |
| 3.5 | Shareable URLs | `/library/{slug}` works for anyone on public libraries; OG meta tags for link previews |
| 3.6 | Sign-in CTA | Clear "Sign in to create your own library" call-to-action |

**Exit criteria**: New visitors understand what Athenaeum is within 5 seconds. Public libraries are browsable without auth. Shared links have proper previews.

---

### Phase 4: MCP Server (Read-Only)

**Goal**: Expose Athenaeum as an MCP tool so Claude Code and other agents can search/chat with libraries.

| # | Task | Details |
|---|------|---------|
| 4.1 | `athenaeum_list_libraries` tool | List available libraries with stats |
| 4.2 | `athenaeum_search` tool | Semantic search within a specified library (query, limit) |
| 4.3 | `athenaeum_chat` tool | RAG chat with a library (message, library_slug, context_limit) |
| 4.4 | `athenaeum_browse` tool | List documents and topics for a library |
| 4.5 | `athenaeum_read_document` tool | Get full text of a specific document |
| 4.6 | MCP server entry point | stdio transport, register in `mcp.json` |
| 4.7 | Documentation | Tool descriptions, usage examples, configuration |

**Implementation**: Python MCP server using `mcp` SDK. Calls internal API endpoints.
**Transport**: stdio (local) — no auth needed since it runs on the same machine.

**Exit criteria**: Adding Athenaeum to Claude Code's `mcp.json` lets you search and chat with any library from the CLI.

---

### Phase 5: Polish + Hardening [COMPLETED]

**Goal**: Production-quality reliability and UX.

| # | Task | Details | Status |
|---|------|---------|--------|
| 5.1 | Integration tests for search, chat, upload | 30 tests covering health, CRUD, upload, search relevance, chat citations, conversation persistence, browse, settings, auth | DONE |
| 5.2 | Mobile-responsive UI pass | Responsive breakpoints, scrollable nav, mobile chat sidebar overlay, adaptive padding/typography | DONE |
| 5.3 | Bulk upload (multi-file) | Multi-file drop zone, per-file status tracking (pending/uploading/done/error), aggregate stats summary | DONE |
| 5.4 | Failed embedding retry queue | `failed_embeddings` table, per-chunk error tracking, `POST /libraries/{id}/retry-embeddings` endpoint | DONE |
| 5.5 | Rate limit persistence | DB-backed sliding window via `rate_limits` table, fallback to in-memory if DB unavailable | DONE |
| 5.6 | Error boundary components | Next.js `error.tsx` route boundaries (global + library), reusable `ErrorBoundary` class component | DONE |
| 5.7 | Keyboard shortcuts | `/` to focus search, `n` for new chat, `Esc` to close sidebar; `useKeyboard` hook | DONE |

**Exit criteria**: 30/30 tests passing. Mobile responsive. Bulk upload works. All hardening complete.

---

## Database Schema Additions (Phase 2)

```sql
-- Chat history
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    user_id TEXT,
    title TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    sources_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversations_library ON conversations(library_id);
CREATE INDEX idx_conversations_user ON conversations(user_id);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
```

## New API Endpoints (Phases 2-4)

```
# Phase 2: Chat History
GET    /api/libraries/{id}/conversations          List conversations
POST   /api/libraries/{id}/conversations          Create conversation
GET    /api/conversations/{id}                     Get conversation + messages
POST   /api/conversations/{id}/messages            Add message to conversation
DELETE /api/conversations/{id}                     Delete conversation

# Phase 4: MCP (internal, not HTTP)
athenaeum_list_libraries()
athenaeum_search(library_slug, query, limit)
athenaeum_chat(library_slug, message, context_limit)
athenaeum_browse(library_slug)
athenaeum_read_document(library_slug, document_id)
```

## Risk Matrix

| Action | Risk | Mitigation |
|--------|------|------------|
| Schema migration (conversations) | Medium | Backup DB first, test on dev |
| Chat prompt restructuring | Low | Keep backward-compatible response format |
| Landing page redesign | Low | No backend changes |
| MCP server | Low | Read-only, local-only |
| Bulk upload | Medium | File size limits, queue processing |

## Success Metrics

- Homepage shows real library stats (Phase 1 P0)
- Chat responses include numbered source citations (Phase 2)
- New visitors understand the product in <5 seconds (Phase 3)
- `athenaeum_search` works from Claude Code CLI (Phase 4)
- Zero unhandled errors in Loki logs for 48 hours (Phase 5)
