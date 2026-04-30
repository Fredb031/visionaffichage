/**
 * Bilingual SanMar API error categorizer.
 *
 * The /admin/sanmar console surfaces errors from a handful of distinct
 * sources: SanMar PromoStandards SOAP gateway (auth, rate-limit, 5xx),
 * Supabase RPCs (PGRST*, RLS denials), pg_cron health (function missing),
 * and plain network failures (timeout, ECONNRESET). Operators don't need
 * the raw stack — they need one line that says "what went wrong" and one
 * line that says "what to do next". `categorizeError` maps the most
 * common failure modes to that pair plus a severity used for color coding.
 *
 * The raw message is always preserved by the caller under a <details>
 * disclosure so triage / log-grepping isn't lost.
 *
 * Severity → tile color in the UI:
 *   - 'error'   → red (auth, hard 4xx other than 404)
 *   - 'warning' → amber (5xx, timeout — transient, retry-able)
 *   - 'info'    → slate (404 / not found — caller likely typed wrong PO)
 */

export type SanmarErrorSeverity = 'info' | 'warning' | 'error';

export interface SanmarErrorContext {
  /** PostgREST / Supabase error code (e.g. 'PGRST202', '42501'). */
  code?: string;
  /** HTTP status code from the SanMar gateway or fetch wrapper. */
  status?: number;
  /** Raw error message — checked case-insensitively for keywords. */
  message: string;
}

export interface CategorizedError {
  title: string;
  action: string;
  severity: SanmarErrorSeverity;
}

/**
 * Map a raw error to a bilingual operator-friendly summary.
 *
 * The matcher walks specific → generic so 401 wins over a coincidental
 * "auth" substring elsewhere in the message. Every branch returns both
 * a title (what) and an action (so what / next step). Unknown errors
 * fall through to a "Réessayer / Try again" generic so the panel never
 * renders an empty action.
 */
export function categorizeError(
  err: SanmarErrorContext,
  lang: 'fr' | 'en',
): CategorizedError {
  const msg = (err.message ?? '').toLowerCase();
  const status = err.status;
  const code = err.code ?? '';

  // ── 401 / 403 — credential or RLS failure ──────────────────────────
  // SanMar SOAP returns 401 for bad customer creds; Supabase surfaces
  // RLS denials as 42501 / "permission denied". Same operator action:
  // check the secrets / role.
  if (
    status === 401 ||
    status === 403 ||
    code === '42501' ||
    msg.includes('unauthorized') ||
    msg.includes('permission denied') ||
    msg.includes('invalid credentials') ||
    msg.includes('authentication')
  ) {
    return {
      title:
        lang === 'en'
          ? 'Invalid credentials or permission denied'
          : 'Identifiants invalides ou permission refusée',
      action:
        lang === 'en'
          ? 'Verify SANMAR_* secrets in Supabase and confirm this account has the sanmar:read role.'
          : 'Vérifier les secrets SANMAR_* dans Supabase et confirmer que ce compte a le rôle sanmar:read.',
      severity: 'error',
    };
  }

  // ── 404 / not found — wrong identifier, not a system failure ───────
  if (
    status === 404 ||
    msg.includes('not found') ||
    msg.includes('order not found') ||
    msg.includes('no such')
  ) {
    return {
      title:
        lang === 'en' ? 'Resource not found' : 'Ressource introuvable',
      action:
        lang === 'en'
          ? 'Verify the PO number or resource identifier and retry.'
          : 'Vérifier le numéro de PO ou l’identifiant et réessayer.',
      severity: 'info',
    };
  }

  // ── 503 / 5xx — SanMar gateway down or transient ───────────────────
  if (
    (typeof status === 'number' && status >= 500 && status < 600) ||
    msg.includes('service unavailable') ||
    msg.includes('bad gateway') ||
    msg.includes('gateway timeout') ||
    msg.includes('internal server error')
  ) {
    return {
      title:
        lang === 'en'
          ? 'SanMar service unavailable'
          : 'Service SanMar indisponible',
      action:
        lang === 'en'
          ? 'Retry in 5 minutes. If it persists, escalate to ops — SanMar PromoStandards is likely degraded.'
          : 'Réessayer dans 5 min. Si persiste, escalader à ops — SanMar PromoStandards est probablement dégradé.',
      severity: 'warning',
    };
  }

  // ── Timeout / network — usually transient ──────────────────────────
  if (
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('aborted') ||
    msg.includes('econnreset') ||
    msg.includes('econnrefused') ||
    msg.includes('network') ||
    msg.includes('failed to fetch') ||
    msg.includes('fetch failed')
  ) {
    return {
      title:
        lang === 'en' ? 'Request timed out' : 'Délai dépassé',
      action:
        lang === 'en'
          ? 'Check network connectivity and retry. If multiple panels fail, the SanMar gateway may be slow.'
          : 'Vérifier la connectivité réseau et réessayer. Si plusieurs panneaux échouent, le passerelle SanMar est peut-être lente.',
      severity: 'warning',
    };
  }

  // ── PostgREST function missing — early-deploy environments ─────────
  if (
    code === 'PGRST202' ||
    msg.includes('could not find the function') ||
    msg.includes('function does not exist')
  ) {
    return {
      title:
        lang === 'en'
          ? 'Database function not deployed'
          : 'Fonction de base de données non déployée',
      action:
        lang === 'en'
          ? 'Apply pending migrations under supabase/migrations/*sanmar* — the RPC this widget needs has not been created yet.'
          : 'Appliquer les migrations en attente dans supabase/migrations/*sanmar* — la RPC dont ce widget a besoin n’a pas encore été créée.',
      severity: 'warning',
    };
  }

  // ── 429 — rate limit ───────────────────────────────────────────────
  if (status === 429 || msg.includes('rate limit') || msg.includes('too many')) {
    return {
      title:
        lang === 'en' ? 'Rate limit reached' : 'Limite de requêtes atteinte',
      action:
        lang === 'en'
          ? 'Wait a minute before retrying. SanMar enforces a per-customer daily quota.'
          : 'Attendre une minute avant de réessayer. SanMar impose un quota quotidien par client.',
      severity: 'warning',
    };
  }

  // ── Generic fallback ───────────────────────────────────────────────
  return {
    title:
      lang === 'en' ? 'Unexpected error' : 'Erreur inattendue',
    action:
      lang === 'en'
        ? 'Try again. If it persists, copy the technical details below and escalate.'
        : 'Réessayer. Si persiste, copier les détails techniques ci-dessous et escalader.',
    severity: 'error',
  };
}

/**
 * Tailwind classes for each severity tier.
 *
 * Kept in this module (not inlined at the call site) so the panel
 * appearance stays consistent across the six error states on the page.
 * `border-l-4` provides the colour stripe; the surface stays light so
 * the panel reads as informational, not alarming.
 */
export function severityClasses(severity: SanmarErrorSeverity): {
  panel: string;
  iconColor: string;
  titleColor: string;
} {
  switch (severity) {
    case 'error':
      return {
        panel: 'bg-red-50 border-red-200 border-l-4 border-l-red-500',
        iconColor: 'text-red-600',
        titleColor: 'text-red-900',
      };
    case 'warning':
      return {
        panel: 'bg-amber-50 border-amber-200 border-l-4 border-l-amber-500',
        iconColor: 'text-amber-700',
        titleColor: 'text-amber-900',
      };
    case 'info':
    default:
      return {
        panel: 'bg-slate-100 border-slate-300 border-l-4 border-l-slate-500',
        iconColor: 'text-slate-600',
        titleColor: 'text-slate-900',
      };
  }
}
