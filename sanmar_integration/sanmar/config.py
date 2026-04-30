"""Settings loader for the SanMar integration.

Reads `.env` via python-dotenv and surfaces a typed `Settings` object built
on Pydantic v2. All access goes through the cached `get_settings()` helper.
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal, Optional

from dotenv import load_dotenv
from pydantic import Field, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict

# Load .env once at import time, but don't fail if it's absent (tests).
load_dotenv(override=False)


class Settings(BaseSettings):
    """Typed runtime configuration sourced from environment / .env."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_prefix="SANMAR_",
        extra="ignore",
        case_sensitive=False,
    )

    customer_id: str = Field(default="", description="SanMar EDI customer id")
    password: str = Field(default="", description="SanMar EDI password")
    media_password: str = Field(
        default="", description="SanMar media-content password"
    )
    env: Literal["uat", "prod"] = Field(
        default="uat", description="Which SanMar environment to target"
    )
    base_url_uat: str = Field(
        default="https://edi.atc-apparel.com/uat-ws/promostandards/",
        description="UAT PromoStandards base URL",
    )
    base_url_prod: str = Field(
        default="https://edi.atc-apparel.com/pstd/",
        description="Production PromoStandards base URL",
    )
    db_path: Path = Field(
        default=Path("./data/sanmar_local.db"),
        description="Path to the local SQLite cache",
    )
    catalog_xlsx: Path = Field(
        default=Path("./data/master_catalog.xlsx"),
        description="Path to the SanMar master catalog XLSX",
    )
    alert_webhook_url: Optional[str] = Field(
        default=None,
        description=(
            "Optional Slack/Zapier incoming-webhook URL for sync failure "
            "and order transition alerts. Unset = no alerts (no-op)."
        ),
    )
    customer_webhook_url: Optional[str] = Field(
        default=None,
        description=(
            "Optional outbound HTTP endpoint for customer-facing order "
            "transitions (status 60/75/80/99). Unset = no webhooks "
            "fired. See docs/SANMAR_WEBHOOKS.md for the contract."
        ),
    )
    customer_webhook_secret: Optional[str] = Field(
        default=None,
        description=(
            "Shared secret used to sign outbound customer webhook "
            "payloads (HMAC-SHA256, hex-encoded). Sent in the "
            "X-Sanmar-Signature header and mirrored into the body."
        ),
    )

    @computed_field  # type: ignore[prop-decorator]
    @property
    def base_url(self) -> str:
        """Resolve the active PromoStandards base URL for `env`."""
        return self.base_url_prod if self.env == "prod" else self.base_url_uat


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a cached `Settings` instance."""
    return Settings()
