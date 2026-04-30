'use client';

import { useEffect, useState } from 'react';
import type { Locale } from '@/lib/types';
import { Button } from '../Button';
import { formatCAD } from '@/lib/format';

type Props = {
  priceFromCents: number;
  selectedSize: string | null;
  ctaHref: string;
  ctaLabel?: string;
  locale: Locale;
};

export function StickyActionBar({
  priceFromCents,
  selectedSize,
  ctaHref,
  ctaLabel,
  locale,
}: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onScroll = () => {
      setVisible(window.scrollY > 320);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const label =
    ctaLabel ??
    (locale === 'fr-ca' ? 'Personnaliser et commander' : 'Customize and order');
  const sizeLabel =
    locale === 'fr-ca'
      ? selectedSize
        ? `Taille ${selectedSize}`
        : 'Choisir une taille'
      : selectedSize
        ? `Size ${selectedSize}`
        : 'Choose a size';

  return (
    <div
      // `inert` removes the subtree from focus + a11y tree when not visible,
      // avoiding the "aria-hidden contains focusable" axe violation.
      inert={!visible}
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-sand-300 bg-canvas-000 shadow-lg transition-transform duration-base ease-standard md:hidden ${
        visible ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex flex-1 flex-col">
          <span className="text-body-sm font-semibold text-ink-950">
            {locale === 'fr-ca' ? 'À partir de ' : 'From '}
            {formatCAD(priceFromCents, locale)}
          </span>
          <span className="text-meta-xs text-stone-600">{sizeLabel}</span>
        </div>
        <Button href={ctaHref} variant="primary" size="md">
          {label}
        </Button>
      </div>
    </div>
  );
}
