"""Library CRUD — create, list, get, update, delete libraries."""

import re
from typing import Literal

import psycopg2
import psycopg2.extras
from fastapi import APIRouter, HTTPException, Request, Query
from pydantic import BaseModel

from config.settings import DATABASE_URL
from src.api.auth import require_auth, is_admin, check_library_read_access, check_library_write_access

router = APIRouter()


class LibraryCreate(BaseModel):
    name: str
    slug: str
    description: str = ""
    visibility: Literal["public", "private"] = "private"
    config: dict = {}


class LibraryUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    visibility: Literal["public", "private"] | None = None
    config: dict | None = None


class LibraryResponse(BaseModel):
    id: int
    slug: str
    name: str
    description: str | None
    owner: str | None
    visibility: str
    config: dict
    created_at: str
    updated_at: str
    document_count: int = 0
    chunk_count: int = 0


def _validate_slug(slug: str):
    if not re.match(r'^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$', slug):
        raise HTTPException(status_code=400, detail="Slug must be lowercase letters, digits, and hyphens")


@router.get("/libraries", response_model=list[LibraryResponse])
def list_libraries(request: Request):
    """List libraries filtered by access: anon sees public, authed sees public + own, admin sees all."""
    user = request.state.remote_user
    groups = request.state.remote_groups

    conn = psycopg2.connect(DATABASE_URL)
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            if user and "admins" in groups:
                where = ""
                params: list = []
            elif user:
                where = "WHERE (l.visibility = 'public' OR l.owner = %s)"
                params = [user]
            else:
                where = "WHERE l.visibility = 'public'"
                params = []

            cur.execute(f"""
                SELECT l.*,
                       COALESCE(d.doc_count, 0) as document_count,
                       COALESCE(c.chunk_count, 0) as chunk_count
                FROM libraries l
                LEFT JOIN (
                    SELECT library_id, COUNT(*) as doc_count FROM documents GROUP BY library_id
                ) d ON d.library_id = l.id
                LEFT JOIN (
                    SELECT library_id, COUNT(*) as chunk_count FROM chunks WHERE embedding IS NOT NULL GROUP BY library_id
                ) c ON c.library_id = l.id
                {where}
                ORDER BY l.updated_at DESC
            """, params)
            rows = cur.fetchall()
    finally:
        conn.close()

    return [
        LibraryResponse(
            id=row["id"],
            slug=row["slug"],
            name=row["name"],
            description=row["description"],
            owner=row["owner"],
            visibility=row["visibility"],
            config=row["config"] or {},
            created_at=str(row["created_at"]),
            updated_at=str(row["updated_at"]),
            document_count=row["document_count"],
            chunk_count=row["chunk_count"],
        )
        for row in rows
    ]


@router.post("/libraries", response_model=LibraryResponse, status_code=201)
def create_library(lib: LibraryCreate, request: Request):
    """Create a new library (authenticated users only)."""
    user = require_auth(request)
    _validate_slug(lib.slug)

    conn = psycopg2.connect(DATABASE_URL)
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            # Library creation quotas
            max_libs = 100 if is_admin(request) else 10
            cur.execute("SELECT COUNT(*) FROM libraries WHERE owner = %s", (user,))
            count = cur.fetchone()[0]
            if count >= max_libs:
                raise HTTPException(status_code=403, detail=f"Library limit reached ({max_libs})")

            cur.execute(
                "SELECT id FROM libraries WHERE slug = %s", (lib.slug,)
            )
            if cur.fetchone():
                raise HTTPException(status_code=409, detail=f"Library with slug '{lib.slug}' already exists")

            cur.execute("""
                INSERT INTO libraries (slug, name, description, owner, visibility, config)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING *
            """, (lib.slug, lib.name, lib.description, user, lib.visibility,
                  psycopg2.extras.Json(lib.config)))
            row = cur.fetchone()
            conn.commit()
    finally:
        conn.close()

    return LibraryResponse(
        id=row["id"],
        slug=row["slug"],
        name=row["name"],
        description=row["description"],
        owner=row["owner"],
        visibility=row["visibility"],
        config=row["config"] or {},
        created_at=str(row["created_at"]),
        updated_at=str(row["updated_at"]),
    )


