import type { ReactNode } from 'react';
import { Container } from '../Container';
import { Section } from '../Section';
import { Button } from '../Button';
import type { Locale } from '@/i18n/routing';

export type PhaseTwoStubKey =
  | 'soumission'
  | 'kit'
  | 'avis'
  | 'a-propos'
  | 'contact'
  | 'faq'
  | 'comment-ca-marche';

type Cta = {
  label: string;
  href: string;
};

type StubCopy = {
  eyebrow: string;
  heading: string;
  body: ReactNode;
  primary: Cta;
  secondary: Cta;
};

type Props = {
  locale: Locale;
  pageKey: PhaseTwoStubKey;
};

const PHONE_HREF = 'tel:+13673804808';
const PHONE_DISPLAY = '(367) 380-4808';
const EMAIL = 'contact@visionaffichage.com';

function getCopy(locale: Locale, pageKey: PhaseTwoStubKey): StubCopy {
  const isFr = locale === 'fr-ca';
  const base = `/${locale}`;
  const eyebrow = 'Phase 2';
  const phoneCta: Cta = {
    label: isFr ? 'Contactez-nous par téléphone' : 'Call us',
    href: PHONE_HREF,
  };

  switch (pageKey) {
    case 'soumission':
      return {
        eyebrow,
        heading: isFr ? 'Demander une soumission' : 'Request a quote',
        body: isFr ? (
          <>
            <p>
              Tu prépares une commande de 50+ unités, plusieurs adresses de
              livraison, ou un projet récurrent? On répond aux soumissions sous
              24h ouvrables.
            </p>
            <p>
              Cette page interactive arrive en Phase 2 — d&apos;ici là, écris-nous
              à <a className="underline hover:text-ink-700" href={`mailto:${EMAIL}?subject=Soumission`}>{EMAIL}</a> avec : ton entreprise, l&apos;industrie, la quantité approximative,
              ton délai. On revient avec un prix et un échéancier.
            </p>
          </>
        ) : (
          <>
            <p>
              Planning a 50+ unit order, multiple ship-to addresses, or a
              recurring program? We answer quote requests within one business
              day.
            </p>
            <p>
              This interactive page is coming in Phase 2 — meanwhile, email us
              at <a className="underline hover:text-ink-700" href={`mailto:${EMAIL}?subject=Quote`}>{EMAIL}</a> with: company, industry, approximate quantity, deadline.
              We&apos;ll come back with pricing and a timeline.
            </p>
          </>
        ),
        primary: {
          label: isFr ? 'Écris-nous maintenant' : 'Email us now',
          href: `mailto:${EMAIL}?subject=${isFr ? 'Soumission' : 'Quote'}`,
        },
        secondary: phoneCta,
      };
    case 'kit':
      return {
        eyebrow,
        heading: isFr ? 'Kit découverte' : 'Discovery kit',
        body: isFr ? (
          <>
            <p>
              Pas certain de la qualité avant de commander pour ton équipe? Le
              kit découverte contient 3 vêtements de base (t-shirt, polo,
              hoodie) à toucher, comparer et essayer.
            </p>
            <p>
              Disponible en Phase 2. En attendant, magasine notre catalogue
              complet pour voir les options.
            </p>
          </>
        ) : (
          <>
            <p>
              Not sure about quality before ordering for your team? The
              discovery kit ships three base garments (tee, polo, hoodie) so
              you can feel, compare, and try them on.
            </p>
            <p>
              Coming in Phase 2. In the meantime, browse our full catalog to
              see the options.
            </p>
          </>
        ),
        primary: {
          label: isFr ? 'Magasiner les uniformes' : 'Shop uniforms',
          href: `${base}/produits`,
        },
        secondary: phoneCta,
      };
    case 'avis':
      return {
        eyebrow,
        heading: isFr ? 'Avis clients' : 'Customer reviews',
        body: isFr ? (
          <>
            <p>
              Toutes nos évaluations Google et témoignages clients arrivent
              ici. Une page dédiée rassemblera notes, citations et photos
              terrain par industrie.
            </p>
            <p>
              En attendant, vois nos huit avis vedettes sur la page
              d&apos;accueil.
            </p>
          </>
        ) : (
          <>
            <p>
              All our Google ratings and customer testimonials are coming here.
              A dedicated page will gather scores, quotes, and on-site photos
              by industry.
            </p>
            <p>In the meantime, see our eight featured reviews on the home page.</p>
          </>
        ),
        primary: {
          label: isFr ? 'Retour à l’accueil' : 'Back to home',
          href: base,
        },
        secondary: phoneCta,
      };
    case 'a-propos':
      return {
        eyebrow,
        heading: isFr
          ? 'À propos de Vision Affichage'
          : 'About Vision Affichage',
        body: isFr ? (
          <>
            <p>
              Atelier de broderie et sérigraphie à Blainville (Québec) depuis
              2021. Spécialisés dans les uniformes d&apos;entreprise pour PME
              québécoises (construction, paysagement, restauration, services,
              corporatif).
            </p>
            <p>
              Production locale, contrôle qualité interne, livraison en 5 jours
              ouvrables. Plus de 33 000 vêtements livrés à plus de 500
              entreprises québécoises.
            </p>
            <p>Page complète avec équipe, atelier et histoire en Phase 2.</p>
          </>
        ) : (
          <>
            <p>
              Embroidery and screen-print shop in Blainville (Quebec) since
              2021. We specialize in company apparel for Quebec SMBs
              (construction, landscaping, food service, services, corporate).
            </p>
            <p>
              Local production, in-house QC, five-business-day delivery. Over
              33,000 garments delivered to 500+ Quebec companies.
            </p>
            <p>Full team, shop, and history page coming in Phase 2.</p>
          </>
        ),
        primary: {
          label: isFr ? 'Voir nos industries' : 'See our industries',
          href: `${base}/industries`,
        },
        secondary: phoneCta,
      };
    case 'contact':
      return {
        eyebrow,
        heading: isFr ? 'Contactez-nous' : 'Contact us',
        body: isFr ? (
          <>
            <p>Trois façons de nous joindre :</p>
            <ul className="mt-4 grid gap-4 sm:grid-cols-3">
              <li className="rounded-md border border-sand-300 bg-canvas-000 p-5">
                <p className="text-meta-xs font-semibold uppercase tracking-wider text-stone-500">
                  Téléphone
                </p>
                <p className="mt-2 text-body-md text-ink-950">
                  <a className="underline hover:text-ink-700" href={PHONE_HREF}>
                    {PHONE_DISPLAY}
                  </a>
                </p>
                <p className="mt-1 text-body-sm text-stone-500">8h–17h ET</p>
              </li>
              <li className="rounded-md border border-sand-300 bg-canvas-000 p-5">
                <p className="text-meta-xs font-semibold uppercase tracking-wider text-stone-500">
                  Courriel
                </p>
                <p className="mt-2 text-body-md text-ink-950">
                  <a className="underline hover:text-ink-700" href={`mailto:${EMAIL}`}>
                    {EMAIL}
                  </a>
                </p>
                <p className="mt-1 text-body-sm text-stone-500">
                  Réponse en moins d&apos;un jour ouvrable.
                </p>
              </li>
              <li className="rounded-md border border-sand-300 bg-canvas-000 p-5">
                <p className="text-meta-xs font-semibold uppercase tracking-wider text-stone-500">
                  Atelier
                </p>
                <p className="mt-2 text-body-md text-ink-950">Blainville (Québec)</p>
                <p className="mt-1 text-body-sm text-stone-500">Sur rendez-vous.</p>
              </li>
            </ul>
            <p className="mt-6">Formulaire interactif en Phase 2.</p>
          </>
        ) : (
          <>
            <p>Three ways to reach us:</p>
            <ul className="mt-4 grid gap-4 sm:grid-cols-3">
              <li className="rounded-md border border-sand-300 bg-canvas-000 p-5">
                <p className="text-meta-xs font-semibold uppercase tracking-wider text-stone-500">
                  Phone
                </p>
                <p className="mt-2 text-body-md text-ink-950">
                  <a className="underline hover:text-ink-700" href={PHONE_HREF}>
                    {PHONE_DISPLAY}
                  </a>
                </p>
                <p className="mt-1 text-body-sm text-stone-500">8 AM–5 PM ET</p>
              </li>
              <li className="rounded-md border border-sand-300 bg-canvas-000 p-5">
                <p className="text-meta-xs font-semibold uppercase tracking-wider text-stone-500">
                  Email
                </p>
                <p className="mt-2 text-body-md text-ink-950">
                  <a className="underline hover:text-ink-700" href={`mailto:${EMAIL}`}>
                    {EMAIL}
                  </a>
                </p>
                <p className="mt-1 text-body-sm text-stone-500">
                  Reply within one business day.
                </p>
              </li>
              <li className="rounded-md border border-sand-300 bg-canvas-000 p-5">
                <p className="text-meta-xs font-semibold uppercase tracking-wider text-stone-500">
                  Shop
                </p>
                <p className="mt-2 text-body-md text-ink-950">Blainville, Quebec</p>
                <p className="mt-1 text-body-sm text-stone-500">By appointment.</p>
              </li>
            </ul>
            <p className="mt-6">Interactive form coming in Phase 2.</p>
          </>
        ),
        primary: {
          label: isFr ? 'Téléphone' : 'Call us',
          href: PHONE_HREF,
        },
        secondary: {
          label: isFr ? 'Courriel' : 'Email',
          href: `mailto:${EMAIL}`,
        },
      };
    case 'faq':
      return {
        eyebrow,
        heading: isFr ? 'Questions fréquentes' : 'Frequently asked questions',
        body: isFr ? (
          <>
            <p>
              FAQ centralisée en construction. Une page complète couvrira
              broderie vs sérigraphie, délais, quantités minimales, soumissions
              et livraison.
            </p>
            <p>
              En attendant, vois les FAQ par produit sur les pages produit ainsi
              que la FAQ d&apos;accueil.
            </p>
          </>
        ) : (
          <>
            <p>
              Central FAQ under construction. A full page will cover embroidery
              vs screen print, lead times, minimum quantities, quotes, and
              shipping.
            </p>
            <p>
              In the meantime, see the per-product FAQs on product pages plus
              the home-page FAQ.
            </p>
          </>
        ),
        primary: {
          label: isFr ? 'Retour à l’accueil' : 'Back to home',
          href: base,
        },
        secondary: phoneCta,
      };
    case 'comment-ca-marche': {
      const stepsFr = [
        'Choisis tes vêtements',
        'On approuve ton logo',
        'Maquette envoyée',
        'Production + livraison en 5 jours',
      ];
      const stepsEn = [
        'Pick your apparel',
        'We approve your logo',
        'Proof sent',
        'Production + delivery in 5 days',
      ];
      const steps = isFr ? stepsFr : stepsEn;
      return {
        eyebrow,
        heading: isFr ? 'Comment ça marche' : 'How it works',
        body: (
          <>
            <p>
              {isFr
                ? 'Page détaillée bientôt. Aperçu rapide :'
                : 'Detailed page coming soon. Quick overview:'}
            </p>
            <ol className="mt-4 grid gap-4 md:grid-cols-2">
              {steps.map((label, idx) => (
                <li
                  key={label}
                  className="flex gap-4 rounded-md border border-sand-300 bg-canvas-000 p-5"
                >
                  <span className="text-meta-xs font-semibold uppercase tracking-wider text-stone-500">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <span className="text-body-md text-ink-950">{label}</span>
                </li>
              ))}
            </ol>
          </>
        ),
        primary: {
          label: isFr ? 'Magasiner les uniformes' : 'Shop uniforms',
          href: `${base}/produits`,
        },
        secondary: phoneCta,
      };
    }
    default: {
      const exhaustive: never = pageKey;
      void exhaustive;
      throw new Error('Unknown PhaseTwoStub pageKey');
    }
  }
}

export function PhaseTwoStub({ locale, pageKey }: Props) {
  const copy = getCopy(locale, pageKey);

  return (
    <Section tone="warm">
      <Container size="lg">
        <div className="max-w-3xl">
          <p className="text-meta-xs font-semibold uppercase tracking-wider text-stone-500">
            {copy.eyebrow}
          </p>
          <h1 className="mt-4 text-display-lg text-ink-950 md:text-display-xl">
            {copy.heading}
          </h1>
          <div className="mt-8 space-y-4 text-body-lg text-stone-500">
            {copy.body}
          </div>
          <div className="mt-10 flex flex-wrap gap-4">
            <Button href={copy.primary.href} variant="primary" size="lg">
              {copy.primary.label}
            </Button>
            <Button href={copy.secondary.href} variant="secondary" size="lg">
              {copy.secondary.label}
            </Button>
          </div>
        </div>
      </Container>
    </Section>
  );
}
