import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { SiteFooter } from '@/components/SiteFooter';
import { useLang } from '@/lib/langContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { CASE_STUDIES, type CaseStudy } from '@/data/caseStudies';

/**
 * Volume II Section 14 — /histoires-de-succes hub. Master Prompt Audi
 * visual rebuild: tall hero strip with display headline, stats row
 * with mono numerals, white card grid with industry pill + arrow CTA,
 * and a black closing strip with a glowing primary CTA.
 *
 * Hero images use the existing CardHero with the localized alt text
 * landed in commit c28c469. CASE_STUDIES is frozen + readonly per
 * commit 7df2683 — this hub only renders, never mutates.
 */

// Brand-navy fallback rendered when the placeholder hero image fails
// to load. Keeps the card aspect ratio so the grid stays even, and
// surfaces the company name so the card still communicates clearly.
function CardHero({ cs, alt }: { cs: CaseStudy; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div
        aria-hidden="true"
        className="w-full aspect-[16/10] bg-gradient-to-br from-[#0f2341] via-va-blue to-[#0f2341] flex items-center justify-center px-4"
      >
        <span className="text-white/90 text-[15px] font-extrabold tracking-[-0.3px] text-center">
          {cs.companyName}
        </span>
      </div>
    );
  }
  return (
    <img
      src={cs.heroImage}
      alt={alt}
      width={800}
      height={500}
      loading="lazy"
      decoding="async"
      className="w-full aspect-[16/10] object-cover bg-va-bg-2"
      onError={() => setFailed(true)}
    />
  );
}

export default function CaseStudies() {
  const { lang } = useLang();

  useDocumentTitle(
    lang === 'en' ? 'Case Studies — Vision Affichage' : 'Études de cas — Vision Affichage',
    lang === 'en'
      ? 'Real Quebec teams, real results — construction, landscaping, corporate, and municipal case studies from Vision Affichage.'
      : "Vraies équipes du Québec, vrais résultats — études de cas en construction, paysagement, corporatif et municipal chez Vision Affichage.",
  );

  return (
    <div className="min-h-screen bg-va-bg-1 flex flex-col">
      <Navbar />

      <main id="main-content" className="flex-1">
        {/* Hero strip — tall, generous whitespace, display headline. */}
        <section className="bg-va-bg-1 py-24 md:py-36 px-6 md:px-10">
          <div className="max-w-[1160px] mx-auto">
            <div className="text-va-muted text-xs uppercase tracking-[0.15em] font-semibold mb-4">
              {lang === 'en' ? 'Case Studies' : 'Études de cas'}
            </div>
            <h1 className="font-display font-black text-va-ink text-5xl md:text-7xl tracking-[-0.03em] leading-[1.0]">
              {lang === 'en'
                ? 'How they dress their crews.'
                : 'Comment ils habillent leurs équipes.'}
            </h1>
          </div>
        </section>

        {/* Stats row — three mono numerals on the bone backdrop. */}
        <section className="bg-va-bg-2 py-12 border-y border-va-line px-6 md:px-10">
          <div className="max-w-[1160px] mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="font-mono font-bold text-3xl text-va-blue">33 000+</div>
              <div className="text-va-muted text-sm uppercase tracking-wider mt-2">
                {lang === 'en' ? 'pieces shipped' : 'pièces livrées'}
              </div>
            </div>
            <div>
              <div className="font-mono font-bold text-3xl text-va-blue">500+</div>
              <div className="text-va-muted text-sm uppercase tracking-wider mt-2">
                {lang === 'en' ? 'companies' : 'entreprises'}
              </div>
            </div>
            <div>
              <div className="font-mono font-bold text-3xl text-va-blue">5 / 5</div>
              <div className="text-va-muted text-sm uppercase tracking-wider mt-2">
                {lang === 'en' ? 'Google rating' : 'étoiles Google'}
              </div>
            </div>
          </div>
        </section>

        {/* Case cards grid — 3 up on desktop, white cards with arrow CTA. */}
        <section className="bg-va-bg-1 py-24 px-6 md:px-10">
          <div className="max-w-[1160px] mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {CASE_STUDIES.map(cs => (
              <Link
                key={cs.slug}
                to={`/histoires-de-succes/${cs.slug}`}
                aria-labelledby={`cs-title-${cs.slug}`}
                className="group flex flex-col bg-white border border-va-line rounded-2xl overflow-hidden hover:shadow-[0_24px_60px_rgba(0,0,0,0.08)] hover:-translate-y-1.5 transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-va-blue focus-visible:ring-offset-2"
              >
                <CardHero
                  cs={cs}
                  alt={
                    lang === 'en'
                      ? `${cs.companyName} — ${cs.industry} team in ${cs.location}`
                      : `${cs.companyName} — équipe ${cs.industry} à ${cs.location}`
                  }
                />
                <div className="p-6 flex flex-col flex-1">
                  <span className="self-start bg-va-blue-l text-va-blue text-xs font-semibold rounded-full px-3 py-1">
                    {cs.industry}
                  </span>
                  <h2
                    id={`cs-title-${cs.slug}`}
                    className="font-display font-bold text-xl text-va-ink mt-3"
                  >
                    {cs.companyName}
                  </h2>
                  <p className="text-va-muted text-sm leading-relaxed mt-2 line-clamp-3">
                    {cs.challenge}
                  </p>
                  <span className="inline-flex items-center gap-1 text-va-blue text-sm font-semibold mt-4 group-hover:gap-2 transition-all">
                    {lang === 'en' ? 'Read the study' : "Voir l'étude"}
                    <span aria-hidden="true">→</span>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Closing strip — black field, big headline, glowing primary CTA. */}
        <section className="bg-va-black text-white py-24 text-center px-6 md:px-10">
          <div className="max-w-[860px] mx-auto">
            <h2 className="font-display font-black text-3xl md:text-5xl tracking-tight">
              {lang === 'en'
                ? 'Is your company next?'
                : 'Ton entreprise est la prochaine ?'}
            </h2>
            <div className="mt-10">
              <Link
                to="/products"
                className="inline-flex items-center gap-2 bg-va-blue px-10 py-5 rounded-xl text-lg font-semibold text-white shadow-[0_0_40px_rgba(0,82,204,0.4)] hover:bg-va-blue-h transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-va-black"
              >
                {lang === 'en' ? 'Order now →' : 'Commander maintenant →'}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
