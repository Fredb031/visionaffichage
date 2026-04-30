'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import type { ClientLogo, Locale } from '@/lib/types';

type Props = {
  logos: ClientLogo[];
  locale?: Locale;
  className?: string;
};

export function ClientLogoMarquee({ logos, locale = 'fr-ca', className = '' }: Props) {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  if (logos.length === 0) return null;

  // Duplicate for seamless loop.
  const display = reduced ? logos : [...logos, ...logos];
  const ariaLabel =
    locale === 'fr-ca' ? 'Quelques clients' : 'Selected clients';

  return (
    <div
      className={`relative w-full overflow-hidden ${className}`.trim()}
      role="region"
      aria-label={ariaLabel}
    >
      <ul
        className={`flex items-center gap-10 ${
          reduced
            ? 'flex-wrap justify-center snap-x snap-mandatory overflow-x-auto py-2'
            : 'animate-marquee whitespace-nowrap py-2 motion-reduce:animate-none'
        }`}
        style={
          reduced
            ? undefined
            : { animationDuration: `${Math.max(20, logos.length * 5)}s` }
        }
      >
        {display.map((logo, idx) => (
          <li
            key={`${logo.id}-${idx}`}
            className="flex h-16 w-40 shrink-0 items-center justify-center snap-center"
          >
            <Image
              src={`/placeholders/clients/${logo.id}.svg`}
              alt={logo.name}
              width={160}
              height={64}
              className="h-12 w-auto opacity-70 transition-opacity duration-base ease-standard hover:opacity-100"
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
