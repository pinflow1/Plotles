import uuid

import httpx
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import CollaboratorRole, ProjectAccess, User

settings = get_settings()

LIVEBLOCKS_AUTHORIZE_URL = "https://api.liveblocks.io/v2/authorize-user"


def _permission_for_role(role: CollaboratorRole) -> str:
    return "room:write" if role in (CollaboratorRole.owner, CollaboratorRole.edit) else "room:read"


async def authorize_room(db: Session, user: User, room: str) -> dict:
    """
    room ids are namespaced as "project:<project_id>". We look up the
    caller's role on that project and mint a Liveblocks token scoped to
    exactly that permission — never broader.
    """
    if not room.startswith("project:"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unrecognized room")

    try:
        project_id = uuid.UUID(room.removeprefix("project:"))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid room id") from exc

    access = db.execute(
        select(ProjectAccess).where(
            ProjectAccess.project_id == project_id, ProjectAccess.user_id == user.id
        )
    ).scalar_one_or_none()
    if access is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No access to this project")

    if not settings.liveblocks_secret_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="LIVEBLOCKS_SECRET_KEY is not configured",
        )

    async with httpx.AsyncClient() as client:
        response = await client.post(
            LIVEBLOCKS_AUTHORIZE_URL,
            headers={"Authorization": f"Bearer {settings.liveblocks_secret_key}"},
            json={
                "userId": str(user.id),
                "userInfo": {"name": user.pen_name, "avatar": user.avatar_url},
                "permissions": {room: [_permission_for_role(access.role)]},
            },
            timeout=10.0,
        )

    if response.status_code >= 400:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Liveblocks authorization failed: {response.text}",
        )

    return response.json()
