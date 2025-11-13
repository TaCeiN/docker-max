from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from ..db import Base


class UserSettings(Base):
    __tablename__ = "user_settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    language = Column(String(2), nullable=False, default="ru")  # "ru" or "en"
    theme = Column(String(10), nullable=False, default="dark")  # "light" or "dark"
    notification_times_minutes = Column(JSON, nullable=False, default=lambda: [30])  # Массив минут до дедлайна для уведомлений (до 10 штук)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", backref="settings")

