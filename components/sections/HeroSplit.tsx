import Image from 'next/image';
import { Button } from '../Button';
import { Container } from '../Container';
import { TrustBullets } from './TrustBullets';
import type { TrustBulletItem } from './TrustBullets';

export type HeroSplitCollagePanel = {
  id: string;
  imageSrc: string;
  alt: string;
  rotation: number;
};

type Cta = {
  label: string;
  href: string;
};

type Props = {
  eyebrow: string;
  headline: string;
  subhead: string;
  primaryCta: Cta;
  secondaryCta: Cta;
  trustItems: TrustBulletItem[];
  collagePanels: HeroSplitCollagePanel[];
};

export function HeroSplit({
  eyebrow,
  headline,
  subhead,
  primaryCta,
  secondaryCta,
  trustItems,
  collagePanels,
}: Props) {
  return (
    <section className="relative isolate overflow-hidden bg-ink-950 text-canvas-000">
      {/* Subtle diagonal pattern at very low opacity */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(45deg, #FFFFFF 0, #FFFFFF 1px, transparent 1px, transparent 14px)',
        }}
      />

      <Container size="2xl" className="relative">
        <div className="grid items-center gap-10 py-20 md:grid-cols-12 md:gap-12 md:py-32">
          {/* LEFT: text + CTAs + trust bullets */}
          <div className="space-y-6 md:col-span-6 md:space-y-8">
            <span className="inline-block text-meta-xs uppercase tracking-[0.2em] text-sand-300">
              {eyebrow}
            </span>
            <h1 className="text-display-lg leading-tight md:text-display-xl">
              {headline}
            </h1>
            <p className="max-w-prose text-body-lg text-sand-100">
              {subhead}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                href={primaryCta.href}
                variant="primary"
                size="lg"
                className="bg-canvas-000 text-ink-950 hover:bg-sand-100"
              >
                {primaryCta.label}
              </Button>
              <Button
                href={secondaryCta.href}
                variant="tertiary"
                size="lg"
                className="border border-sand-300 text-canvas-000 hover:bg-ink-800"
              >
                {secondaryCta.label}
              </Button>
            </div>
            <TrustBullets items={trustItems} tone="dark" className="pt-2" />
          </div>

          {/* RIGHT: 2x2 garment collage */}
          <div className="md:col-span-6">
            <div className="grid grid-cols-2 gap-4 md:gap-6">
              {collagePanels.map((panel, i) => (
                <div
                  key={panel.id}
                  className="aspect-square overflow-hidden rounded-md bg-canvas-050 shadow-md md:rounded-lg"
                  style={{ transform: `rotate(${panel.rotation}deg)` }}
                >
                  <Image
                    src={panel.imageSrc}
                    alt={panel.alt}
                    width={400}
                    height={400}
                    sizes="(min-width: 768px) 25vw, 50vw"
                    priority={i === 0}
                    loading={i === 0 ? 'eager' : 'lazy'}
                    className="h-full w-full object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
