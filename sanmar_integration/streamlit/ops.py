"""Minimal Streamlit operator dashboard for the SanMar integration.

Run it with::

    streamlit run streamlit/ops.py

Streamlit is an *optional* dependency — the rest of the package
doesn't import this module, so callers can safely deploy without
installing it. ``pip install -e ".[ops]"`` adds it.

Sections
--------
1. **Recent syncs** — last 10 SyncState rows in a dataframe.
2. **Operational counters** — open orders + AR balance, both read
   from the SQLite cache (no SOAP call here — refresh-on-click only).
3. **Manual triggers** — buttons for catalog delta sync, inventory
   sync, order reconciliation. Each kicks the orchestrator on click
   with a progress spinner.
4. **Webhook deliveries** (Phase 18) — last 50 WebhookDelivery rows
   with outcome + event filters, expandable rows showing payload +
   response + signature, and a per-row Replay button.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

# Streamlit imports are gated so a plain `python streamlit/ops.py`
# from the CLI still produces a clear "install streamlit" error rather
# than a bare ImportError.
try:
    import streamlit as st
except ImportError as exc:  # pragma: no cover - import guard
    raise SystemExit(
        "streamlit is not installed. Run: pip install streamlit "
        "(or pip install -e \".[ops]\" from the project root)."
    ) from exc

import pandas as pd
from sqlalchemy import desc, select

from sanmar.config import get_settings
from sanmar.db import init_schema, make_engine, session_scope
from sanmar.models import OrderRow, SyncState, WebhookDelivery
from sanmar.orchestrator import SanmarOrchestrator


def _fmt_dt(dt) -> str:
    if dt is None:
        return "—"
    if isinstance(dt, datetime):
        return dt.strftime("%Y-%m-%d %H:%M")
    return str(dt)


def _relative_time(dt) -> str:
    """Human-friendly relative timestamp (e.g. '5 min ago')."""
    if not isinstance(dt, datetime):
        return "—"
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    delta = datetime.now(tz=timezone.utc) - dt
    total = int(delta.total_seconds())
    if total < 0:
        return "just now"
    if total < 60:
        return f"{total}s ago"
    if total < 3600:
        return f"{total // 60} min ago"
    if total < 86400:
        return f"{total // 3600}h ago"
    return f"{total // 86400}d ago"


_OUTCOME_BADGE: dict[str, str] = {
    "success": "🟢 success",
    "failed": "🔴 failed",
    "retry": "🟡 retry",
    "skipped": "⚪ skipped",
}


def main() -> None:  # pragma: no cover - UI entry
    st.set_page_config(
        page_title="SanMar Ops", page_icon="📦", layout="wide"
    )
    st.title("SanMar Ops Dashboard")

    with st.sidebar:
        st.markdown("## Links")
        st.markdown(
            "[GitHub repo](https://github.com/Fredb031/visionaffichage)"
        )
        st.caption("Phase 6 — operator surfaces.")

    settings = get_settings()
    engine = make_engine(settings.db_path)
    init_schema(engine)

    # ── Section 1: recent syncs ───────────────────────────────────
    st.subheader("Recent syncs")
    with session_scope(engine) as session:
        rows = (
            session.execute(
                select(SyncState)
                .order_by(desc(SyncState.started_at))
                .limit(10)
            )
            .scalars()
            .all()
        )
        sync_df = pd.DataFrame(
            [
                {
                    "id": r.id,
                    "type": r.sync_type,
                    "started": _fmt_dt(r.started_at),
                    "finished": _fmt_dt(r.finished_at),
                    "success": r.success_count,
                    "errors": r.error_count,
                    "processed": r.total_processed,
                    "marker": r.last_processed_marker or "",
                }
                for r in rows
            ]
        )
    if sync_df.empty:
        st.info("No sync runs yet — kick one off below.")
    else:
        st.dataframe(sync_df, use_container_width=True, hide_index=True)

    # ── Section 2: operational counters ───────────────────────────
    st.subheader("Operational counters")
    col_a, col_b, col_c = st.columns(3)
    with session_scope(engine) as session:
        open_orders = (
            session.query(OrderRow).filter(OrderRow.is_open).count()
        )
        # AR balance is sourced from local OrderRow totals on
        # *non-shipped* orders — keep this read-only / SOAP-free; a
        # separate "refresh AR" button could trigger an SOAP pull.
        ar_balance_q = (
            session.query(OrderRow)
            .filter(OrderRow.shipped_at.is_(None))
            .all()
        )
        ar_balance = sum(
            float(o.total_amount_cad or 0) for o in ar_balance_q
        )
        last_sync = (
            session.execute(
                select(SyncState)
                .order_by(desc(SyncState.started_at))
                .limit(1)
            )
            .scalar_one_or_none()
        )

    col_a.metric("Open orders", open_orders)
    col_b.metric("AR balance (CAD)", f"${ar_balance:,.2f}")
    col_c.metric(
        "Last sync",
        _fmt_dt(last_sync.started_at) if last_sync else "never",
    )

    if st.button("Refresh counters"):
        st.rerun()

    # ── Section 3: manual triggers ────────────────────────────────
    st.subheader("Manual sync triggers")
    orch = SanmarOrchestrator(settings)

    btn_a, btn_b, btn_c = st.columns(3)

    if btn_a.button("Run catalog delta sync"):
        since = datetime.now(tz=timezone.utc) - timedelta(days=1)
        with st.spinner("Pulling delta…"):
            with session_scope(engine) as session:
                result = orch.sync_catalog_delta(since, session=session)
        st.success(
            f"Catalog delta done — success {result.success_count}, "
            f"errors {result.error_count}, products {result.products_seen}"
        )

    if btn_b.button("Run inventory sync"):
        with st.spinner("Refreshing inventory…"):
            with session_scope(engine) as session:
                result = orch.sync_inventory_for_active_skus(session)
        st.success(
            f"Inventory done — snapshots {result.snapshots_written}, "
            f"errors {result.error_count}"
        )

    if btn_c.button("Reconcile open orders"):
        with st.spinner("Reconciling…"):
            with session_scope(engine) as session:
                result = orch.reconcile_open_orders(session)
        st.success(
            f"Reconcile done — transitions {result.transitions}, "
            f"errors {result.error_count}"
        )

    # ── Section 4: webhook deliveries (Phase 18) ──────────────────
    _render_webhook_panel(engine)


def _render_webhook_panel(engine) -> None:  # pragma: no cover - UI glue
    """Render the Phase-18 webhook deliveries panel.

    Pulled into a helper so the main() function stays scannable. The
    panel:

    * Lists the most recent 50 ``WebhookDelivery`` rows.
    * Filters by outcome (all / success / failed / retry / skipped)
      and event type.
    * Each row is expandable, showing pretty-printed payload +
      response body + signature.
    * "Replay" button on each row invokes the same code path as the
      ``replay-webhook`` CLI.
    * "Live" toggle re-runs the panel every 30 seconds via st.rerun().
    """
    st.subheader("Webhook deliveries")

    fcol1, fcol2, fcol3 = st.columns([1, 1, 1])
    outcome_filter = fcol1.selectbox(
        "Outcome",
        options=["all", "success", "failed", "retry", "skipped"],
        index=0,
        key="webhook_outcome_filter",
    )
    # Event filter pulled dynamically from existing rows so we don't
    # bake a stale list into the UI.
    with session_scope(engine) as session:
        events_present = sorted(
            {
                r[0]
                for r in session.query(WebhookDelivery.event).distinct().all()
                if r[0]
            }
        )
    event_filter = fcol2.selectbox(
        "Event",
        options=["all", *events_present],
        index=0,
        key="webhook_event_filter",
    )
    live = fcol3.toggle("Live (30s)", value=False, key="webhook_live_toggle")

    with session_scope(engine) as session:
        q = session.query(WebhookDelivery)
        if outcome_filter != "all":
            q = q.filter(WebhookDelivery.outcome == outcome_filter)
        if event_filter != "all":
            q = q.filter(WebhookDelivery.event == event_filter)
        rows = (
            q.order_by(WebhookDelivery.signed_at.desc()).limit(50).all()
        )

        # Eagerly snapshot fields — the session closes when this block
        # exits and Streamlit may re-render before we'd use the rows.
        snapshots = [
            {
                "id": r.id,
                "po_number": r.po_number,
                "event": r.event,
                "status_code": r.status_code,
                "response_ms": r.response_ms,
                "outcome": r.outcome,
                "attempts": r.attempt_count,
                "signed_at": r.signed_at,
                "payload_json": r.payload_json,
                "response_body": r.response_body or "",
                "signature_hex": r.signature_hex or "",
                "error": r.error or "",
                "event_id": r.event_id or "",
            }
            for r in rows
        ]

    if not snapshots:
        st.info("No webhook deliveries yet.")
    else:
        table_df = pd.DataFrame(
            [
                {
                    "id": s["id"],
                    "when": _relative_time(s["signed_at"]),
                    "po_number": s["po_number"],
                    "event": s["event"],
                    "status": s["status_code"] or "—",
                    "ms": s["response_ms"] if s["response_ms"] is not None else "—",
                    "outcome": _OUTCOME_BADGE.get(s["outcome"], s["outcome"]),
                    "attempts": s["attempts"],
                }
                for s in snapshots
            ]
        )
        st.dataframe(table_df, use_container_width=True, hide_index=True)

        for s in snapshots:
            label = (
                f"#{s['id']} · {s['event']} · {s['po_number']} · "
                f"{_OUTCOME_BADGE.get(s['outcome'], s['outcome'])}"
            )
            with st.expander(label):
                import json as _json

                try:
                    payload_pretty = _json.dumps(
                        _json.loads(s["payload_json"]),
                        indent=2,
                        sort_keys=True,
                    )
                except Exception:
                    payload_pretty = s["payload_json"]
                st.markdown("**payload**")
                st.code(payload_pretty, language="json")
                st.markdown("**response body**")
                st.code(s["response_body"] or "—", language="text")
                st.markdown(
                    f"**signature** `{s['signature_hex'] or '—'}`"
                )
                if s["error"]:
                    st.markdown(f"**error** `{s['error']}`")
                if s["event_id"]:
                    st.caption(f"event_id: `{s['event_id']}`")
                if st.button(
                    f"Replay #{s['id']}",
                    key=f"replay_btn_{s['id']}",
                ):
                    from scripts.replay_webhook import replay as _replay

                    code = _replay(
                        delivery_id=s["id"],
                        po=None,
                        event=None,
                        dry_run=False,
                    )
                    if code == 0:
                        st.success(f"Replay of #{s['id']} succeeded.")
                    else:
                        st.error(
                            f"Replay of #{s['id']} returned exit code {code}."
                        )

    if live:
        # Auto-refresh after 30 seconds.
        import time as _time

        _time.sleep(30)
        st.rerun()


if __name__ == "__main__":  # pragma: no cover
    main()
