from typing import Optional
from pydantic import BaseModel


class UserCreate(BaseModel):
    username: str
    uuid: str


class UserOut(BaseModel):
    id: int
    username: str
    uuid: str
    created_at: str

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    username: str
    uuid: str


# Tags
class TagBase(BaseModel):
    name: str


class TagCreate(TagBase):
    pass


class TagOut(TagBase):
    id: int
    color: str | None = None

    class Config:
        from_attributes = True


# Tasks
class TaskBase(BaseModel):
    title: str
    description: str | None = None
    due_at: str | None = None  # ISO string; frontend convenience
    tags_text: str | None = None  # текст с тегами типа "#Учеба #Math"


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    due_at: str | None = None
    is_completed: bool | None = None
    tags_text: str | None = None  # текст с тегами


class TaskOut(BaseModel):
    id: int
    title: str
    description: str | None
    due_at: str | None
    is_completed: bool
    tags: list[TagOut]

    class Config:
        from_attributes = True


# Folders
class FolderBase(BaseModel):
    name: str


class FolderCreate(FolderBase):
    pass


class FolderUpdate(BaseModel):
    name: str | None = None


class FolderOut(BaseModel):
    id: int
    name: str
    is_default: bool
    created_at: str

    class Config:
        from_attributes = True


# Notes
class NoteBase(BaseModel):
    title: str
    content: str | None = None
    tags_text: str | None = None  # текст с тегами
    folder_id: int | None = None


class NoteCreate(NoteBase):
    pass


class NoteUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    tags_text: str | None = None  # текст с тегами
    folder_id: int | None = None


class NoteOut(BaseModel):
    id: int
    title: str
    content: str | None
    folder_id: int | None
    is_favorite: bool = False
    tags: list[TagOut]
    has_deadline_notifications: bool = False  # Есть ли дедлайн с включенными уведомлениями

    class Config:
        from_attributes = True


# Deadlines
class DeadlineCreate(BaseModel):
    note_id: int
    deadline_at: str  # ISO format string


class DeadlineUpdate(BaseModel):
    deadline_at: str | None = None
    notification_enabled: bool | None = None


class DeadlineOut(BaseModel):
    id: int
    note_id: int
    deadline_at: str
    notification_enabled: bool
    days_remaining: int | None = None
    status: str | None = None  # "active", "today", "overdue"
    time_remaining_text: str | None = None

    class Config:
        from_attributes = True

