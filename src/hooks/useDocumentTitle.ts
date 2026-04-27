import { useEffect } from 'react';

/**
 * Open Graph / Twitter overrides for a page. All fields are optional —
 * the hook derives sensible defaults (og:image → /og-default.png,
 * og:type → website, og:url → window.location.href, twitter:card →
 * summary_large_image) so callers only supply the bits they know.
 */
export interface OgOverrides {
  ogImage?: string;
  ogType?: string;
}

// Meta tags the hook manages. Kept as a const tuple so the save/restore
// bookkeeping below can iterate once without repeating the selector list.
// `property` tags (Open Graph spec) and `name` tags (Twitter card spec)
// live in the same <head> but are matched by different attributes, so we
// carry the attribute kind alongside the key.
type ManagedTag = { attr: 'property' | 'name'; key: string };

const DEFAULT_OG_IMAGE = '/og-default.png';

// Browser tabs typically show ~60 characters before an ellipsis; search
// engines truncate SERP titles around 60–65. We clamp slightly above
// that so formatting breathing-room (" — Vision Affichage") isn't cut
// off mid-word while still keeping tabs readable. The ellipsis character
// is a single codepoint so the visible length stays at TITLE_MAX_LEN.
const TITLE_MAX_LEN = 70;

// Defensive HTML tag stripper. Template strings occasionally interpolate
// raw product copy that may contain stray <br/> or <strong> fragments;
// document.title renders these literally ("&lt;strong&gt;...") and OG
// crawlers treat them as raw text too. Matching a naive tag pattern is
// enough here — we never intend to render rich markup in a title.
const stripHtml = (s: string): string => s.replace(/<[^>]*>/g, '');

// Normalize a caller-provided title: strip tags, collapse whitespace,
// and trim. Returns an empty string for nullish / whitespace-only input
// so downstream code can cheaply detect "don't touch document.title".
const sanitizeTitle = (raw: string | undefined | null): string => {
  if (raw == null) return '';
  const stripped = stripHtml(raw).replace(/\s+/g, ' ').trim();
  return stripped;
};

// Clamp to TITLE_MAX_LEN with a trailing ellipsis. Callers that already
// fit are returned unchanged (identity-preserving for the common case).
const clampTitle = (s: string): string =>
  s.length <= TITLE_MAX_LEN ? s : `${s.slice(0, TITLE_MAX_LEN - 1).trimEnd()}…`;

/**
 * Set document.title for the life of the mounted component, restoring
 * the previous title on unmount. Used across pages so SPA navigation
 * doesn't leak stale titles between routes.
 *
 * The optional `description` argument also writes into the
 * `<meta name="description">` tag (Task 8.12 — per-page SEO snippets).
 * Previously every route inherited the generic index.html default, so
 * Google SERP snippets were identical across /, /products, /contact,
 * /about and every /product/:handle. Passing page-specific copy here
 * lets the crawler show the right snippet per URL while still having a
 * fallback on routes that don't opt in — the original meta tag content
 * is captured on mount and restored on unmount so SPA nav doesn't leak
 * stale descriptions. If the tag is absent entirely (non-browser SSR,
 * tests), the helper no-ops instead of throwing.
 *
 * The optional `ogOverrides` argument manages Open Graph + Twitter card
 * tags so sharing a page URL on Facebook / Slack / Twitter / LinkedIn
 * renders a page-specific preview card instead of the generic default
 * from index.html (Task 8.5). The hook manages:
 *   - og:title           ← title
 *   - og:description     ← description (if provided)
 *   - og:image           ← ogOverrides.ogImage or /og-default.png
 *   - og:type            ← ogOverrides.ogType or 'website'
 *   - og:url             ← window.location.href
 *   - twitter:card       ← 'summary_large_image'
 *   - twitter:title      ← title
 *   - twitter:description← description (if provided)
 *   - twitter:image      ← same fallback chain as og:image
 * Existing tags (found by attribute selector) have their value captured
 * on mount and restored on unmount; missing tags are created on mount
 * and removed on unmount. That way a page opting into og:type=product
 * doesn't leak 'product' onto the next page the user navigates to.
 *
 * Titles are sanitized defensively: HTML fragments are stripped (so a
 * stray `<strong>` in an interpolated template doesn't leak into the
 * tab), internal whitespace is collapsed, and the result is truncated
 * to 70 characters with an ellipsis to match typical browser/SERP
 * display limits. An empty / whitespace-only / nullish title is
 * treated as "no change" — document.title (and the OG/Twitter title
 * tags) are left as-is rather than clearing the tab label.
 *
 * @param title        Page title. Empty / whitespace is a no-op for the
 *                     title itself; description and OG/Twitter plumbing
 *                     still run so per-page SEO snippets keep working.
 * @param description  Optional per-page meta description. When provided,
 *                     the `<meta name="description">` tag and the
 *                     og:description / twitter:description tags are
 *                     updated on mount and restored on unmount.
 * @param ogOverrides  Optional Open Graph / Twitter card overrides —
 *                     `ogImage` defaults to `/og-default.png` and
 *                     `ogType` defaults to `'website'` when omitted.
 */
