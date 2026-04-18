import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Scroll to top when the user navigates forward to a new route (PUSH /
 * REPLACE), but leave scroll alone on back/forward (POP) so the browser's
 * own scroll restoration kicks in — going back to the products grid
 * lands exactly where the user was, not at the top.
 */
export function ScrollToTop() {
  const { pathname } = useLocation();
  const navType = useNavigationType();
  useEffect(() => {
    if (navType === 'POP') return;
    window.scrollTo(0, 0);
  }, [pathname, navType]);
  return null;
}
