"""Phase 10 — read-only HTTP API serving the local SQLite cache.

The website's product browse pages will eventually replace per-request
SOAP calls with calls to this service. The API is intentionally
stateless beyond an in-process LRU cache so it can scale horizontally
behind a load balancer.

Importing this package side-effects registration of the
:class:`CachedPricing` ORM model on ``Base.metadata`` so
:func:`sanmar.db.init_schema` can ``create_all`` the table without
:mod:`sanmar.db` having to know about API-side concerns.
"""
from sanmar.api import cache_pricing as _cache_pricing  # noqa: F401
