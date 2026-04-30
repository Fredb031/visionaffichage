import type { Locale } from '@/lib/types';
import { Container } from '../Container';
import { Section } from '../Section';

type Step = {
  number: string;
  title: string;
  description: string;
};

type Props = {
  locale: Locale;
  className?: string;
};

export function HowItWorks({ locale, className = '' }: Props) {
  const heading =
    locale === 'fr-ca' ? 'Comment ça marche' : 'How it works';

  const steps: Step[] =
    locale === 'fr-ca'
      ? [
          {
            number: '01',
            title: 'Choisis tes vêtements',
            description:
              'Magasine notre catalogue ou commande un kit découverte pour toucher trois échantillons.',
          },
          {
            number: '02',
            title: 'On approuve ton logo',
            description:
              'On numérise et on t\'envoie une épreuve. Tu approuves avant qu\'on touche aux vêtements.',
          },
          {
            number: '03',
            title: 'Reçois ta commande en 5 jours ouvrables',
            description:
              'Production garantie en cinq jours après approbation. Livraison partout au Québec.',
          },
        ]
      : [
          {
            number: '01',
            title: 'Pick your apparel',
            description:
              'Browse the catalog or order a discovery kit to touch three samples first.',
          },
          {
            number: '02',
            title: 'We approve your logo',
            description:
              'We digitize and send a proof. You approve before we touch any apparel.',
          },
          {
            number: '03',
            title: 'Get your order in 5 business days',
            description:
              'Guaranteed five-day production after approval. Delivery anywhere in Quebec.',
          },
        ];

  return (
    <Section tone="default" className={className}>
      <Container size="2xl">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-4">
            <h2 className="text-title-xl text-ink-950">{heading}</h2>
          </div>
          <ol className="md:col-span-8 grid gap-6 md:grid-cols-3">
            {steps.map((step) => (
              <li
                key={step.number}
                className="flex flex-col rounded-md border border-sand-300 bg-canvas-000 p-6"
              >
                <span className="text-meta-xs font-semibold uppercase tracking-wider text-stone-500">
                  {step.number}
                </span>
                <h3 className="mt-3 text-title-md text-ink-950">{step.title}</h3>
                <p className="mt-2 text-body-md text-stone-500">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </Container>
    </Section>
  );
}