export function useDocumentTitle(
  title: string,
  description?: string,
  ogOverrides?: OgOverrides,
): void {
  // Serialize the OG overrides for the effect-deps array. Objects compare
  // by reference, so without this each render (even with the same values)
  // would tear down and re-create every tag — a needless DOM thrash on
  // every parent re-render.
  const ogImageKey = ogOverrides?.ogImage;
  const ogTypeKey = ogOverrides?.ogType;

  useEffect(() => {
    if (typeof document === 'undefined') return;

    // Sanitize + clamp once; reuse the safe value everywhere the title
    // flows (document.title, og:title, twitter:title) so the three
    // surfaces can't drift. An empty result means "leave document.title
    // alone" — useful on routes that compute the title async and would
    // otherwise flash a blank tab label while data loads.
    const safeTitle = clampTitle(sanitizeTitle(title));

    // Mirror the title sanitization for description so a stray <strong>
    // or <br/> in interpolated copy doesn't reach <meta name="description">
    // / og:description / twitter:description (crawlers render those
    // literally too). We only treat `undefined` as "don't manage the
    // tag" — an explicit empty string from a caller still flows through
    // (sanitized to '') to clear the tag on this route.
    const safeDescription =
      description === undefined ? undefined : sanitizeTitle(description);

    const prevTitle = document.title;
    if (safeTitle.length > 0) {
      document.title = safeTitle;
    }

    // Canonical URL bookkeeping (Task 8.9) — search engines treat
    // ?sort=price / ?q=foo / ?view=grid as distinct URLs unless we point
    // every variant at a single canonical. We strip the query string so
    // the canonical reflects the logical page, not the current filter.
    // Pre-existing <link rel="canonical"> (e.g. a global one in
    // index.html) has its href captured and restored on unmount; a tag
    // we create is removed on unmount so SPA nav doesn't leak.
    let canonicalEl: HTMLLinkElement | null = null;
    let prevCanonicalHref: string | null = null;
    let canonicalCreated = false;
    if (typeof window !== 'undefined') {
      canonicalEl = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (!canonicalEl) {
        canonicalEl = document.createElement('link');
        canonicalEl.setAttribute('rel', 'canonical');
        document.head.appendChild(canonicalEl);
        canonicalCreated = true;
      } else {
        prevCanonicalHref = canonicalEl.getAttribute('href');
      }
      canonicalEl.setAttribute('href', window.location.origin + window.location.pathname);
    }

    // hreflang alternates (Task 8.10) — signals to Google that each URL
    // serves both French and English content. The SPA doesn't split
    // content into /fr/ and /en/ paths; the UI picks the language via
    // useLang + <html lang>, so all three alternates point at the same
    // canonical URL. x-default is the fallback for locales we don't
    // explicitly target. Pre-existing tags (e.g. a global one in
    // index.html) have their href captured and restored on unmount; any
    // tag we create is removed on unmount so SPA nav doesn't leak.
    const hreflangs: Array<'fr-CA' | 'en-CA' | 'x-default'> = ['fr-CA', 'en-CA', 'x-default'];
    const hreflangRestore: Array<{
      el: HTMLLinkElement;
      prev: string | null;
      created: boolean;
    }> = [];
    if (typeof window !== 'undefined') {
      const altHref = window.location.origin + window.location.pathname;
      for (const lang of hreflangs) {
        const selector = `link[rel="alternate"][hreflang="${lang}"]`;
        let el = document.head.querySelector<HTMLLinkElement>(selector);
        let created = false;
        if (!el) {
          el = document.createElement('link');
          el.setAttribute('rel', 'alternate');
          el.setAttribute('hreflang', lang);
          document.head.appendChild(el);
          created = true;
        }
        const prev = created ? null : el.getAttribute('href');
        el.setAttribute('href', altHref);
        hreflangRestore.push({ el, prev, created });
      }
    }

    let metaEl: HTMLMetaElement | null = null;
    let prevDescription: string | null = null;
    let metaDescriptionCreated = false;
    if (description !== undefined) {
      metaEl = document.querySelector<HTMLMetaElement>('meta[name="description"]');
      if (!metaEl) {
        // Mirror the OG/Twitter handling below: if the page lacks a
        // meta-description tag entirely (some templates omit it), create
        // one so the per-page description still ships to crawlers. Tag
        // is removed on unmount so SPA nav doesn't leak.
        metaEl = document.createElement('meta');
        metaEl.setAttribute('name', 'description');
        document.head.appendChild(metaEl);
        metaDescriptionCreated = true;
      } else {
        prevDescription = metaEl.getAttribute('content');
      }
      metaEl.setAttribute('content', safeDescription as string);
    }

    // OG + Twitter bookkeeping — for each managed tag, record whether it
    // pre-existed (so we know whether to restore or remove on unmount)
    // and its previous content. `null` content in the restore map means
    // "remove on unmount"; a string means "restore to this value".
    const managed: ManagedTag[] = [
      { attr: 'property', key: 'og:url' },
      { attr: 'property', key: 'og:type' },
      { attr: 'property', key: 'og:image' },
      { attr: 'name', key: 'twitter:card' },
      { attr: 'name', key: 'twitter:image' },
    ];
    // og:title / twitter:title are only pushed when we have a non-empty
    // sanitized title — mirrors the document.title no-op above so a
    // blank input doesn't blank out the social preview either.
    if (safeTitle.length > 0) {
      managed.unshift({ attr: 'property', key: 'og:title' });
      managed.push({ attr: 'name', key: 'twitter:title' });
    }
    if (description !== undefined) {
      managed.push({ attr: 'property', key: 'og:description' });
      managed.push({ attr: 'name', key: 'twitter:description' });
    }

    const restore: Array<{ el: HTMLMetaElement; prev: string | null; created: boolean }> = [];

    const setManaged = (attr: 'property' | 'name', key: string, value: string) => {
      const selector = `meta[${attr}="${key}"]`;
      let el = document.head.querySelector<HTMLMetaElement>(selector);
      let created = false;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
        created = true;
      }
      const prev = created ? null : el.getAttribute('content');
      el.setAttribute('content', value);
      restore.push({ el, prev, created });
    };

    // OG/Twitter image specs require absolute URLs — Facebook, Slack,
    // Twitter, LinkedIn crawlers all reject or silently drop relative
    // paths like `/og-default.png`. Resolve any non-absolute value
    // (default or caller-provided) against the current origin so the
    // preview card renders the right image regardless of how callers
    // pass it. Anything already absolute (http://, https://, //, data:)
    // is left untouched.
    const rawOgImage = ogImageKey ?? DEFAULT_OG_IMAGE;
    const ogImage =
      typeof window !== 'undefined' && /^\//.test(rawOgImage) && !rawOgImage.startsWith('//')
        ? window.location.origin + rawOgImage
        : rawOgImage;
    const ogType = ogTypeKey ?? 'website';
    const ogUrl = typeof window !== 'undefined' ? window.location.href : '';

    for (const tag of managed) {
      let value: string;
      switch (tag.key) {
        case 'og:title':
        case 'twitter:title':
          value = safeTitle;
          break;
        case 'og:description':
        case 'twitter:description':
          // Only pushed into `managed` when description !== undefined.
          value = safeDescription as string;
          break;
        case 'og:image':
        case 'twitter:image':
          value = ogImage;
          break;
        case 'og:type':
          value = ogType;
          break;
        case 'og:url':
          value = ogUrl;
          break;
        case 'twitter:card':
          value = 'summary_large_image';
          break;
        default:
          continue;
      }
      setManaged(tag.attr, tag.key, value);
    }

    return () => {
      document.title = prevTitle;
      if (metaEl) {
        if (metaDescriptionCreated) {
          if (metaEl.parentNode) metaEl.parentNode.removeChild(metaEl);
        } else if (prevDescription !== null) {
          metaEl.setAttribute('content', prevDescription);
        }
      }
      if (canonicalEl) {
        if (canonicalCreated) {
          if (canonicalEl.parentNode) canonicalEl.parentNode.removeChild(canonicalEl);
        } else if (prevCanonicalHref !== null) {
          canonicalEl.setAttribute('href', prevCanonicalHref);
        }
      }
      // Walk hreflang entries in reverse for the same head-ordering
      // reason as the meta tags below.
      for (let i = hreflangRestore.length - 1; i >= 0; i--) {
        const entry = hreflangRestore[i];
        if (entry.created) {
          if (entry.el.parentNode) entry.el.parentNode.removeChild(entry.el);
        } else if (entry.prev !== null) {
          entry.el.setAttribute('href', entry.prev);
        }
      }
      // Walk in reverse so tags we appended get removed before any
      // sibling we may have appended after them — keeps <head> ordering
      // stable across mount/unmount cycles.
      for (let i = restore.length - 1; i >= 0; i--) {
        const entry = restore[i];
        if (entry.created) {
          if (entry.el.parentNode) entry.el.parentNode.removeChild(entry.el);
        } else if (entry.prev !== null) {
          entry.el.setAttribute('content', entry.prev);
        }
      }
    };
  }, [title, description, ogImageKey, ogTypeKey]);
}
