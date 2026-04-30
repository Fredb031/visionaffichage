import { useEffect, useRef, useState } from 'react';
import { useLang } from '@/lib/langContext';

/**
 * Cache API health badge — surfaces upstream Python FastAPI cache layer
 * status on /admin/sanmar so operators don't have to curl /health by
 * hand. Polls VITE_SANMAR_CACHE_API_URL/health every 60s, renders a
 * coloured dot + bilingual label, and hides itself entirely when the
 * env var is unset (operators not running the cache layer don't need
 * to see a permanent red dot).
 *
 * State machine:
 *   ok       → 200 + { status: "ok" }     → green  → "Cache OK"
 *   offline  → 503 OR network/abort error → red    → "Cache offline"
 *   stale    → no successful poll in 2min → amber  → "Cache stale"
 *   loading  → first paint, pre-poll      → muted  → "Cache…"
 *
 * Tooltip on hover exposes the exact endpoint URL, the timestamp of
 * the most recent response, and the `last_sync` field from the /health
 * body so the operator can see how fresh the cache is.
 */

type BadgeState = 'loading' | 'ok' | 'offline' | 'stale';

interface HealthBody {
  status?: string;
  last_sync?: string | null;
  [k: string]: unknown;
}

const POLL_INTERVAL_MS = 60_000;
const STALE_THRESHOLD_MS = 120_000;
const FETCH_TIMEOUT_MS = 3_000;

function trimTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

export function CacheHealthBadge() {
  const { lang } = useLang();
  const baseUrl = (import.meta.env.VITE_SANMAR_CACHE_API_URL as string | undefined)?.trim();

  const [state, setState] = useState<BadgeState>('loading');
  const [lastResponseAt, setLastResponseAt] = useState<Date | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const lastOkAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!baseUrl) return;
    const endpoint = `${trimTrailingSlash(baseUrl)}/health`;
    let cancelled = false;
    let staleTimer: ReturnType<typeof setInterval> | null = null;

    const poll = async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        const res = await fetch(endpoint, {
          method: 'GET',
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });
        clearTimeout(timeoutId);
        if (cancelled) return;
        const now = new Date();
        setLastResponseAt(now);
        if (res.status === 503) {
          setState('offline');
          return;
        }
        if (!res.ok) {
          setState('offline');
          return;
        }
        const body = (await res.json().catch(() => null)) as HealthBody | null;
        if (body && body.status === 'ok') {
          setState('ok');
          setLastSync(typeof body.last_sync === 'string' ? body.last_sync : null);
          lastOkAtRef.current = now.getTime();
        } else {
          setState('offline');
        }
      } catch {
        clearTimeout(timeoutId);
        if (cancelled) return;
        setState('offline');
      }
    };

    void poll();
    const pollTimer = setInterval(() => {
      void poll();
    }, POLL_INTERVAL_MS);

    // Independent stale checker — even if polls keep failing, we want
    // to surface "stale" once we've been without a healthy response
    // for >2 min.
    staleTimer = setInterval(() => {
      const lastOk = lastOkAtRef.current;
      if (lastOk == null) return;
      const ageMs = Date.now() - lastOk;
      if (ageMs > STALE_THRESHOLD_MS) {
        setState((prev) => (prev === 'ok' ? 'stale' : prev));
      }
    }, 15_000);

    return () => {
      cancelled = true;
      clearInterval(pollTimer);
      if (staleTimer) clearInterval(staleTimer);
    };
  }, [baseUrl]);

  if (!baseUrl) return null;

  const endpoint = `${trimTrailingSlash(baseUrl)}/health`;

  const labels: Record<BadgeState, { en: string; fr: string }> = {
    loading: { en: 'Cache…', fr: 'Cache…' },
    ok: { en: 'Cache OK', fr: 'Cache OK' },
    offline: { en: 'Cache offline', fr: 'Cache hors ligne' },
    stale: { en: 'Cache stale', fr: 'Cache périmé' },
  };

  const dotColor: Record<BadgeState, string> = {
    loading: 'bg-va-muted',
    ok: 'bg-green-500',
    offline: 'bg-red-500',
    stale: 'bg-amber-500',
  };

  const label = lang === 'en' ? labels[state].en : labels[state].fr;

  const tooltipLines = [
    `${lang === 'en' ? 'Endpoint' : 'Point de terminaison'}: ${endpoint}`,
    `${lang === 'en' ? 'Last poll' : 'Dernier sondage'}: ${
      lastResponseAt ? lastResponseAt.toLocaleTimeString() : '—'
    }`,
    `${lang === 'en' ? 'Cache last_sync' : 'Cache last_sync'}: ${lastSync ?? '—'}`,
  ];

  return (
    <span
      role="status"
      aria-live="polite"
      title={tooltipLines.join('\n')}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-va-bg-2 border border-va-line text-xs font-bold text-va-ink"
    >
      <span
        aria-hidden="true"
        className={`inline-block w-2 h-2 rounded-full ${dotColor[state]} ${
          state === 'loading' ? 'animate-pulse' : ''
        }`}
      />
      <span>{label}</span>
    </span>
  );
}

export default CacheHealthBadge;
