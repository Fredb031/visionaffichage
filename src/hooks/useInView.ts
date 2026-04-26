import { useEffect, useState, type RefObject } from 'react';

/**
 * Single-fire IntersectionObserver hook. Once the ref's element is at
 * least `threshold` visible, returns true forever (no re-trigger on scroll-back).
 */
export function useInView(
  ref: RefObject<Element | null>,
  options: { threshold?: number; rootMargin?: string } = {},
): boolean {
  const [inView, setInView] = useState(false);
  const { threshold = 0.1, rootMargin = '0px' } = options;

  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setInView(true);
            obs.disconnect();
            return;
          }
        }
      },
      { threshold, rootMargin },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref, inView, threshold, rootMargin]);

  return inView;
}
