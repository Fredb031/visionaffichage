import Image from 'next/image';
import { Button } from '../Button';
import { Container } from '../Container';

type Cta = {
  label: string;
  href: string;
};

type Tone = 'ink' | 'warm' | 'sand';

type Props = {
  eyebrow?: string;
  headline: string;
  subhead?: string;
  primaryCta: Cta;
  secondaryCta?: Cta;
  imageSlug?: string;
  imageAlt?: string;
  tone?: Tone;
};

const toneClass: Record<Tone, string> = {
  ink: 'bg-ink-950 text-canvas-050',
  warm: 'bg-canvas-050 text-ink-950',
  sand: 'bg-sand-100 text-ink-950',
};

const eyebrowClass: Record<Tone, string> = {
  ink: 'text-sand-300',
  warm: 'text-stone-600',
  sand: 'text-stone-600',
};

const subheadClass: Record<Tone, string> = {
  ink: 'text-sand-100',
  warm: 'text-stone-600',
  sand: 'text-stone-600',
};

export function HeroBlock({
  eyebrow,
  headline,
  subhead,
  primaryCta,
  secondaryCta,
  imageSlug,
  imageAlt,
  tone = 'ink',
}: Props) {
  const isInk = tone === 'ink';
  return (
    <section className={toneClass[tone]}>
      <Container size="2xl">
        <div className="grid items-center gap-10 py-20 md:grid-cols-12 md:py-28 lg:py-32">
          <div
            className={`md:col-span-7 ${imageSlug ? 'lg:col-span-6' : 'lg:col-span-7'}`}
          >
            {eyebrow ? (
              <p
                className={`text-meta-xs uppercase tracking-wider ${eyebrowClass[tone]}`}
              >
                {eyebrow}
              </p>
            ) : null}
            <h1
              className={`mt-6 text-display-lg md:text-display-xl ${isInk ? 'text-canvas-000' : 'text-ink-950'}`}
            >
              {headline}
            </h1>
            {subhead ? (
              <p className={`mt-6 max-w-xl text-body-lg ${subheadClass[tone]}`}>
                {subhead}
              </p>
            ) : null}
            <div className="mt-10 flex flex-wrap gap-3">
              <Button
                href={primaryCta.href}
                variant="primary"
                size="lg"
                className={
                  isInk
                    ? 'bg-canvas-000 text-ink-950 hover:bg-sand-100'
                    : ''
                }
              >
                {primaryCta.label}
              </Button>
              {secondaryCta ? (
                <Button
                  href={secondaryCta.href}
                  variant={isInk ? 'tertiary' : 'secondary'}
                  size="lg"
                  className={
                    isInk
                      ? 'border border-sand-300 text-canvas-000 hover:bg-ink-800'
                      : ''
                  }
                >
                  {secondaryCta.label}
                </Button>
              ) : null}
            </div>
          </div>
          {imageSlug ? (
            <div className="relative md:col-span-5 lg:col-span-6">
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-sand-100">
                <Image
                  src={`/placeholders/industries/${imageSlug}.svg`}
                  alt={imageAlt ?? ''}
                  fill
                  priority
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-cover"
                />
              </div>
            </div>
          ) : null}
        </div>
      </Container>
    </section>
  );
}
