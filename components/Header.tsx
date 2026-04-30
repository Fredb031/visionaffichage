'use client';

import { useState, Suspense } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { Menu, X, ShoppingCart } from 'lucide-react';
import { Container } from './Container';
import { Button } from './Button';
import { LanguageSwitcher } from './LanguageSwitcher';
import type { Locale } from '@/i18n/routing';

export function Header() {
  const locale = useLocale() as Locale;
  const tNav = useTranslations('nav');
  const tHeader = useTranslations('header');
  const tCart = useTranslations('cart');
  const [open, setOpen] = useState(false);

  const base = `/${locale}`;
  const nav = [
    { href: `${base}/produits`, label: tNav('products') },
    { href: `${base}/industries`, label: tNav('industries') },
    { href: `${base}/comment-ca-marche`, label: tNav('process') },
    { href: `${base}/avis`, label: tNav('portfolio') },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-sand-300 bg-canvas-000/95 backdrop-blur supports-[backdrop-filter]:bg-canvas-000/80">
      <Container size="2xl">
        <div className="flex h-16 items-center justify-between gap-4 md:h-20">
          <Link
            href={base}
            className="flex items-center gap-2 text-title-md font-semibold tracking-tight text-ink-950 hover:opacity-80 transition-opacity duration-base ease-standard"
            aria-label="Vision Affichage"
          >
            <span aria-hidden className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-ink-950 text-canvas-000 text-meta-xs font-semibold">VA</span>
            <span className="hidden sm:inline">Vision Affichage</span>
          </Link>

          <nav aria-label="Primary" className="hidden lg:block">
            <ul className="flex items-center gap-6">
              {nav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-body-md text-ink-950 hover:text-slate-700 transition-colors duration-base ease-standard"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-2">
            <Suspense fallback={<span className="hidden sm:inline-flex h-9 w-[44px]" aria-hidden />}>
              <LanguageSwitcher className="hidden sm:inline-flex" />
            </Suspense>
            <button
              type="button"
              aria-label={tCart('label')}
              className="hidden sm:inline-flex h-10 w-10 items-center justify-center rounded-sm text-ink-950 hover:bg-sand-100 transition-colors duration-base ease-standard"
            >
              <ShoppingCart aria-hidden className="h-5 w-5" />
            </button>

            <Button href={`${base}/produits`} variant="tertiary" size="sm" className="hidden md:inline-flex">
              {tHeader('ctaCatalog')}
            </Button>
            <Button href={`${base}/contact`} variant="secondary" size="sm" className="hidden md:inline-flex">
              {tHeader('ctaContact')}
            </Button>
            <Button href={`${base}/soumission`} variant="primary" size="sm" className="hidden sm:inline-flex">
              {tHeader('ctaQuote')}
            </Button>

            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label={tNav('openMenu')}
              aria-expanded={open}
              aria-controls="mobile-menu"
              className="inline-flex h-10 w-10 items-center justify-center rounded-sm text-ink-950 hover:bg-sand-100 transition-colors duration-base ease-standard lg:hidden"
            >
              <Menu aria-hidden className="h-6 w-6" />
            </button>
          </div>
        </div>
      </Container>

      {open && (
        <div
          id="mobile-menu"
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={tNav('menu')}
        >
          <button
            type="button"
            aria-label={tNav('close')}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink-950/50"
          />
          <div className="absolute right-0 top-0 flex h-full w-full max-w-sm flex-col bg-canvas-000 shadow-lg">
            <div className="flex h-16 items-center justify-between border-b border-sand-300 px-6 md:h-20">
              <span className="text-title-md font-semibold text-ink-950">{tNav('menu')}</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={tNav('close')}
                className="inline-flex h-10 w-10 items-center justify-center rounded-sm text-ink-950 hover:bg-sand-100 transition-colors duration-base ease-standard"
              >
                <X aria-hidden className="h-6 w-6" />
              </button>
            </div>
            <nav aria-label="Mobile" className="flex-1 overflow-y-auto px-6 py-6">
              <ul className="space-y-1">
                {nav.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="block rounded-sm px-3 py-3 text-body-lg text-ink-950 hover:bg-sand-100 transition-colors duration-base ease-standard"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex flex-col gap-3 border-t border-sand-300 pt-6">
                <Button href={`${base}/soumission`} variant="primary" size="lg" onClick={() => setOpen(false)}>
                  {tHeader('ctaQuote')}
                </Button>
                <Button href={`${base}/produits`} variant="secondary" size="lg" onClick={() => setOpen(false)}>
                  {tHeader('ctaCatalog')}
                </Button>
                <Button href={`${base}/contact`} variant="tertiary" size="lg" onClick={() => setOpen(false)}>
                  {tHeader('ctaContact')}
                </Button>
              </div>
              <div className="mt-6 border-t border-sand-300 pt-6">
                <Suspense fallback={<span className="inline-flex h-9 w-[44px]" aria-hidden />}>
                  <LanguageSwitcher />
                </Suspense>
              </div>
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
