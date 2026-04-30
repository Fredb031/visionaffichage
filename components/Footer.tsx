import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { Container } from './Container';
import { siteConfig } from '@/lib/site';
import type { Locale } from '@/i18n/routing';

export function Footer() {
  const locale = useLocale() as Locale;
  const tFooter = useTranslations('footer');
  const tNav = useTranslations('nav');
  const base = `/${locale}`;
  const year = new Date().getFullYear();

  return (
    <footer className="bg-ink-950 text-canvas-050">
      <Container size="2xl">
        <div className="grid gap-10 py-16 md:grid-cols-4 md:py-20">
          <div className="md:col-span-2 max-w-md">
            <Link
              href={base}
              className="inline-flex items-center gap-2 text-title-md font-semibold text-canvas-000"
              aria-label="Vision Affichage"
            >
              <span aria-hidden className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-canvas-000 text-ink-950 text-meta-xs font-semibold">VA</span>
              Vision Affichage
            </Link>
            <p className="mt-4 text-body-md text-sand-100">{tFooter('tagline')}</p>
          </div>

          <div>
            <h2 className="text-meta-xs uppercase tracking-wider text-sand-300">
              {tFooter('explore')}
            </h2>
            <ul className="mt-4 space-y-2 text-body-md">
              <li>
                <Link href={`${base}/produits`} className="hover:text-canvas-000 transition-colors duration-base ease-standard">{tNav('products')}</Link>
              </li>
              <li>
                <Link href={`${base}/industries`} className="hover:text-canvas-000 transition-colors duration-base ease-standard">{tNav('industries')}</Link>
              </li>
              <li>
                <Link href={`${base}/comment-ca-marche`} className="hover:text-canvas-000 transition-colors duration-base ease-standard">{tNav('process')}</Link>
              </li>
              <li>
                <Link href={`${base}/avis`} className="hover:text-canvas-000 transition-colors duration-base ease-standard">{tNav('portfolio')}</Link>
              </li>
              <li>
                <Link href={`${base}/a-propos`} className="hover:text-canvas-000 transition-colors duration-base ease-standard">{tNav('about')}</Link>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-meta-xs uppercase tracking-wider text-sand-300">
              {tFooter('contact')}
            </h2>
            <ul className="mt-4 space-y-2 text-body-md">
              <li>
                <span className="block text-sand-300 text-body-sm">{tFooter('phone')}</span>
                <a href={`tel:${siteConfig.phone}`} className="hover:text-canvas-000 transition-colors duration-base ease-standard">
                  {siteConfig.phoneDisplay}
                </a>
              </li>
              <li>
                <span className="block text-sand-300 text-body-sm">{tFooter('email')}</span>
                <a href={`mailto:${siteConfig.email}`} className="hover:text-canvas-000 transition-colors duration-base ease-standard">
                  {siteConfig.email}
                </a>
              </li>
              <li>
                <span className="block text-sand-300 text-body-sm">{tFooter('address')}</span>
                <span>{tFooter('addressLine')}</span>
              </li>
              <li>
                <span className="block text-sand-300 text-body-sm">{tFooter('hours')}</span>
                <span>{tFooter('hoursLine')}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col items-start justify-between gap-4 border-t border-ink-800 py-6 text-body-sm text-sand-300 md:flex-row md:items-center">
          <p>© {year} {siteConfig.legalName}. {tFooter('rights')}</p>
          <ul className="flex gap-6">
            <li>
              <Link href={`${base}/confidentialite`} className="hover:text-canvas-000 transition-colors duration-base ease-standard">{tFooter('privacy')}</Link>
            </li>
            <li>
              <Link href={`${base}/conditions`} className="hover:text-canvas-000 transition-colors duration-base ease-standard">{tFooter('terms')}</Link>
            </li>
          </ul>
        </div>
      </Container>
    </footer>
  );
}
