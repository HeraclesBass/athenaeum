"""Shared auth helpers for public/private library access control."""

from fastapi import HTTPException, Request


def require_auth(request: Request) -> str:
    """Raise 401 if no authenticated user. Return username."""
    user = request.state.remote_user
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user


def is_admin(request: Request) -> bool:
    """Check if user is in admins group."""
    return "admins" in request.state.remote_groups


def check_library_read_access(library_row: dict, request: Request):
    """Check read access: public libraries pass; private require owner/admin or 404."""
    if library_row.get("visibility", "private") == "public":
        return
    user = request.state.remote_user
    if not user:
        raise HTTPException(status_code=404, detail="Library not found")
    if library_row.get("owner") == user or is_admin(request):
        return
    raise HTTPException(status_code=404, detail="Library not found")


def check_library_write_access(library_row: dict, request: Request):
    """Check write access: owner or admin, else 403."""
    user = require_auth(request)
    if library_row.get("owner") == user or is_admin(request):
        return
    raise HTTPException(status_code=403, detail="Only the library owner or admins can modify")
