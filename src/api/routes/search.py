"""Semantic search within a library."""

import psycopg2
import psycopg2.extras
from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel

from config.settings import DATABASE_URL
from src.embeddings.provider import embed_text
from src.api.auth import check_library_read_access
from src.api.rate_limit import check_rate_limit

router = APIRouter()


class SearchResult(BaseModel):
    chunk_id: int
    document_id: int
    document_title: str
    section: str | None
    text: str
    similarity: float


class SearchResponse(BaseModel):
    query: str
    results: list[SearchResult]
    total: int


@router.get("/libraries/{library_id}/search", response_model=SearchResponse)
def semantic_search(
    library_id: int,
    request: Request,
    q: str = Query(..., description="Search query"),
    limit: int = Query(10, ge=1, le=50),
):
    """Semantic search within a specific library."""
    check_rate_limit(request, "search")

    # Check library access
    conn = psycopg2.connect(DATABASE_URL)
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            cur.execute("SELECT * FROM libraries WHERE id = %s", (library_id,))
            lib_row = cur.fetchone()
            if not lib_row:
                raise HTTPException(status_code=404, detail="Library not found")
            check_library_read_access(dict(lib_row), request)
    finally:
        conn.close()

    embedding = embed_text(q)

    conn = psycopg2.connect(DATABASE_URL)
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT c.id, c.document_id, d.title, d.section, c.text,
                       1 - (c.embedding <=> %s::vector) as similarity
                FROM chunks c
                JOIN documents d ON d.id = c.document_id
                WHERE c.embedding IS NOT NULL AND c.library_id = %s
                ORDER BY c.embedding <=> %s::vector
                LIMIT %s
            """, (str(embedding), library_id, str(embedding), limit))
            rows = cur.fetchall()
    finally:
        conn.close()

    results = [
        SearchResult(
            chunk_id=row[0],
            document_id=row[1],
            document_title=row[2],
            section=row[3],
            text=row[4],
            similarity=round(float(row[5]), 4),
        )
        for row in rows
    ]

    return SearchResponse(query=q, results=results, total=len(results))
