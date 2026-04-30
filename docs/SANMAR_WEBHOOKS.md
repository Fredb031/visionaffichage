# SanMar Order Webhooks (Phase 17)

> **Audience.** Customer systems integrating with Vision Affichage's
> SanMar pipeline that want push-based notifications when an order
> changes status — instead of polling the public `/track` endpoint or
> relying on SanMar's own ASN emails (which are unreliable).

The orchestrator's `reconcile_open_orders()` job runs on a schedule.
When it observes an order moving into one of the watched terminal
codes, it fires a signed HTTP `POST` to the configured customer
endpoint. This document is the wire-level contract: payload shape,
signature scheme, retry policy, and verification recipes.

---

## Subscribing

Two environment variables turn the system on:

| Var | Required | Purpose |
| --- | --- | --- |
| `SANMAR_CUSTOMER_WEBHOOK_URL` | Yes | The HTTPS endpoint that will receive webhooks. |
| `SANMAR_CUSTOMER_WEBHOOK_SECRET` | Recommended | Shared secret used to sign each request. |

If `SANMAR_CUSTOMER_WEBHOOK_URL` is unset the webhook system is fully
no-op — no HTTP traffic, no logging, zero overhead. Set both vars in
the orchestrator's `.env` and restart the worker process; no code
deploy is required.

The receiver must be reachable over HTTPS and respond within **5
seconds**. Anything slower will be treated as a transport failure and
trigger one retry (see *Retry policy* below).

---

## Event types

The orchestrator only fires webhooks for status transitions that are
meaningful to a customer system. Operator-only intermediate codes
(received, in production, on hold, etc.) never produce a webhook.

| `status_id` | `event` | Meaning |
| --- | --- | --- |
| 60 | `order.picked` | Items pulled from the warehouse, awaiting carrier pickup. |
| 75 | `order.partially_shipped` | At least one box is in transit; more to follow. |
| 80 | `order.shipped` | Order is fully shipped. Tracking numbers are populated. |
| 99 | `order.cancelled` | Order was cancelled at SanMar (rare; usually credit holds). |

---

## Payload shape

Each webhook is a `POST` with `Content-Type: application/json`. The
body is a single JSON object with stable field names — additive only.

```json
{
  "event": "order.shipped",
  "po_number": "VA-12345",
  "customer_email": "ops@acme.ca",
  "previous_status_id": 60,
  "status_id": 80,
  "status_label": "Complete / Shipped",
  "expected_ship_date": "2026-05-01T00:00:00+00:00",
  "tracking_number": "1Z999AA10123456784",
  "tracking_numbers": ["1Z999AA10123456784"],
  "timestamp": "2026-04-29T18:30:00+00:00",
  "hmac_signature": "9c8a…hex…d20f"
}
```

Field notes:

* `event` — see the table above. Use this for routing on the
  receiver, not `status_id`.
* `po_number` — the SanMar PO. Stable across the order's lifetime.
* `customer_email` — the email captured at order time. May be `null`
  for legacy orders seeded before Phase 16.
* `previous_status_id` / `status_id` — the integer codes the
  transition crossed.
* `status_label` — a human-readable description matching SanMar's
  status table (e.g. `"Complete / Shipped"`).
* `expected_ship_date` — ISO-8601 timestamp; may be `null`.
* `tracking_number` — convenience field equal to
  `tracking_numbers[0]` when there's at least one. `null` for
  cancellations or pre-ship events.
* `tracking_numbers` — full array (a multi-box order ships with one
  tracking number per box).
* `timestamp` — when the orchestrator fired the webhook (UTC).
* `hmac_signature` — mirrored from the `X-Sanmar-Signature` header
  for transports that hide custom headers (e.g. some Zapier hooks).
  See *HMAC verification* below.

The body is serialized with sorted keys so the canonical bytes are
deterministic across runs. Receivers should parse with a normal JSON
parser; do not rely on field order beyond what the JSON spec
guarantees.

---

## HMAC verification

Every request carries an `X-Sanmar-Signature` header containing the
hex-encoded `HMAC-SHA256` of the JSON body computed with the shared
secret as the key. The same value is mirrored into the body as
`hmac_signature` for transports that swallow headers.

> **Important.** The header is computed over the body **before**
> `hmac_signature` is injected. To verify, parse the body, drop the
> `hmac_signature` field, re-serialize with `sort_keys=True`, then
> HMAC the result.

### Python recipe

