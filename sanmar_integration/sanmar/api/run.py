"""Programmatic uvicorn entrypoint for the Phase 10 API.

Used by tests + the systemd unit wrapper. The Typer CLI's ``serve-api``
subcommand reuses this so a single uvicorn-launch path exists for the
whole project.
"""
from __future__ import annotations

import os
from typing import Optional

import uvicorn

from sanmar.api.app import app


def serve(host: Optional[str] = None, port: Optional[int] = None) -> None:
    """Block-serve the FastAPI app via uvicorn.

    Resolves ``host`` / ``port`` from arguments first, then env vars
    (``SANMAR_API_HOST`` / ``SANMAR_API_PORT``), then sane defaults.
    """
    bind_host = host or os.getenv("SANMAR_API_HOST", "0.0.0.0")
    bind_port = port if port is not None else int(os.getenv("SANMAR_API_PORT", "8000"))
    uvicorn.run(app, host=bind_host, port=bind_port, reload=False)


if __name__ == "__main__":  # pragma: no cover - exercised by systemd
    serve()
