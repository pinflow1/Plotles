import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr
from pydantic.alias_generators import to_camel

from app.models import CollaboratorRole


class CamelModel(BaseModel):
    """Base for response schemas: Python stays snake_case, JSON goes out
    camelCase to match the frontend's TypeScript types."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


class UserOut(CamelModel):
    id: uuid.UUID
    email: EmailStr
    pen_name: str
    avatar_url: str | None = None


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    pen_name: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    token: str
    user: UserOut


class ProjectOut(CamelModel):
    id: uuid.UUID
    title: str
    description: str | None = None
    cover_url: str | None = None
    chapter_count: int = 0
    progress: int | None = None
    updated_at: datetime
    role: CollaboratorRole


class ProjectCreateRequest(BaseModel):
    title: str
    description: str | None = None


class ChapterOut(CamelModel):
    id: uuid.UUID
    project_id: uuid.UUID
    title: str
    order_index: int
    word_count: int
    updated_at: datetime


class CollaboratorOut(CamelModel):
    user_id: uuid.UUID
    pen_name: str
    avatar_url: str | None = None
    role: CollaboratorRole


class InviteCollaboratorRequest(BaseModel):
    email: EmailStr
    role: CollaboratorRole = CollaboratorRole.view


class IdeaOut(CamelModel):
    id: uuid.UUID
    project_id: uuid.UUID | None = None
    body: str
    created_at: datetime


class IdeaCreateRequest(BaseModel):
    body: str
    project_id: uuid.UUID | None = None


class LiveblocksAuthRequest(BaseModel):
    room: str
