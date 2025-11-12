from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, Table, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..db import Base


# Промежуточные таблицы для many-to-many связей
task_tag = Table(
    "task_tag",
    Base.metadata,
    Column("task_id", ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)

note_tag = Table(
    "note_tag",
    Base.metadata,
    Column("note_id", ForeignKey("notes.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


class Tag(Base):
    __tablename__ = "tags"
    
    id = Column(Integer, primary_key=True)
    name = Column(String(64), unique=True, nullable=False, index=True)
    color = Column(String(7), nullable=True)  # hex color like #FF5733


class Task(Base):
    __tablename__ = "tasks"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    due_at = Column(DateTime(timezone=True), nullable=True)
    is_completed = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    tags = relationship("Tag", secondary=task_tag, backref="tasks", lazy="joined")


class Folder(Base):
    __tablename__ = "folders"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    is_default = Column(Boolean, nullable=False, default=False)  # Папка "Все"
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    notes = relationship("Note", back_populates="folder", cascade="all, delete-orphan")


class Note(Base):
    __tablename__ = "notes"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    folder_id = Column(Integer, ForeignKey("folders.id", ondelete="SET NULL"), nullable=True, index=True)
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=True)
    is_favorite = Column(Boolean, nullable=False, default=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    folder = relationship("Folder", back_populates="notes")
    tags = relationship("Tag", secondary=note_tag, backref="notes", lazy="joined")
    deadline = relationship("Deadline", back_populates="note", uselist=False, cascade="all, delete-orphan")


class Deadline(Base):
    __tablename__ = "deadlines"
    
    id = Column(Integer, primary_key=True)
    note_id = Column(Integer, ForeignKey("notes.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    deadline_at = Column(DateTime(timezone=True), nullable=False)
    notification_enabled = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    note = relationship("Note", back_populates="deadline")
    notifications = relationship("DeadlineNotification", back_populates="deadline", cascade="all, delete-orphan")


class DeadlineNotification(Base):
    __tablename__ = "deadline_notifications"
    
    id = Column(Integer, primary_key=True)
    deadline_id = Column(Integer, ForeignKey("deadlines.id", ondelete="CASCADE"), nullable=False, index=True)
    notification_type = Column(String(10), nullable=False)  # "14d", "7d", "3d", "1d", "12h", "6h", "3h", "1h", "30m", "expired"
    sent_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    deadline = relationship("Deadline", back_populates="notifications")
    
    __table_args__ = (
        UniqueConstraint('deadline_id', 'notification_type', name='uq_deadline_notification'),
    )
