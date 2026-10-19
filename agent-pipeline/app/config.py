from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, PydanticBaseSettingsSource, SettingsConfigDict

PROMPTS_DIR = Path(__file__).resolve().parent / "prompts"
_ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    cursor_api_key: str = ""
    cursor_model: str = "composer-2.5"
    repo_url: str = "https://github.com/yvettejade/mattermost"
    github_default_branch: str = "master"
    github_token: str = ""
    github_webhook_secret: str = ""
    # Ignored for QA synchronize (noise).
    bot_login_names: str = "cursor,cursor[bot],github-actions[bot],dependabot[bot]"

    jira_base_url: str = ""
    jira_email: str = ""
    jira_api_token: str = ""
    pipeline_webhook_secret: str = ""

    jira_poll_enabled: bool = False
    jira_poll_interval_seconds: int = 60
    jira_poll_jql: str = ""

    slack_webhook_url: str = ""
    database_path: str = "data/pipeline.db"

    @property
    def bot_logins(self) -> set[str]:
        return {part.strip().lower() for part in self.bot_login_names.split(",") if part.strip()}

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls: type[BaseSettings],
        init_settings: PydanticBaseSettingsSource,
        env_settings: PydanticBaseSettingsSource,
        dotenv_settings: PydanticBaseSettingsSource,
        file_secret_settings: PydanticBaseSettingsSource,
    ) -> tuple[PydanticBaseSettingsSource, ...]:
        # Prefer process env over .env so tests can override cleanly.
        return init_settings, env_settings, dotenv_settings, file_secret_settings


@lru_cache
def get_settings() -> Settings:
    return Settings()


def load_prompt(name: str) -> str:
    return (PROMPTS_DIR / name).read_text(encoding="utf-8")
