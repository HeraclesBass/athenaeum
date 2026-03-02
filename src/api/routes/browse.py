"""Browse documents within a library."""

import json
import logging

import psycopg2
import psycopg2.extras
from fastapi import APIRouter, Query, HTTPException, Request
from pydantic import BaseModel

from config.settings import DATABASE_URL
from src.api.auth import check_library_read_access, check_library_write_access
from src.embeddings.provider import embed_texts

logger = logging.getLogger("athenaeum.browse")


def _fetch_and_check_library(library_id: int, request: Request):
    """Fetch library row and check read access. Returns library row or raises."""
    conn = psycopg2.connect(DATABASE_URL)
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            cur.execute("SELECT * FROM libraries WHERE id = %s", (library_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Library not found")
            check_library_read_access(dict(row), request)
            return dict(row)
    finally:
        conn.close()

router = APIRouter()


class DocumentSummary(BaseModel):
    id: int
    title: str
    section: str | None
    source: str | None
    word_count: int


class DocumentDetail(BaseModel):
    id: int
    title: str
    section: str | None
    full_text: str
    source: str | None
    page_start: int | None
    page_end: int | None


class TopicSummary(BaseModel):
    id: int
    name: str
    chunk_count: int
    document_count: int
    keywords: list[str]


@router.get("/libraries/{library_id}/documents", response_model=list[DocumentSummary])
def list_documents(
    library_id: int,
    request: Request,
    search: str | None = Query(None),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """List documents in a library."""
    _fetch_and_check_library(library_id, request)
    conn = psycopg2.connect(DATABASE_URL)
    try:
        with conn.cursor() as cur:
            conditions = ["d.library_id = %s"]
            params: list = [library_id]

            if search:
                conditions.append("(d.title ILIKE %s OR d.full_text ILIKE %s)")
                params.extend([f"%{search}%", f"%{search}%"])

            where = "WHERE " + " AND ".join(conditions)
            params.extend([limit, offset])

            cur.execute(f"""
                SELECT d.id, d.title, d.section, s.name,
                       LENGTH(d.full_text) / 5 as word_count
                FROM documents d
                LEFT JOIN sources s ON s.id = d.source_id
                {where}
                ORDER BY d.title
                LIMIT %s OFFSET %s
            """, params)
            rows = cur.fetchall()
    finally:
        conn.close()

    return [
        DocumentSummary(
            id=row[0], title=row[1], section=row[2],
            source=row[3], word_count=row[4],
        )
        for row in rows
    ]


@router.get("/libraries/{library_id}/documents/{document_id}", response_model=DocumentDetail)
def get_document(library_id: int, document_id: int, request: Request):
    """Get full document text."""
    _fetch_and_check_library(library_id, request)
    conn = psycopg2.connect(DATABASE_URL)
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT d.id, d.title, d.section, d.full_text,
                       s.name, d.page_start, d.page_end
                FROM documents d
                LEFT JOIN sources s ON s.id = d.source_id
                WHERE d.id = %s AND d.library_id = %s
            """, (document_id, library_id))
            row = cur.fetchone()
    finally:
        conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Document not found")

    return DocumentDetail(
        id=row[0], title=row[1], section=row[2], full_text=row[3],
        source=row[4], page_start=row[5], page_end=row[6],
    )


@router.get("/libraries/{library_id}/topics", response_model=list[TopicSummary])
def list_topics(library_id: int, request: Request):
    """List topics for a library."""
    _fetch_and_check_library(library_id, request)
    conn = psycopg2.connect(DATABASE_URL)
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT t.id, t.name, t.description,
                       COUNT(dt.document_id) as document_count
                FROM topics t
                LEFT JOIN document_topics dt ON dt.topic_id = t.id
                WHERE t.library_id = %s
                GROUP BY t.id, t.name, t.description
                ORDER BY t.name
            """, (library_id,))
            rows = cur.fetchall()
    finally:
        conn.close()

    results = []
    for row in rows:
        desc = json.loads(row[2]) if row[2] else {}
        results.append(TopicSummary(
            id=row[0],
            name=row[1],
            chunk_count=desc.get("chunk_count", 0),
            document_count=int(row[3]),
            keywords=desc.get("keywords", []),
        ))
    return results


@router.get("/libraries/{library_id}/info")
def get_library_info(library_id: int, request: Request):
    """Library metadata + live corpus stats."""
    _fetch_and_check_library(library_id, request)
    conn = psycopg2.connect(DATABASE_URL)
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id, slug, name, description, config FROM libraries WHERE id = %s", (library_id,))
            lib_row = cur.fetchone()
            if not lib_row:
                raise HTTPException(status_code=404, detail="Library not found")

            cur.execute("SELECT COUNT(*) FROM documents WHERE library_id = %s", (library_id,))
            doc_count = cur.fetchone()[0]

            cur.execute("SELECT COUNT(*) FROM chunks WHERE library_id = %s AND embedding IS NOT NULL", (library_id,))
            chunk_count = cur.fetchone()[0]

            cur.execute("SELECT COUNT(*) FROM topics WHERE library_id = %s", (library_id,))
            topic_count = cur.fetchone()[0]

            cur.execute("SELECT COUNT(DISTINCT section) FROM documents WHERE library_id = %s AND section IS NOT NULL", (library_id,))
            section_count = cur.fetchone()[0]

            cur.execute("SELECT COUNT(*) FROM failed_embeddings WHERE library_id = %s", (library_id,))
            failed_count = cur.fetchone()[0]
    finally:
        conn.close()

    config = lib_row[4] or {}

    return {
        "library": {
            "id": lib_row[0],
            "slug": lib_row[1],
            "name": lib_row[2],
            "description": lib_row[3],
        },
        "corpus": {
            "document_count": doc_count,
            "chunk_count": chunk_count,
            "topic_count": topic_count,
            "section_count": section_count,
            "failed_embeddings": failed_count,
        },
        "config": config,
    }


@router.post("/libraries/{library_id}/retry-embeddings")
def retry_failed_embeddings(library_id: int, request: Request):
    """Retry failed chunk embeddings for a library."""
    conn = psycopg2.connect(DATABASE_URL)
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            cur.execute("SELECT * FROM libraries WHERE id = %s", (library_id,))
            lib_row = cur.fetchone()
            if not lib_row:
                raise HTTPException(status_code=404, detail="Library not found")
            check_library_write_access(dict(lib_row), request)

            # Get failed chunks
            cur.execute("""
                SELECT fe.id, fe.chunk_id, c.text
                FROM failed_embeddings fe
                JOIN chunks c ON c.id = fe.chunk_id
                WHERE fe.library_id = %s
                ORDER BY fe.created_at
                LIMIT 100
            """, (library_id,))
            rows = cur.fetchall()
    finally:
        conn.close()

    if not rows:
        return {"retried": 0, "succeeded": 0, "failed": 0}

    succeeded = 0
    still_failed = 0
    batch_size = 32

    for i in range(0, len(rows), batch_size):
        batch = rows[i:i + batch_size]
        chunk_ids = [r["chunk_id"] for r in batch]
        texts = [r["text"] for r in batch]
        fe_ids = [r["id"] for r in batch]

        try:
            embeddings = embed_texts(texts)
            conn = psycopg2.connect(DATABASE_URL)
            try:
                with conn.cursor() as cur:
                    for cid, emb, feid in zip(chunk_ids, embeddings, fe_ids):
                        cur.execute("UPDATE chunks SET embedding = %s WHERE id = %s", (str(emb), cid))
                        cur.execute("DELETE FROM failed_embeddings WHERE id = %s", (feid,))
                        succeeded += 1
                    conn.commit()
            finally:
                conn.close()
        except Exception as e:
            # Update attempt count
            conn = psycopg2.connect(DATABASE_URL)
            try:
                with conn.cursor() as cur:
                    for feid in fe_ids:
                        cur.execute("""
                            UPDATE failed_embeddings
                            SET attempts = attempts + 1, last_attempt = NOW(), error = %s
                            WHERE id = %s
                        """, (str(e)[:500], feid))
                    conn.commit()
            finally:
                conn.close()
            still_failed += len(batch)
            logger.warning("retry_embedding_failed", extra={"extra": {
                "library_id": library_id, "batch_size": len(batch), "error": str(e)[:200],
            }})

    return {"retried": len(rows), "succeeded": succeeded, "failed": still_failed}
