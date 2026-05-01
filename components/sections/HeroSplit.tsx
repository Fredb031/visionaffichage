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
  /**
   * Optional: an accent fragment within `headline` to receive subtle
   * underline emphasis (e.g. "premier regard" / "day one"). When matched,
   * the substring is rendered inside an editorial underline accent.
   */
  headlineAccent?: string;
};

function renderHeadline(headline: string, accent?: string) {
  if (!accent) return headline;
  const idx = headline.indexOf(accent);
  if (idx === -1) return headline;
  const before = headline.slice(0, idx);
  const after = headline.slice(idx + accent.length);
  return (
    <>
      {before}
      <em className="not-italic underline decoration-sand-300 decoration-2 underline-offset-[6px]">
        {accent}
      </em>
      {after}
    </>
  );
}

export function HeroSplit({
  eyebrow,
  headline,
  subhead,
  primaryCta,
  secondaryCta,
  trustItems,
  collagePanels,
  headlineAccent,
}: Props) {
  // Defensive split for the editorial collage:
  //  panel[0] -> LARGE feature flat-lay (top, takes full width)
  //  panel[1..3] -> 3 small detail squares (logo / fabric / qc)
  const featurePanel = collagePanels[0];
  const detailPanels = collagePanels.slice(1, 4);

  return (
    <section className="relative isolate overflow-hidden bg-ink-950 text-canvas-000">
      {/* Subtle photographic grain — adds tactile premium feel */}
      <div
        aria-hidden
        className="bg-noise pointer-events-none absolute inset-0 opacity-60 mix-blend-overlay"
      />
      {/* Subtle diagonal hairline pattern at very low opacity */}
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
          <div className="space-y-7 md:col-span-6 md:space-y-9">
            <span className="inline-block text-meta-xs uppercase tracking-[0.25em] text-sand-300">
              {eyebrow}
            </span>
            <h1 className="text-display-lg leading-[1.05] tracking-[-0.02em] md:text-display-xl">
              {renderHeadline(headline, headlineAccent)}
            </h1>
            <p className="max-w-[34rem] text-body-lg leading-relaxed text-sand-100">
              {subhead}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                href={primaryCta.href}
                variant="primary"
                size="lg"
                className="bg-canvas-000 text-ink-950 ring-1 ring-canvas-000/0 transition hover:bg-sand-100 hover:ring-sand-300/40 motion-safe:transition-[background-color,box-shadow,transform] motion-safe:duration-base motion-safe:ease-standard"
              >
                {primaryCta.label}
              </Button>
              <Button
                href={secondaryCta.href}
                variant="tertiary"
                size="lg"
                className="border border-sand-300/40 text-canvas-000 transition hover:border-sand-300 hover:bg-ink-800 motion-safe:duration-base motion-safe:ease-standard"
              >
                {secondaryCta.label}
              </Button>
            </div>
            <TrustBullets items={trustItems} tone="dark" className="pt-4" />
          </div>

          {/* RIGHT: editorial asymmetric collage */}
          <div className="md:col-span-6">
            <div className="grid grid-cols-3 gap-3 md:gap-4">
              {/* LARGE feature flat-lay — spans 3 cols, ~65% height */}
              {featurePanel && (
                <div
                  className="motion-safe:animate-hero-panel relative col-span-3 overflow-hidden rounded-md bg-canvas-050 shadow-xs ring-1 ring-canvas-000/5 transition motion-safe:hover:scale-[1.01] motion-safe:duration-slow motion-safe:ease-standard"
                  style={{ aspectRatio: '4 / 5', animationDelay: '0ms' }}
                >
                  <Image
                    src={featurePanel.imageSrc}
                    alt={featurePanel.alt}
                    fill
                    sizes="(min-width: 768px) 50vw, 100vw"
                    priority
                    className="object-cover"
                  />
                  <div
                    aria-hidden
                    className="bg-noise pointer-events-none absolute inset-0 opacity-40 mix-blend-overlay"
                  />
                </div>
              )}

              {/* 3 detail panels: logo / fabric / qc */}
              {detailPanels.map((panel, i) => (
                <div
                  key={panel.id}
                  className="motion-safe:animate-hero-panel relative aspect-square overflow-hidden rounded-md bg-canvas-050 shadow-xs ring-1 ring-canvas-000/5"
                  style={{ animationDelay: `${(i + 1) * 100}ms` }}
                >
                  <Image
                    src={panel.imageSrc}
                    alt={panel.alt}
                    fill
                    sizes="(min-width: 768px) 17vw, 33vw"
                    loading="lazy"
                    className="object-cover"
                  />
                  <div
                    aria-hidden
                    className="bg-noise pointer-events-none absolute inset-0 opacity-30 mix-blend-overlay"
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