```python
import hashlib
import hmac
import json

def verify_sanmar_webhook(raw_body: bytes, signature_header: str, secret: str) -> bool:
    payload = json.loads(raw_body.decode("utf-8"))
    payload.pop("hmac_signature", None)
    canonical = json.dumps(payload, sort_keys=True, default=str).encode("utf-8")
    expected = hmac.new(secret.encode("utf-8"), canonical, hashlib.sha256).hexdigest()
    # Constant-time comparison to defeat timing oracles.
    return hmac.compare_digest(expected, signature_header)
```

### Node.js / JavaScript recipe

```js
const crypto = require("crypto");

function verifySanmarWebhook(rawBody, signatureHeader, secret) {
  const payload = JSON.parse(rawBody.toString("utf8"));
  delete payload.hmac_signature;

  // Match the producer's canonical form: sorted keys, no whitespace
  // padding (Python's json.dumps default), default=str for datetimes
  // (which the producer has already pre-stringified).
  const canonical = stringifySorted(payload);
  const expected = crypto
    .createHmac("sha256", secret)
    .update(canonical)
    .digest("hex");

  // Constant-time compare.
  return crypto.timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(signatureHeader, "hex"),
  );
}

function stringifySorted(value) {
  if (Array.isArray(value)) {
    return "[" + value.map(stringifySorted).join(", ") + "]";
  }
  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return (
      "{" +
      keys.map((k) => JSON.stringify(k) + ": " + stringifySorted(value[k])).join(", ") +
      "}"
    );
  }
  return JSON.stringify(value);
}
```

> Python's `json.dumps(..., sort_keys=True)` defaults to `", "` and
> `": "` separators. The Node example above mirrors that. If you
> swap separators you'll get a signature mismatch — the canonical
> form must match byte-for-byte.

A simpler alternative: trust the mirrored `hmac_signature` field
directly when the entire request body is treated as the canonical
input. The producer mirrors the same header value in, so these two
checks are equivalent in practice.

---

## Retry policy

The orchestrator side runs **at most one retry**:

1. POST the body. Wait up to 5 seconds for a response.
2. If the response is **2xx** → success, no retry.
3. If the response is **4xx** → terminal failure, no retry. (The
   receiver is saying "your payload is malformed"; retrying won't
   help — fix the integration.)
4. If the response is **5xx**, or a network error / timeout occurs
   → wait 3 seconds, then send the request once more.
5. If the second attempt also fails → log a warning and move on.
   Reconcile is **never** blocked by a customer endpoint outage.

Receivers should be idempotent: design your handler so receiving the
same `(po_number, status_id)` twice is harmless. Use the
`(po_number, status_id)` pair as a dedup key.

---

## Operator setup checklist

1. Stand up an HTTPS endpoint that accepts `POST application/json`.
2. Generate a long random secret (`openssl rand -hex 32`).
3. Set both env vars on the orchestrator host:
   ```bash
   export SANMAR_CUSTOMER_WEBHOOK_URL=https://crm.vision.example/webhooks/sanmar
   export SANMAR_CUSTOMER_WEBHOOK_SECRET=<the-hex-secret>
   ```
4. Restart the worker / cron process so the new settings take effect.
5. Run the smoke CLI to confirm end-to-end delivery:
   ```bash
   python -m scripts.test_webhook_sender
   ```
   Exit code 0 = receiver returned 2xx. Verify the payload + HMAC on
   the receiver side.
6. (Optional) Wire the receiver into your CRM, Zapier zap, or
   notification pipeline. Use the `event` field for routing.

---

## Failure modes & observability

| Symptom | Cause | Fix |
| --- | --- | --- |
| Webhooks never arrive | `SANMAR_CUSTOMER_WEBHOOK_URL` unset | Set the env var, restart. |
| HMAC mismatch on receiver | Secret drift, or canonicalization mismatch | Verify the recipe above; recompute on the producer side using `python -m scripts.test_webhook_sender`. |
| Duplicate events | Reconcile re-ran while receiver was down | Receiver must dedup on `(po_number, status_id)`. |
| Receiver 4xx in logs | Payload version skew | Update receiver to ignore unknown fields (forward-compat). |

The orchestrator emits structured `warning` log lines on every
non-2xx response, and a `warning` on `RequestException`. The
webhook URL is **never** logged — only the failure reason and HTTP
status — so log shipping is safe.

---

## Delivery log (Phase 18)

Every call to `OrderWebhookClient.fire()` that runs against a configured
URL writes one row into the `webhook_deliveries` table — success,
exhausted retries, 4xx, and connection errors all get exactly one row
each. Two attempts that chain through the 5xx-retry path collapse to a
single row with `attempt_count=2`, so each row is one logical
delivery.

