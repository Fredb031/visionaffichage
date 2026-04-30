import { Check } from 'lucide-react';
import type { Locale } from '@/lib/types';
import { Button } from '../Button';
import { Container } from '../Container';

type Props = {
  locale: Locale;
  className?: string;
};

export function DiscoveryKitTeaser({ locale, className = '' }: Props) {
  const base = `/${locale}`;
  const t =
    locale === 'fr-ca'
      ? {
          eyebrow: 'Pas sûr ?',
          headline: 'Commande un kit découverte',
          body: 'Trois échantillons, dans la couleur de ton équipe, livrés chez toi. Touche le tissu, vois la broderie, décide en toute confiance.',
          bullets: [
            'Trois vêtements représentatifs',
            'Dans la couleur de ton choix',
            'Livraison gratuite, retour gratuit',
          ],
          cta: 'Commander un kit',
        }
      : {
          eyebrow: 'Not sure?',
          headline: 'Order a discovery kit',
          body: 'Three samples in your team color, shipped to your door. Feel the fabric, see the embroidery, decide with confidence.',
          bullets: [
            'Three representative pieces',
            'In the color of your choice',
            'Free shipping, free return',
          ],
          cta: 'Order a kit',
        };

  return (
    <section className={`bg-sand-100 py-16 md:py-20 ${className}`.trim()}>
      <Container size="xl">
        <div className="grid gap-10 rounded-lg bg-canvas-000 p-8 shadow-sm md:grid-cols-12 md:p-12">
          <div className="md:col-span-7">
            <p className="text-meta-xs uppercase tracking-wider text-stone-600">
              {t.eyebrow}
            </p>
            <h2 className="mt-3 text-title-xl text-ink-950">{t.headline}</h2>
            <p className="mt-4 text-body-lg text-stone-600">{t.body}</p>
          </div>
          <div className="md:col-span-5">
            <ul className="space-y-3">
              {t.bullets.map((b) => (
                <li
                  key={b}
                  className="flex items-start gap-3 text-body-md text-ink-950"
                >
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-pill bg-success-50 text-success-700">
                    <Check aria-hidden className="h-4 w-4" />
                  </span>
                  {b}
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <Button
                href={`${base}/kit`}
                variant="primary"
                size="lg"
              >
                {t.cta}
              </Button>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
