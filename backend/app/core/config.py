from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    CANVAS_WIDTH: int = 200
    CANVAS_HEIGHT: int = 150
    COOLDOWN_SECONDS: int = 30  # 0.5 minutes
    ALLOWED_COLORS: list = [
        "#FFFFFF", "#E4E4E4", "#888888", "#222222",
        "#FFA7D1", "#E50000", "#E59500", "#A06A42",
        "#E5D900", "#94E044", "#02BE01", "#00D3DD",
        "#0083C7", "#0000EA", "#CF6EE4", "#820080"
    ]

    class Config:
        env_file = ".env"

settings = Settings()