### Schema

| Column            | Type             | Notes |
| ----------------- | ---------------- | ----- |
| `id`              | INTEGER PK       | Surrogate key. |
| `po_number`       | VARCHAR(64)      | Indexed for filter-by-PO queries. |
| `event`           | VARCHAR(64)      | `order.picked`, `order.shipped`, etc. |
| `payload_json`    | TEXT             | Full body the producer sent (post-mirror, includes `hmac_signature`). |
| `signature_hex`   | VARCHAR(128)     | The exact hex sent in `X-Sanmar-Signature`. |
| `attempt_count`   | INTEGER          | 1 for first-shot success, 2 if a retry was performed. |
| `status_code`     | INTEGER NULL     | HTTP status of the *last* attempt; NULL on connection error. |
| `response_body`   | TEXT NULL        | Receiver's body, capped at 4 KB (truncation marker appended). |
| `response_ms`     | INTEGER NULL     | Wall-clock duration of the entire fire (incl. retry sleep). |
| `error`           | TEXT NULL        | Exception type name on connection error (URL is never embedded). |
| `outcome`         | VARCHAR(32)      | `success` \| `failed` \| `retry` \| `skipped`. |
| `event_id`        | VARCHAR(64) NULL | UUID minted at fire time; mirrored into the payload for receiver dedupe. |
| `signed_at`       | TIMESTAMPTZ      | Indexed for time-range queries. |

The optional config flag `SANMAR_LOG_SKIPPED_WEBHOOKS=true` enables
auditing of the URL-unset no-op path: every transition that *would*
have fired a webhook is persisted with `outcome='skipped'` and
`status_code=NULL`. Off by default to avoid bloat.

### Retention recipe

A 30-day retention window keeps the table small while preserving
enough history to diagnose customer disputes. Run weekly via cron
or a systemd timer:

```sql
DELETE FROM webhook_deliveries
WHERE signed_at < datetime('now', '-30 days');
VACUUM;
```

If your operator dashboards need longer retention, ship the rows
to a long-term store (e.g. archive to S3 / a warehouse) before the
DELETE — but treat the local table as a 30-day rolling window.

### Operator dashboard

The Streamlit Ops dashboard (`streamlit/ops.py`) renders a "Webhook
deliveries (last 50)" panel with outcome + event filters,
expandable rows showing the full payload + response + signature,
and a per-row Replay button that calls the same code path as the
CLI replay tool. Use the "Live (30s)" toggle to keep the panel
auto-refreshing.

---

## Replay flow (Phase 18)

When a customer endpoint was down or a receiver-side bug ate a
webhook, the operator can replay any persisted delivery against the
currently configured URL:

```bash
# Replay one delivery by primary key
python -m sanmar replay-webhook --delivery-id 42

# Replay the latest delivery for a (po, event) pair
python -m sanmar replay-webhook --po VA-12345 --event order.shipped

# Print what would be sent without firing
python -m sanmar replay-webhook --delivery-id 42 --dry-run
```

Or via the underlying script directly:

```bash
python -m scripts.replay_webhook --delivery-id 42
```

### When to use replay

* The receiver was down during the original fire and didn't process.
* You're debugging a signature-verification mismatch on the receiver
  side and need to deliver the same logical event again.
* A staging-environment receiver missed a state transition and you
  want to back-fill it without re-processing the upstream order.

### Safety notes

Replay creates a **new** `WebhookDelivery` row with a fresh
`signed_at` and a fresh HTTP attempt — it does **not** alter the
original row, which remains immutable for audit purposes.

> **Receivers must dedupe on `event_id`.** Phase 18 introduces an
> additive `event_id` field (UUID v4) that is part of every payload
> *and* part of the HMAC scope. The original delivery and any
> replays carry **the same `event_id`** if the receiver wants
> at-most-once semantics. (When you replay a row, the persisted
> payload is re-sent verbatim, so the same `event_id` flows through.)
>
> This is a backwards-compatible additive change: receivers that
> ignore the field still verify HMAC successfully because the
> signature is computed over the canonical body bytes that include
> `event_id`. If you want stricter dedupe, key on
> `(po_number, event, event_id)` — that combination is stable
> across the original fire and any number of replays.

For a complete dry-run before hitting the network, use `--dry-run`:
the CLI prints the original metadata + pretty-printed payload,
fires no HTTP, and writes no row.
