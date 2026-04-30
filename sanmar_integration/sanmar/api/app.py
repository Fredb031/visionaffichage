"""FastAPI application — read-only HTTP front door for the SQLite cache.

Wires up routers (``products``, ``inventory``, ``pricing``, ``health``,
``metrics``), CORS for the storefront origin (config-driven via the
``SANMAR_API_CORS_ORIGINS`` env var), GZip compression, and a lifespan
hook that resolves :func:`sanmar.config.get_settings` once and opens a
single SQLAlchemy engine for the lifetime of the process.

The engine is exposed via the :func:`get_engine` dependency so route
handlers don't import :mod:`sanmar.db` directly — tests override the
dependency to point at an in-memory SQLite via FastAPI's
``app.dependency_overrides``.
"""
from __future__ import annotations

import os
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from sqlalchemy.engine import Engine

from sanmar.api.rate_limit import limiter
from sanmar.config import get_settings
from sanmar.db import init_schema, make_engine

# Static fallback CORS allowlist when ``SANMAR_API_CORS_ORIGINS`` isn't
# set. Covers the Vision Affichage front-end + local Vite dev. Vercel
# preview deployments are matched via the regex below.
DEFAULT_ALLOWED_ORIGINS: list[str] = [
    "http://localhost:5173",
    "https://visionaffichage.com",
]
ALLOWED_ORIGIN_REGEX: str = r"https://.*\.vercel\.app"


def _resolve_cors_origins() -> list[str]:
    """Parse ``SANMAR_API_CORS_ORIGINS`` (comma-separated) → list.

    A literal ``*`` in the env var is honoured; otherwise origins are
    split on commas and stripped. Missing / empty env → fall back to
    :data:`DEFAULT_ALLOWED_ORIGINS`.
    """
    raw = os.getenv("SANMAR_API_CORS_ORIGINS", "").strip()
    if not raw:
        return DEFAULT_ALLOWED_ORIGINS
    if raw == "*":
        return ["*"]
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


def _build_engine() -> Engine:
    """Resolve settings + open the SQLite engine.

    Extracted so the lifespan hook + tests can call it identically.
    Schema is ensured (no-op on an already-initialised DB) so the API
    boots cleanly on a fresh box.
    """
    settings = get_settings()
    engine = make_engine(settings.db_path)
    init_schema(engine)
    return engine


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Open the engine on startup, dispose on shutdown.

    The engine lives on ``app.state.engine`` and is exposed to route
    handlers via the :func:`get_engine` dependency — see the docstring
    on that function for the test-override pattern.
    """
    engine = _build_engine()
    app.state.engine = engine
    try:
        yield
    finally:
        engine.dispose()


def get_engine(request: Request) -> Engine:
    """FastAPI dependency returning the per-app SQLAlchemy engine.

    Tests override this with ``app.dependency_overrides[get_engine] =
    lambda: test_engine`` so route handlers see the in-memory DB.
    """
    return request.app.state.engine


def _rate_limit_exceeded_handler(
    request: Request, exc: RateLimitExceeded
) -> JSONResponse:
    """Return 429 with a ``Retry-After`` header for the failing window.

    slowapi computes ``exc.detail`` as e.g. ``"60 per 1 minute"``; we
    surface that string in the body so clients can log it, and pin
    ``Retry-After: 60`` so well-behaved clients back off without
    parsing the message. The :class:`Limiter`'s reset-time helper is
    not used here because slowapi's API around it churns between
    versions — a fixed 60s back-off matches every limit we ship.
    """
    response = JSONResponse(
        status_code=429,
        content={
            "error": "rate_limit_exceeded",
            "detail": str(exc.detail),
        },
    )
    response.headers["Retry-After"] = "60"
    return response


def create_app() -> FastAPI:
    """Build a fresh FastAPI app — exposed for tests + ``__main__``.

    Tests instantiate via ``create_app()`` then override
    :func:`get_engine`. Production goes through the module-level
    :data:`app` singleton.
    """
    application = FastAPI(
        title="SanMar Local Cache API",
        description=(
            "Read-only HTTP API serving product / inventory / pricing "
            "data from the local SanMar SQLite cache. Phase 10 of the "
            "SanMar Python integration."
        ),
        version="0.1.0",
        lifespan=lifespan,
    )

    # Phase 13: bind the slowapi limiter + register the 429 handler.
    # The handler wraps slowapi's default to guarantee a Retry-After
    # header lands in the response — uptime monitors and reverse
    # proxies expect it for back-off behaviour.
    application.state.limiter = limiter
    application.add_exception_handler(
        RateLimitExceeded, _rate_limit_exceeded_handler
    )

    origins = _resolve_cors_origins()
    application.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        # Only attach the Vercel-preview regex when we're not running
        # in fully-permissive mode — combining ``*`` with a regex
        # confuses Starlette's preflight handler.
        allow_origin_regex=ALLOWED_ORIGIN_REGEX if origins != ["*"] else None,
        allow_credentials=False,  # read-only — no cookies needed
        allow_methods=["GET", "OPTIONS"],
        allow_headers=["*"],
    )
    application.add_middleware(GZipMiddleware, minimum_size=500)

    # Routes are imported here (not at module top) so the import graph
    # forms inside the factory rather than at module load time — that
    # keeps test apps insulated from the prod app.state.engine.
    from sanmar.api.routes import health as health_routes
    from sanmar.api.routes import inventory as inventory_routes
    from sanmar.api.routes import metrics as metrics_routes
    from sanmar.api.routes import pricing as pricing_routes
    from sanmar.api.routes import products as products_routes
    from sanmar.api.routes import track as track_routes

    application.include_router(products_routes.router)
    application.include_router(inventory_routes.router)
    application.include_router(pricing_routes.router)
    application.include_router(metrics_routes.router)
    application.include_router(health_routes.router)
    application.include_router(track_routes.router)

    return application


# Module-level singleton used by ``python -m sanmar.api`` and uvicorn.
app: FastAPI = create_app()
