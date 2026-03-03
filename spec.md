# Athenaeum — Development Spec

**Status: ALL 7 PHASES COMPLETE** (2026-03-03)

## Intent

Personal semantic library platform. Upload documents (PDF, text, markdown),
search semantically via vector embeddings, and chat with AI grounded in your content.
Multi-library isolation with per-library personas. Research-grade citation UX.

**Target**: Self-hosted for individuals or small teams. SSO-compatible with public library sharing.

## Stack

| Component | Tech | Port |
|-----------|------|------|
| Backend | FastAPI (Python 3.11) | 8140 |
| Database | PostgreSQL 16 + pgvector | 5442 |
| Embeddings | all-mpnet-base-v2 (local, 768d) | — |
| Frontend | Next.js 14 + TypeScript + Tailwind | 3140 |
| LLM | Configurable (OpenRouter, OpenAI, Anthropic, Ollama, Gemini) | — |
| Auth | SSO via reverse proxy header injection | — |

## Current State (post-Phase 7)

- Full CRUD, multi-file upload, semantic search, RAG chat with inline citations
- **Cross-library search and chat**: select multiple libraries, one query, globally-ranked results with per-library attribution
- Cross-library frontend pages at `/search` and `/chat` with library selector component
- Conversation history with DB persistence and sidebar UI (single-library and multi-library)
- Landing page with hero, feature cards, and public library directory
- MCP server: 7 tools (list, search, chat, browse, read, multi_search, multi_chat)
- ~38 integration tests passing (health, CRUD, upload, search, chat, browse, auth, multi-library)
- Structured JSON logging on API container
- DB-backed rate limiting with in-memory fallback
- Topic clustering wired into ingestion pipeline
- Mobile-responsive UI with keyboard shortcuts
- Error boundaries at global and library route levels
- Failed embedding retry queue with admin endpoint
- **Lighthouse accessibility/usability pass**: WCAG AA contrast, focus indicators, ARIA attributes, skip navigation, JSON-LD, per-page metadata, reduced motion support, loading skeletons, self-hosted fonts

## Constraints

- DB binds 127.0.0.1 only
- Secrets in `.env`, never committed
- `NEXT_PUBLIC_API_URL` baked at Docker build time
- Self-hosted, all embeddings run locally

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
| 4.2 | `athenaeum_search` tool | Semantic search within a specified library (library_id, query, limit) |
| 4.3 | `athenaeum_chat` tool | RAG chat with a library (library_id, message, context_limit) |
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
| 5.1 | Integration tests for search, chat, upload | 30 tests covering health, CRUD, upload, search relevance, chat citations, conversation persistence, browse, settings, auth (expanded to ~38 in Phase 6) | DONE |
| 5.2 | Mobile-responsive UI pass | Responsive breakpoints, scrollable nav, mobile chat sidebar overlay, adaptive padding/typography | DONE |
| 5.3 | Bulk upload (multi-file) | Multi-file drop zone, per-file status tracking (pending/uploading/done/error), aggregate stats summary | DONE |
| 5.4 | Failed embedding retry queue | `failed_embeddings` table, per-chunk error tracking, `POST /libraries/{id}/retry-embeddings` endpoint | DONE |
| 5.5 | Rate limit persistence | DB-backed sliding window via `rate_limits` table, fallback to in-memory if DB unavailable | DONE |
| 5.6 | Error boundary components | Next.js `error.tsx` route boundaries (global + library), reusable `ErrorBoundary` class component | DONE |
| 5.7 | Keyboard shortcuts | `/` to focus search, `n` for new chat, `Esc` to close sidebar; `useKeyboard` hook | DONE |

**Exit criteria**: Tests passing. Mobile responsive. Bulk upload works. All hardening complete.

---

### Phase 6: Cross-Library Search & Chat [COMPLETED]

**Goal**: Let users search and chat across multiple libraries in a single query.

| # | Task | Details | Status |
|---|------|---------|--------|
| 6.1 | Schema migration | `conversations.library_id` nullable, `conversation_libraries` join table | DONE |
| 6.2 | `POST /api/search` | Cross-library pgvector search with `library_ids[]`, per-result library attribution | DONE |
| 6.3 | `POST /api/chat` | Cross-library RAG chat, `DEFAULT_SYSTEM_PROMPT`, conversation tracking via join table | DONE |
| 6.4 | `GET /api/conversations` | List multi-library conversations (`library_id IS NULL`) | DONE |
| 6.5 | Conversation detail | `library_ids` field returned from join table on `GET /api/conversations/{id}` | DONE |
| 6.6 | Frontend API client | `MultiSearchResult`, `MultiChatResponse` types; `multiSearch()`, `multiChat()`, `multiConversations()` | DONE |
| 6.7 | Shared components | `RenderedAnswer`, `SourceCard` (with `libraryName` badge), `LibrarySelector` | DONE |
| 6.8 | `/search` page | Cross-library search with library selector + results with library name badges | DONE |
| 6.9 | `/chat` page | Cross-library chat with library selector, source cards with library badges, conversation sidebar | DONE |
| 6.10 | Nav update | "Search" + "Chat" top-level links always visible | DONE |
| 6.11 | MCP tools | `athenaeum_multi_search`, `athenaeum_multi_chat` | DONE |
| 6.12 | Integration tests | `TestMultiLibrary` class: 8 tests (search, chat, structure, errors, persistence, attribution) | DONE |