@router.get("/libraries/{library_id}", response_model=LibraryResponse)
def get_library(library_id: int, request: Request):
    """Get library detail with corpus stats."""
    conn = psycopg2.connect(DATABASE_URL)
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            cur.execute("""
                SELECT l.*,
                       COALESCE(d.doc_count, 0) as document_count,
                       COALESCE(c.chunk_count, 0) as chunk_count
                FROM libraries l
                LEFT JOIN (
                    SELECT library_id, COUNT(*) as doc_count FROM documents GROUP BY library_id
                ) d ON d.library_id = l.id
                LEFT JOIN (
                    SELECT library_id, COUNT(*) as chunk_count FROM chunks WHERE embedding IS NOT NULL GROUP BY library_id
                ) c ON c.library_id = l.id
                WHERE l.id = %s
            """, (library_id,))
            row = cur.fetchone()
    finally:
        conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Library not found")

    check_library_read_access(dict(row), request)

    return LibraryResponse(
        id=row["id"],
        slug=row["slug"],
        name=row["name"],
        description=row["description"],
        owner=row["owner"],
        visibility=row["visibility"],
        config=row["config"] or {},
        created_at=str(row["created_at"]),
        updated_at=str(row["updated_at"]),
        document_count=row["document_count"],
        chunk_count=row["chunk_count"],
    )


@router.get("/libraries/by-slug/{slug}", response_model=LibraryResponse)
def get_library_by_slug(slug: str, request: Request):
    """Get library by slug with corpus stats."""
    conn = psycopg2.connect(DATABASE_URL)
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            cur.execute("""
                SELECT l.*,
                       COALESCE(d.doc_count, 0) as document_count,
                       COALESCE(c.chunk_count, 0) as chunk_count
                FROM libraries l
                LEFT JOIN (
                    SELECT library_id, COUNT(*) as doc_count FROM documents GROUP BY library_id
                ) d ON d.library_id = l.id
                LEFT JOIN (
                    SELECT library_id, COUNT(*) as chunk_count FROM chunks WHERE embedding IS NOT NULL GROUP BY library_id
                ) c ON c.library_id = l.id
                WHERE l.slug = %s
            """, (slug,))
            row = cur.fetchone()
    finally:
        conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Library not found")

    check_library_read_access(dict(row), request)

    return LibraryResponse(
        id=row["id"],
        slug=row["slug"],
        name=row["name"],
        description=row["description"],
        owner=row["owner"],
        visibility=row["visibility"],
        config=row["config"] or {},
        created_at=str(row["created_at"]),
        updated_at=str(row["updated_at"]),
        document_count=row["document_count"],
        chunk_count=row["chunk_count"],
    )


@router.patch("/libraries/{library_id}", response_model=LibraryResponse)
def update_library(library_id: int, update: LibraryUpdate, request: Request):
    """Update library config (owner or admin only)."""
    conn = psycopg2.connect(DATABASE_URL)
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            cur.execute("SELECT * FROM libraries WHERE id = %s", (library_id,))
            existing = cur.fetchone()
            if not existing:
                raise HTTPException(status_code=404, detail="Library not found")

            check_library_write_access(dict(existing), request)

            sets = []
            params = []
            if update.name is not None:
                sets.append("name = %s")
                params.append(update.name)
            if update.description is not None:
                sets.append("description = %s")
                params.append(update.description)
            if update.visibility is not None:
                sets.append("visibility = %s")
                params.append(update.visibility)
            if update.config is not None:
                sets.append("config = %s")
                params.append(psycopg2.extras.Json(update.config))

            if not sets:
                raise HTTPException(status_code=400, detail="Nothing to update")

            sets.append("updated_at = NOW()")
            params.append(library_id)

            cur.execute(f"""
                UPDATE libraries SET {', '.join(sets)} WHERE id = %s RETURNING *
            """, params)
            row = cur.fetchone()
            conn.commit()
    finally:
        conn.close()

    return LibraryResponse(
        id=row["id"],
        slug=row["slug"],
        name=row["name"],
        description=row["description"],
        owner=row["owner"],
        visibility=row["visibility"],
        config=row["config"] or {},
        created_at=str(row["created_at"]),
        updated_at=str(row["updated_at"]),
    )


@router.delete("/libraries/{library_id}", status_code=204)
def delete_library(library_id: int, request: Request):
    """Delete a library and all its content (owner or admin only)."""
    conn = psycopg2.connect(DATABASE_URL)
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            cur.execute("SELECT * FROM libraries WHERE id = %s", (library_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Library not found")

            check_library_write_access(dict(row), request)

            cur.execute("DELETE FROM libraries WHERE id = %s", (library_id,))
            conn.commit()
    finally:
        conn.close()
