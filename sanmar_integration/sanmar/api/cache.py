"""In-process TTL+LRU cache for high-traffic read endpoints.

The cache is keyed on the URL path + sorted query string so two
requests that differ only in query-parameter ordering still hit the
same entry. Bounded by ``max_entries`` (default 1024) with a per-entry
TTL (default 30s) — both tunable per call site via the
:func:`cache_response` decorator.

Statelessness: the decorator caches *response payloads*, not session
state, so the API stays horizontally scalable. Each uvicorn worker
keeps its own cache; that's fine because TTLs are short and the
SQLite read is cheap.
"""
from __future__ import annotations

import time
from collections import OrderedDict
from functools import wraps
from threading import Lock
from typing import Any, Callable

from fastapi import Request

DEFAULT_TTL_SECONDS: int = 30
DEFAULT_MAX_ENTRIES: int = 1024


class _TTLCache:
    """OrderedDict-backed TTL+LRU store. Internal — use the decorator."""

    __slots__ = ("_data", "_lock", "_max_entries")

    def __init__(self, max_entries: int) -> None:
        self._data: OrderedDict[str, tuple[float, Any]] = OrderedDict()
        self._lock = Lock()
        self._max_entries = max_entries

    def get(self, key: str, ttl: float) -> tuple[bool, Any]:
        """Return ``(hit, value)``. Prunes expired entries on read."""
        now = time.monotonic()
        with self._lock:
            entry = self._data.get(key)
            if entry is None:
                return False, None
            stored_at, value = entry
            if now - stored_at > ttl:
                self._data.pop(key, None)
                return False, None
            self._data.move_to_end(key)
            return True, value

    def set(self, key: str, value: Any) -> None:
        """Store ``value`` for ``key``, evicting the LRU entry if full."""
        now = time.monotonic()
        with self._lock:
            self._data[key] = (now, value)
            self._data.move_to_end(key)
            while len(self._data) > self._max_entries:
                self._data.popitem(last=False)

    def clear(self) -> None:
        """Drop every entry — used by tests."""
        with self._lock:
            self._data.clear()

    def __len__(self) -> int:
        with self._lock:
            return len(self._data)


def _request_cache_key(request: Request) -> str:
    """Build a stable cache key from path + sorted query string + app id.

    The ``app id`` slice is what keeps tests isolated — each test
    constructs a fresh FastAPI app via ``create_app()`` so the same
    ``GET /products`` URL maps to a different cache entry per test.
    Without this, the empty-DB response from test #2 would be served
    back to test #3 on a different engine.
    """
    path = request.url.path
    items = sorted(request.query_params.multi_items())
    qs = "&".join(f"{k}={v}" for k, v in items)
    app_id = id(request.app)
    base = f"{path}?{qs}" if qs else path
    return f"{app_id}:{base}"


def cache_response(
    ttl_seconds: int = DEFAULT_TTL_SECONDS,
    *,
    max_entries: int = DEFAULT_MAX_ENTRIES,
) -> Callable:
    """Decorator: cache a FastAPI route's return value.

    The wrapped function must accept a ``request: Request`` parameter
    so the decorator can compute a cache key from the URL.
    """
    store = _TTLCache(max_entries=max_entries)

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
            request: Request | None = kwargs.get("request")
            if request is None:
                for arg in args:
                    if isinstance(arg, Request):
                        request = arg
                        break
            if request is None:
                return await func(*args, **kwargs)

            key = _request_cache_key(request)
            hit, value = store.get(key, ttl_seconds)
            if hit:
                return value
            value = await func(*args, **kwargs)
            store.set(key, value)
            return value

        async_wrapper.cache = store  # type: ignore[attr-defined]
        return async_wrapper

    return decorator
