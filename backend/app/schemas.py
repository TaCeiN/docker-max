from typing import Optional, Any
from datetime import datetime
from pydantic import BaseModel, field_serializer, model_validator


class UserCreate(BaseModel):
    username: str
    uuid: str


class UserOut(BaseModel):
    id: int
    username: str
    uuid: str
    created_at: str

    @model_validator(mode='before')
    @classmethod
    def convert_created_at(cls, data: Any) -> Any:
        """Конвертирует datetime в ISO строку перед созданием модели"""
        if isinstance(data, dict):
            created_at = data.get('created_at')
            if isinstance(created_at, datetime):
                data['created_at'] = created_at.isoformat()
        elif hasattr(data, 'created_at'):
            # Если это SQLAlchemy модель
            created_at = getattr(data, 'created_at', None)
            if isinstance(created_at, datetime):
                # Создаем словарь с конвертированным значением
                if not isinstance(data, dict):
                    # Если data - это объект SQLAlchemy, преобразуем в словарь
                    result = {
                        'id': getattr(data, 'id', None),
                        'username': getattr(data, 'username', None),
                        'uuid': getattr(data, 'uuid', None),
                        'created_at': created_at.isoformat()
                    }
                    return result
                else:
                    data['created_at'] = created_at.isoformat()
        return data

    @field_serializer('created_at')
    def serialize_created_at(self, value: Any, _info) -> str:
        """Конвертирует datetime в ISO строку для сериализации (дополнительная проверка)"""
        if isinstance(value, datetime):
            return value.isoformat()
        return str(value)

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

    @model_validator(mode='before')
    @classmethod
    def convert_created_at(cls, data: Any) -> Any:
        """Конвертирует datetime в ISO строку перед созданием модели"""
        if isinstance(data, dict):
            created_at = data.get('created_at')
            if isinstance(created_at, datetime):
                data['created_at'] = created_at.isoformat()
        elif hasattr(data, 'created_at'):
            # Если это SQLAlchemy модель
            created_at = getattr(data, 'created_at', None)
            if isinstance(created_at, datetime):
                # Создаем словарь с конвертированным значением
                if not isinstance(data, dict):
                    # Если data - это объект SQLAlchemy, преобразуем в словарь
                    result = {
                        'id': getattr(data, 'id', None),
                        'name': getattr(data, 'name', None),
                        'is_default': getattr(data, 'is_default', None),
                        'created_at': created_at.isoformat()
                    }
                    return result
                else:
                    data['created_at'] = created_at.isoformat()
        return data

    @field_serializer('created_at')
    def serialize_created_at(self, value: Any, _info) -> str:
        """Конвертирует datetime в ISO строку для сериализации (дополнительная проверка)"""
        if isinstance(value, datetime):
            return value.isoformat()
        return str(value)

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


# User Settings
class UserSettingsOut(BaseModel):
    id: int
    user_id: int
    language: str  # "ru" or "en"
    theme: str  # "light" or "dark"
    notification_times_minutes: list[int]  # Массив минут до дедлайна для уведомлений (до 10 штук)

    class Config:
        from_attributes = True


class UserSettingsUpdate(BaseModel):
    language: str | None = None  # "ru" or "en"
    theme: str | None = None  # "light" or "dark"
    notification_times_minutes: list[int] | None = None  # Массив минут до дедлайна (до 10 штук)

