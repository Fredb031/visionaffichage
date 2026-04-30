"""Public customer-facing /track endpoint (Phase 16).

This is the first *public* (no auth) endpoint on the FastAPI cache
layer. The Vision Affichage storefront's `/suivi/:orderNumber` page
calls it directly through the Cloudflare Worker, which is why we want
the full payload to be edge-cacheable and the security model to live
entirely inside the request itself rather than relying on an upstream
gate.

Security model — three layers stacked so a bug in one doesn't leak
customer data:

1. **Rate limit** — slowapi caps callers at 10/min per source IP.
   Tighter than /products (60/min) because the only legitimate caller
   is a single customer hitting refresh. A scraper iterating PO
   numbers gets 429'd inside the first minute.
2. **Email verification** — the caller must pass `?email=` matching
   the ``customer_email`` on the order, case-insensitive. The match
   is performed *after* the row is fetched so a timing attack on the
   email comparison can't reveal whether a PO exists.
3. **Generic 404 on miss** — every failure mode (PO not found, email
   mismatch, customer_email not yet populated on the row) returns the
   same 404 with the same body. We never tell the caller *why* the
   lookup failed; otherwise a "wrong email" response would leak that
   the PO is real.

The response payload is intentionally narrow: order status, expected
ship date, tracking number, line items by style+qty, and a *masked*
shipping address (city + first 3 chars of postal code only). No
billing address, no customer name, no per-line-item pricing. If a
customer needs more, they go through the authenticated Account page.
"""
from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Path, Query, Request
from sqlalchemy import select
from sqlalchemy.engine import Engine

from sanmar.api.app import get_engine
from sanmar.api.rate_limit import limiter
from sanmar.db import session_scope
from sanmar.models import OrderRow

router = APIRouter(prefix="/track", tags=["public"])


# Generic detail used for every miss — see module docstring for why
# we don't differentiate. Pulled out as a constant so tests can assert
# on it without drift between callsites.
_NOT_FOUND_DETAIL: str = (
    "Order not found. Check the order number and email used at checkout."
)


def map_to_4_step(status_id: Optional[int]) -> int:
    """Map SanMar's 8-status PromoStandards chain → 4-step UI progress.

    The storefront timeline only renders 4 milestones (Received →
    Logo proof → In production / shipping → Delivered) so we collapse
    the SanMar codes here rather than duplicating the mapping in JS.
    Cancelled (99) is its own bucket so the UI can switch to the
    rose-tinted cancelled card instead of a half-completed timeline.

    Returns:
        0 for cancelled, 1-4 for active progress, 1 as the safe
        default when a future SanMar code arrives that we haven't
        mapped yet.
    """
    if status_id is None:
        return 1
    if status_id in (10, 11):
        return 1  # Received / acknowledged
    if status_id in (41, 44):
        return 2  # Logo proof / approval hold
    if status_id in (60, 75):
        return 3  # In production / shipping (partial counts as in-flight)
    if status_id == 80:
        return 4  # Delivered
    if status_id == 99:
        return 0  # Cancelled
    return 1


# Bilingual status labels keyed on the 4-step bucket. The storefront
# already renders its own labels but the API surfaces them too so
# Cloudflare-edge cache hits don't depend on the storefront having
# the latest copy. Two-letter language codes match what
# Accept-Language typically carries (we tolerate the full
# ``fr-CA`` / ``en-US`` form by slicing the first two chars).
_STATUS_LABELS: dict[int, dict[str, str]] = {
    0: {"en": "Cancelled", "fr": "Annulée"},
    1: {"en": "Received", "fr": "Reçue"},
    2: {"en": "Logo proof", "fr": "Épreuve du logo"},
    3: {"en": "In production", "fr": "En production"},
    4: {"en": "Delivered", "fr": "Livrée"},
}


def _resolve_lang(accept_language: Optional[str]) -> str:
    """Pick FR vs EN from the Accept-Language header.

    We only ship two languages so a full RFC 7231 q-value parser is
    overkill — the first two chars of the first token tell us which
    bucket to use. Defaults to French because the customer base is
    Québec-first.
    """
    if not accept_language:
        return "fr"
    primary = accept_language.split(",", 1)[0].strip().lower()[:2]
    return "en" if primary == "en" else "fr"


