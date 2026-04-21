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

    const prevTitle = document.title;
    document.title = title;

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

    let metaEl: HTMLMetaElement | null = null;
    let prevDescription: string | null = null;
    if (description !== undefined) {
      metaEl = document.querySelector<HTMLMetaElement>('meta[name="description"]');
      if (metaEl) {
        prevDescription = metaEl.getAttribute('content');
        metaEl.setAttribute('content', description);
      }
    }

    // OG + Twitter bookkeeping — for each managed tag, record whether it
    // pre-existed (so we know whether to restore or remove on unmount)
    // and its previous content. `null` content in the restore map means
    // "remove on unmount"; a string means "restore to this value".
    const managed: ManagedTag[] = [
      { attr: 'property', key: 'og:title' },
      { attr: 'property', key: 'og:url' },
      { attr: 'property', key: 'og:type' },
      { attr: 'property', key: 'og:image' },
      { attr: 'name', key: 'twitter:card' },
      { attr: 'name', key: 'twitter:title' },
      { attr: 'name', key: 'twitter:image' },
    ];
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

    const ogImage = ogImageKey ?? DEFAULT_OG_IMAGE;
    const ogType = ogTypeKey ?? 'website';
    const ogUrl = typeof window !== 'undefined' ? window.location.href : '';

    for (const tag of managed) {
      let value: string;
      switch (tag.key) {
        case 'og:title':
        case 'twitter:title':
          value = title;
          break;
        case 'og:description':
        case 'twitter:description':
          // Only pushed into `managed` when description !== undefined.
          value = description as string;
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
      if (metaEl && prevDescription !== null) {
        metaEl.setAttribute('content', prevDescription);
      }
      if (canonicalEl) {
        if (canonicalCreated) {
          if (canonicalEl.parentNode) canonicalEl.parentNode.removeChild(canonicalEl);
        } else if (prevCanonicalHref !== null) {
          canonicalEl.setAttribute('href', prevCanonicalHref);
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
