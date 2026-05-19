from pathlib import Path
import os

from dotenv import load_dotenv


class ConfigurationService:
    """Service for loading and reading environment variables."""

    def __init__(self) -> None:
        load_dotenv()

    def get(self, name: str) -> str | None:
        value = os.getenv(name)
        if not value:
            raise ValueError(f"{name} is not set in environment variables.")
        return value

    def get_optional(self, name: str, default: str | None = None) -> str | None:
        return os.getenv(name, default)

    def get_ai_system_prompt(self) -> str:
        prompt_path = Path(__file__).resolve().parents[3] / "resources" / "ai" / "system.prompt.txt"
        return prompt_path.read_text(encoding="utf-8")
