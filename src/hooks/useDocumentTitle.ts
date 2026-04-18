import { useEffect } from 'react';

/**
 * Set document.title for the life of the mounted component, restoring
 * the previous title on unmount. Used across pages so SPA navigation
 * doesn't leak stale titles between routes.
 */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    const prev = document.title;
    document.title = title;
    return () => { document.title = prev; };
  }, [title]);
}
