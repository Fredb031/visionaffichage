import { Link } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { SiteFooter } from '@/components/SiteFooter';
import { useLang } from '@/lib/langContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

// /about — Master Prompt "Audi precision" rebuild.
// The page is a confident, minimal narrative for a buyer vetting the
// brand before placing a custom order. Five strips alternating
// va-bg-1 / va-bg-2 / va-black, each one carrying a single idea so
// the eye moves cleanly down the column instead of pinballing across
// cards. Copy stays bilingual via the lang context.

export default function About() {
  const { lang } = useLang();
  useDocumentTitle(
    lang === 'en' ? 'About — Vision Affichage' : 'À propos — Vision Affichage',
    lang === 'en'
      ? "Quebec's merch studio for serious crews. 33,000+ pieces delivered since 2021. 5 business days, no minimum, no mandatory call."
      : "Le studio de merch des entrepreneurs québécois. 33 000+ pièces livrées depuis 2021. 5 jours ouvrables, sans minimum, sans appel obligatoire.",
    {},
  );

  // Values — three pillars that map to the operational promises the
  // shop is willing to be measured on. Rendered from data so swapping
  // copy stays a one-line change.
  const values = [
    {
      titleFr: 'Précision',
      titleEn: 'Precision',
      bodyFr:
        "Notre équipe positionne ton logo selon les standards de l'industrie. Tu n'as pas besoin d'être graphiste.",
      bodyEn:
        'Our team positions your logo to industry standards. You do not need to be a designer.',
    },
    {
      titleFr: 'Vitesse',
      titleEn: 'Speed',
      bodyFr:
        "5 jours ouvrables. En retard d'une journée = remboursé. Aucune exception.",
      bodyEn:
        'Five business days. One day late = refunded. No exceptions.',
    },
    {
      titleFr: 'Présence',
      titleEn: 'Presence',
      bodyFr:
        'Ton logo. Sur ton équipe. Visible chez chaque client. Chaque chantier.',
      bodyEn:
        'Your logo. On your crew. Visible at every client. Every jobsite.',
    },
  ] as const;

  return (
    <div className="min-h-screen bg-va-bg-1 flex flex-col">
      <Navbar />
      <main id="main-content" className="flex-1">
        {/* 1. Hero strip — eyebrow + headline. No lede; the next strip
            carries the explanation. The H1 is allowed to dominate. */}
        <section className="bg-va-bg-1 py-24 md:py-36">
          <div className="max-w-6xl mx-auto px-6 md:px-10">
            <div className="text-va-muted text-xs uppercase tracking-[0.15em] font-semibold mb-4">
              {lang === 'en' ? 'Vision Affichage' : 'Vision Affichage'}
            </div>
            <h1 className="font-display font-black text-va-ink text-5xl md:text-7xl tracking-[-0.03em] leading-[1.0] max-w-5xl">
              {lang === 'en'
                ? "Quebec's merch studio for serious crews."
                : 'Le studio de merch des entrepreneurs québécois.'}
            </h1>
          </div>
        </section>

        {/* 2. Story strip — the elevator pitch in two paragraphs. */}
        <section className="bg-va-bg-2 py-24">
          <div className="max-w-6xl mx-auto px-6 md:px-10">
            <p className="text-xl text-va-dim leading-relaxed max-w-3xl">
              {lang === 'en'
                ? "We are not the cheapest. We are the fastest. Five business days, starting at one piece, no minimum, no mandatory call. You send your logo, we deliver your uniform. That is it."
                : "On n'est pas le moins cher. On est le plus rapide. 5 jours ouvrables, à partir d'une pièce, sans minimum, sans appel obligatoire. Tu envoies ton logo, on te livre ton uniforme. C'est tout."}
            </p>
            <p className="text-xl text-va-dim leading-relaxed max-w-3xl mt-6">
              {lang === 'en'
                ? '33,000+ pieces delivered since 2021. 500+ companies served. 5 stars on Google, no exceptions.'
                : '33 000+ pièces livrées depuis 2021. 500+ entreprises servies. 5 étoiles sur Google sans exception.'}
            </p>
          </div>
        </section>

        {/* 3. Values grid — three pillars, three columns, no icons.
            The labels carry the weight on their own. */}
        <section aria-labelledby="about-values" className="bg-va-bg-1 py-24">
          <div className="max-w-6xl mx-auto px-6 md:px-10">
            <h2 id="about-values" className="sr-only">
              {lang === 'en' ? 'Our values' : 'Nos valeurs'}
            </h2>
            <div className="grid md:grid-cols-3 gap-12 md:gap-16">
              {values.map(v => (
                <article key={v.titleEn}>
                  <h3 className="font-display font-black text-va-ink text-3xl md:text-4xl tracking-[-0.02em] mb-4">
                    {lang === 'en' ? v.titleEn : v.titleFr}
                  </h3>
                  <p className="text-base text-va-dim leading-relaxed">
                    {lang === 'en' ? v.bodyEn : v.bodyFr}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 4. Founder strip — black background, white type. The voice
            shifts to first person here; everywhere else the copy
            speaks for the shop. */}
        <section
          aria-labelledby="about-founder"
          className="bg-va-black text-white py-24"
        >
          <div className="max-w-6xl mx-auto px-6 md:px-10">
            <div className="text-white/60 text-xs uppercase tracking-[0.15em] font-semibold mb-4">
              {lang === 'en'
                ? 'Frederick Bouchard · Founder'
                : 'Frederick Bouchard · Fondateur'}
            </div>
            <h2
              id="about-founder"
              className="font-display font-black text-4xl md:text-5xl tracking-[-0.03em] leading-[1.05] mb-8 max-w-3xl"
            >
              {lang === 'en'
                ? 'Why Vision Affichage exists.'
                : 'Pourquoi Vision Affichage existe.'}
            </h2>
            <div className="space-y-5 text-lg text-white/80 leading-relaxed max-w-3xl">
              <p>
                {lang === 'en'
                  ? 'I started Vision Affichage because the others were taking three weeks to deliver a t-shirt. We do it in five days. That is it.'
                  : "J'ai démarré Vision Affichage parce que les autres prenaient 3 semaines pour livrer un t-shirt. On le fait en 5 jours. C'est tout."}
              </p>
              <p>
                {lang === 'en'
                  ? 'A small business ordering 20 hoodies deserves the same care as a tour ordering 20,000. We run print and embroidery in-house, in Saint-Hyacinthe, so a sketch on Monday becomes a sample on Wednesday.'
                  : "Une PME qui commande 20 chandails mérite le même soin qu'une tournée qui en commande 20 000. On fait l'impression et la broderie à l'interne, à Saint-Hyacinthe — un croquis le lundi devient un échantillon le mercredi."}
              </p>
              <p>
                {lang === 'en'
                  ? 'Restaurants, trades crews, youth leagues, solo brands. That is the rhythm we built the shop around, and that is the rhythm we keep.'
                  : "Restos, équipes de métiers, ligues jeunesse, marques solo. C'est le rythme autour duquel l'atelier est conçu, et c'est le rythme qu'on garde."}
              </p>
            </div>
          </div>
        </section>

        {/* 5. Closing CTA — single button, single line. */}
        <section
          aria-labelledby="about-cta"
          className="bg-va-bg-1 py-24"
        >
          <div className="max-w-6xl mx-auto px-6 md:px-10 text-center">
            <h2
              id="about-cta"
              className="font-display font-black text-va-ink text-4xl md:text-6xl tracking-[-0.03em] leading-[1.05] mb-10"
            >
              {lang === 'en'
                ? 'Ready to dress your crew?'
                : 'Prêt à habiller ton équipe?'}
            </h2>
            <Link
              to="/products"
              className="inline-flex items-center gap-2 bg-va-blue text-white px-10 py-5 rounded-xl shadow-[0_0_40px_rgba(0,82,204,0.3)] font-semibold text-base hover:bg-va-blue/90 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-va-blue/50 focus-visible:ring-offset-2"
            >
              {lang === 'en' ? 'Order now →' : 'Commander maintenant →'}
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