**Exit criteria**: Cross-library search returns results with library attribution. Cross-library chat creates conversations trackable via `conversation_libraries`. Frontend pages functional at `/search` and `/chat`. MCP tools working. ~38 tests passing.

---

### Phase 7: Lighthouse Accessibility & Usability [COMPLETED]

**Goal**: Achieve high Lighthouse accessibility/usability scores across all frontend pages.

| # | Task | Details | Status |
|---|------|---------|--------|
| 7.1 | WCAG AA color contrast | `--muted-2` bumped from `#4f5d72` to `#6b7a90` (4.5:1 ratio) | DONE |
| 7.2 | Focus indicators | Global `:focus-visible` ring (`2px solid var(--accent)`), removed blanket `outline: none` | DONE |
| 7.3 | ARIA attributes | `aria-label`, `aria-hidden`, `aria-pressed`, `aria-checked`, `aria-live`, `role="alert"`, `role="checkbox"`, `role="group"` across all pages and components | DONE |
| 7.4 | Skip navigation | `<a href="#main-content">` with `.sr-only` utility, visible on focus | DONE |
| 7.5 | Self-hosted fonts | `next/font/google` Inter with `font-display: swap`, CSS variable `--font-inter` | DONE |
| 7.6 | Per-page metadata | `layout.tsx` files for `/search` and `/chat` with unique `<title>` tags | DONE |
| 7.7 | JSON-LD structured data | `WebApplication` schema on root layout for rich search results | DONE |
| 7.8 | Loading skeletons | `loading.tsx` at root and `/library/[slug]` for Suspense streaming | DONE |
| 7.9 | Touch targets | `.btn-icon` minimum 44px (WCAG 2.2 SC 2.5.8) | DONE |
| 7.10 | Reduced motion | `prefers-reduced-motion: reduce` media query disables all animations | DONE |
| 7.11 | Form accessibility | `htmlFor`/`id` on all label-input pairs; visibility toggles use `aria-pressed` | DONE |
| 7.12 | Keyboard accessibility | Upload drop zone and sidebar overlay dismiss respond to keyboard events | DONE |
| 7.13 | Heading hierarchy | Error pages use `<h1>` (was `<h2>`) for proper document structure | DONE |
| 7.14 | CSS hover migration | Inline JS `onMouseEnter`/`onMouseLeave` replaced with `.suggestion-chip` CSS class | DONE |
| 7.15 | Image optimization | `next.config.mjs`: `compress: true`, AVIF/WebP formats | DONE |
| 7.16 | Viewport metadata | Exported `viewport` with `themeColor` from root layout | DONE |

**Files modified**: `globals.css`, `layout.tsx`, `next.config.mjs`, `Nav.tsx`, `LibrarySelector.tsx`, `error.tsx` (×2), `page.tsx` (homepage), `search/page.tsx`, `chat/page.tsx`, `library/[slug]/page.tsx`, `library/[slug]/chat/page.tsx`, `library/[slug]/settings/page.tsx`, `library/[slug]/upload/page.tsx`
**Files created**: `app/loading.tsx`, `app/library/[slug]/loading.tsx`, `app/search/layout.tsx`, `app/chat/layout.tsx`

**Exit criteria**: All pages have proper ARIA landmarks, focus indicators, skip navigation, semantic headings, keyboard-accessible interactive elements, and reduced motion support. Self-hosted fonts with zero FOIT. Structured data present. Loading skeletons for Suspense boundaries.

---

## Database Schema Additions

### Phase 2: Chat history
```sql
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id INTEGER REFERENCES libraries(id) ON DELETE CASCADE,  -- nullable for multi-library
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
```

### Phase 6: Multi-library conversations
```sql
-- library_id made nullable (was NOT NULL)
ALTER TABLE conversations ALTER COLUMN library_id DROP NOT NULL;

CREATE TABLE conversation_libraries (
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    library_id INTEGER NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    PRIMARY KEY (conversation_id, library_id)
);
```

## API Endpoints Added by Phase

### Phase 2: Chat history
```
POST   /api/libraries/{id}/chat                    RAG chat (creates conversation implicitly)
GET    /api/libraries/{id}/conversations            List library conversations
GET    /api/conversations/{id}                      Get conversation + messages
DELETE /api/conversations/{id}                      Delete conversation
```

### Phase 4: MCP tools (stdio, not HTTP)
```
athenaeum_list_libraries()
athenaeum_search(library_id, query, limit)
athenaeum_chat(library_id, message, context_limit)
athenaeum_browse(library_id, search?)
athenaeum_read_document(library_id, document_id)
```

### Phase 6: Cross-library search & chat
```
POST   /api/search                                  Multi-library search {query, library_ids[], limit}
POST   /api/chat                                    Multi-library chat {message, library_ids[], context_limit}
GET    /api/conversations                            List multi-library conversations

# MCP tools added:
athenaeum_multi_search(library_ids, query, limit)
athenaeum_multi_chat(library_ids, message, context_limit)
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
- Cross-library search returns results with library attribution; `/search` and `/chat` pages work (Phase 6)
- All pages pass Lighthouse accessibility audit: ARIA, focus, skip nav, contrast, headings, keyboard access (Phase 7)