def _mask_shipping_address(addr: Optional[dict]) -> Optional[dict]:
    """Reduce a shipping address to city + postal-code prefix.

    The full street address would be a PII leak on a public endpoint.
    We keep just enough to reassure a customer they're looking at the
    right order ("yes, that's my city, that's my postal code prefix")
    without exposing anything a stranger could use to socially-
    engineer a delivery redirect.

    Postal code prefix = first 3 chars (the Canadian forward
    sortation area), uppercased. Matches the granularity Canada Post
    uses on the public tracking page.
    """
    if not addr:
        return None
    city = addr.get("city")
    postal = addr.get("postal_code") or addr.get("postalCode")
    postal_prefix: Optional[str] = None
    if isinstance(postal, str) and len(postal) >= 3:
        postal_prefix = postal[:3].upper()
    masked: dict[str, Any] = {}
    if city:
        masked["city"] = city
    if postal_prefix:
        masked["postal_prefix"] = postal_prefix
    return masked or None


def _safe_line_items(items: Optional[list]) -> list[dict[str, Any]]:
    """Reduce stored line_items → public-safe ``[{style, qty}]``.

    Any per-line pricing, supplier cost, or internal notes the
    orchestrator might have stashed on the row gets dropped here.
    Whatever new fields land on the upstream row in the future stay
    invisible to the public endpoint until someone explicitly opts
    them in here.
    """
    if not items:
        return []
    out: list[dict[str, Any]] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        style = item.get("style") or item.get("style_number") or item.get("sku")
        qty = item.get("qty") or item.get("quantity")
        if style is None or qty is None:
            continue
        try:
            qty_int = int(qty)
        except (TypeError, ValueError):
            continue
        out.append({"style": str(style), "qty": qty_int})
    return out


@router.get(
    "/{po_number}",
    name="track_order",
    summary="Public order tracking lookup (rate-limited, email-gated)",
)
@limiter.limit("10/minute")
async def track_order(
    request: Request,
    po_number: str = Path(
        ...,
        min_length=4,
        max_length=64,
        description="SanMar PO number from the checkout confirmation email",
    ),
    email: str = Query(
        ...,
        pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$",
        description="Email used at checkout — must match the order on file",
    ),
    accept_language: Optional[str] = Header(default=None, alias="Accept-Language"),
    engine: Engine = Depends(get_engine),
) -> dict[str, Any]:
    """Return the masked tracking payload for an order, gated on email.

    See module docstring for the full security model. The handler is
    intentionally short — most of the surface area (label mapping,
    address masking, line-item filtering) lives in the helpers above
    so each piece can be unit-tested in isolation if we ever need to
    chase a regression.
    """
    lang = _resolve_lang(accept_language)
    email_normalised = email.strip().lower()

    with session_scope(engine) as session:
        row = session.execute(
            select(OrderRow).where(OrderRow.po_number == po_number)
        ).scalar_one_or_none()

        # Single 404 for every miss — see module docstring rationale.
        if row is None:
            raise HTTPException(status_code=404, detail=_NOT_FOUND_DETAIL)
        if not row.customer_email:
            raise HTTPException(status_code=404, detail=_NOT_FOUND_DETAIL)
        if row.customer_email.strip().lower() != email_normalised:
            raise HTTPException(status_code=404, detail=_NOT_FOUND_DETAIL)

        current_step = map_to_4_step(row.status_id)
        labels = _STATUS_LABELS.get(current_step, _STATUS_LABELS[1])
        # ``tracking_numbers`` is a JSON list — surface the first one
        # because the storefront's UI renders a single tracking row.
        # The full list is intentionally not exposed; we'll add a
        # follow-up endpoint when we ship multi-shipment UI.
        tracking_number: Optional[str] = None
        if row.tracking_numbers:
            for candidate in row.tracking_numbers:
                if isinstance(candidate, str) and candidate.strip():
                    tracking_number = candidate.strip()
                    break

        payload: dict[str, Any] = {
            "po_number": row.po_number,
            "status_id": row.status_id,
            "status_label": labels[lang],
            "current_step": current_step,
            "expected_ship_date": (
                row.expected_ship_date.isoformat()
                if row.expected_ship_date is not None
                else None
            ),
            "tracking_number": tracking_number,
            "line_items": _safe_line_items(row.line_items),
            "shipping_address": _mask_shipping_address(row.shipping_address),
            "lang": lang,
        }
        if current_step == 0:
            # Cancelled-order note — the storefront switches its UI
            # tone (rose card, "annulée" badge) on this flag rather
            # than re-deriving from status_id, which keeps the
            # mapping one-sided (server → client).
            payload["cancelled"] = True
            payload["cancellation_note"] = (
                "Cette commande a été annulée."
                if lang == "fr"
                else "This order has been cancelled."
            )
        return payload
