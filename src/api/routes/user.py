"""User identity endpoint."""

from fastapi import APIRouter, Request

router = APIRouter()


@router.get("/me")
def get_current_user(request: Request):
    """Return current user info, or anonymous status."""
    user = request.state.remote_user
    if not user:
        return {"authenticated": False}

    groups = [g.strip() for g in request.state.remote_groups.split(",") if g.strip()]
    return {
        "authenticated": True,
        "username": user,
        "display_name": request.state.remote_name or user,
        "email": request.state.remote_email or None,
        "groups": groups,
        "is_admin": "admins" in groups,
    }
