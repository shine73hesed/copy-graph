"""ALE Phase 1 — 설정"""
import os
from dataclasses import dataclass, field
from dotenv import load_dotenv

load_dotenv()


@dataclass
class Settings:
    SECRET_KEY: str = field(default_factory=lambda: os.getenv("SECRET_KEY", "ale-pilot-secret-2026"))


settings = Settings()
