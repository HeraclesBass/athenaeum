# Project: Athenaeum

## Intent

Personal semantic library platform. Upload any document (PDF, text, markdown),
get instant vector-indexed semantic search and AI-powered chat grounded in your content.
Forked from the alan-watts RAG scaffold, evolved into a multi-library platform.

**Goal**: A personal knowledge base where every document you upload becomes searchable
and conversational via RAG — organized into libraries with per-library AI personas.

## Stack

- Backend: FastAPI (Python 3.11) @ port 8140
- Database: PostgreSQL 16 + pgvector @ port 5442
- Embeddings: all-mpnet-base-v2 (local, 768d)
- Frontend: Next.js 14 (TypeScript + Tailwind) @ port 3140
- LLM: Free-LLM gateway (OpenAI-compatible, model=auto)
- Domain: athenaeum.herakles.dev (Authelia SSO)

## Architecture

```
Upload PDF/text → Extract sections → Chunk → Embed (768d, local)
  → pgvector HNSW cosine search → Top-k chunks + parent documents
  → RAG prompt (per-library persona from config JSONB)
  → LLM (free-llm gateway)
  → Response grounded in actual document excerpts
```

Multi-library isolation via `library_id` FK on all content tables.

## Constraints

- DB binds to 127.0.0.1 only
- Secrets in ~/.secrets/hercules.env, never committed
- NEXT_PUBLIC_API_URL baked in at Docker build time

## Protocol

V11

## Notes

- Forked from `/home/hercules/alan-watts` scaffold
- Reference: https://alanwatts.herakles.dev
- Live: https://athenaeum.herakles.dev
