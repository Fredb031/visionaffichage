'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { Locale } from '@/lib/types';

type Props = {
  slug: string;
  title: string;
  gallery?: string[];
  locale?: Locale;
  className?: string;
};

const viewLabels: Record<number, { 'fr-ca': string; 'en-ca': string }> = {
  0: { 'fr-ca': 'Vue avant', 'en-ca': 'Front view' },
  1: { 'fr-ca': 'Vue arrière', 'en-ca': 'Back view' },
  2: { 'fr-ca': 'Détail logo', 'en-ca': 'Logo detail' },
};

export function ProductGallery({
  slug,
  title,
  gallery,
  locale = 'fr-ca',
  className = '',
}: Props) {
  const views = (gallery && gallery.length > 0 ? gallery : [slug]).slice(0, 4);
  const [active, setActive] = useState(0);
  const activeSlug = views[active] ?? slug;

  return (
    <div className={`flex flex-col gap-4 ${className}`.trim()}>
      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-sand-100">
        <Image
          src={`/placeholders/products/${activeSlug}.svg`}
          alt={title}
          fill
          priority
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-contain p-8"
        />
      </div>

      {views.length > 1 ? (
        <div
          role="tablist"
          aria-label={locale === 'fr-ca' ? 'Vues du produit' : 'Product views'}
          className="grid grid-cols-4 gap-3"
        >
          {views.map((v, i) => {
            const isActive = i === active;
            const label = viewLabels[i]?.[locale] ?? `${i + 1}`;
            return (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActive(i)}
                className={`relative aspect-square w-full overflow-hidden rounded-sm bg-sand-100 transition-shadow duration-base ease-standard hover:shadow-sm focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700 ${
                  isActive ? 'ring-2 ring-ink-950' : ''
                }`}
                aria-label={label}
              >
                <Image
                  src={`/placeholders/products/${v}.svg`}
                  alt=""
                  fill
                  sizes="120px"
                  className="object-contain p-2"
                />
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-body-sm text-stone-600">
          {locale === 'fr-ca' ? 'Plus de vues à venir.' : 'More views coming.'}
        </p>
      )}
    </div>
  );
}
