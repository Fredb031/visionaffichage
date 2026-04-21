import { useEffect } from 'react';

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
 */
export function useDocumentTitle(title: string, description?: string): void {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title;

    let metaEl: HTMLMetaElement | null = null;
    let prevDescription: string | null = null;
    if (description !== undefined) {
      metaEl = document.querySelector<HTMLMetaElement>('meta[name="description"]');
      if (metaEl) {
        prevDescription = metaEl.getAttribute('content');
        metaEl.setAttribute('content', description);
      }
    }

    return () => {
      document.title = prevTitle;
      if (metaEl && prevDescription !== null) {
        metaEl.setAttribute('content', prevDescription);
      }
    };
  }, [title, description]);
}
