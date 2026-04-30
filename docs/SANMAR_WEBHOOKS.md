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
