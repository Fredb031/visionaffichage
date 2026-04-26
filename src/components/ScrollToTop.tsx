import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Scroll to top when the user navigates forward to a new route (PUSH /
 * REPLACE), but leave scroll alone on back/forward (POP) so the browser's
 * own scroll restoration kicks in — going back to the products grid
 * lands exactly where the user was, not at the top.
 *
 * When the new URL has a hash, scroll to the matching element instead
 * of the top — clicking the footer 'About' / 'How it works' links from
 * another page must land on the anchor. The browser's native hash
 * resolution doesn't fire on client-side navigation, so we resolve it
 * here. Falls back to top if the anchor isn't in the DOM yet (target
 * might be lazy-mounted; better to land at top than mid-scroll on the
 * previous page's offset).
 */
export function ScrollToTop() {
  const { pathname, hash } = useLocation();
  const navType = useNavigationType();
  useEffect(() => {
    if (navType === 'POP') return;
    if (hash) {
      // Strip the leading '#' and guard against malformed hashes that
      // would throw in querySelector (e.g. '#1foo' is an invalid CSS
      // selector). Use getElementById which accepts any string.
      const id = hash.startsWith('#') ? hash.slice(1) : hash;
      let decoded = id;
      if (id) {
        try {
          decoded = decodeURIComponent(id);
        } catch {
          // Malformed percent-encoding — fall back to the raw id.
        }
      }
      const el = decoded ? document.getElementById(decoded) : null;
      if (el) {
        el.scrollIntoView({ block: 'start' });
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [pathname, navType, hash]);
  return null;
}
