import os
from pydantic import BaseModel


class Settings(BaseModel):
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./data.sqlite3")
    secret_key: str = os.getenv("SECRET_KEY", "dev-secret-key-change")
    access_token_expire_minutes: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "180"))
    max_bot_token: str = os.getenv("MAX_BOT_TOKEN", "f9LHodD0cOL5W8EQiGLI9ISi4E_iHinEt5vCyTmrqDJxDSEi11qY1q_libk7rmyRUI8Lp_o94V1zojAW13-k")


settings = Settings()


