import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { SiteFooter } from '@/components/SiteFooter';
import { useLang } from '@/lib/langContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { CASE_STUDIES, type CaseStudy } from '@/data/caseStudies';

/**
 * Volume II Section 14 — /histoires-de-succes hub. Lists every entry in
 * CASE_STUDIES as a 3-up card grid (stacked on mobile). Each card shows
 * company name, industry, location, team size, the challenge headline,
 * and a "Read full story" link to /histoires-de-succes/<slug>.
 *
 * Hero images use the /case-studies/<slug>.jpg placeholder path the
 * data file declares; the <img> element falls back to a brand-navy
 * gradient div via onError so the layout doesn't collapse before the
 * operator drops real photos into /public/case-studies/.
 */

// Brand-navy fallback rendered when the placeholder hero image fails
// to load. Keeps the card aspect ratio so the grid stays even, and
// surfaces the company name so the card still communicates clearly.
function CardHero({ cs }: { cs: CaseStudy }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div
        aria-hidden="true"
        className="w-full aspect-[16/10] bg-gradient-to-br from-[#0f2341] via-[#0052CC] to-[#0f2341] flex items-center justify-center px-4"
      >
        <span className="text-primary-foreground/90 text-[15px] font-extrabold tracking-[-0.3px] text-center">
          {cs.companyName}
        </span>
      </div>
    );
  }
  return (
    <img
      src={cs.heroImage}
      alt=""
      width={800}
      height={500}
      loading="lazy"
      decoding="async"
      className="w-full aspect-[16/10] object-cover bg-secondary"
      onError={() => setFailed(true)}
    />
  );
}

export default function CaseStudies() {
  const { lang } = useLang();

  useDocumentTitle(
    lang === 'en' ? 'Success stories — Vision Affichage' : 'Histoires de succès — Vision Affichage',
    lang === 'en'
      ? 'Real Quebec teams, real results — construction, landscaping, corporate, and municipal case studies from Vision Affichage.'
      : "Vraies équipes du Québec, vrais résultats — études de cas en construction, paysagement, corporatif et municipal chez Vision Affichage.",
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main id="main-content" className="flex-1">
        {/* Header band — eyebrow + headline + sub. Mirrors the styling
            of /industries hub for visual consistency. */}
        <section className="border-b border-border py-14 md:py-20 px-6 md:px-10 bg-background">
          <div className="max-w-[1160px] mx-auto text-center">
            <div className="text-[11px] font-bold tracking-[2.5px] uppercase text-primary mb-3">
              {lang === 'en' ? 'Success stories' : 'Histoires de succès'}
            </div>
            <h1 className="text-[clamp(28px,3.6vw,44px)] font-extrabold tracking-[-0.6px] text-foreground leading-tight max-w-[720px] mx-auto">
              {lang === 'en'
                ? 'Real Quebec teams, real results'
                : 'Ils ont fait confiance à Vision Affichage'}
            </h1>
            <p className="text-[15px] text-muted-foreground mt-4 max-w-[640px] mx-auto leading-relaxed">
              {lang === 'en'
                ? 'Four projects, four industries — from a small construction crew to a municipal renewal of 85 uniforms. Same playbook: brief, proof, deliver.'
                : "Quatre projets, quatre industries — d'une petite équipe de construction au renouvellement municipal de 85 uniformes. Même méthode\u00A0: brief, épreuve, livraison."}
            </p>
          </div>
        </section>

        {/* Card grid — 3 up on desktop (the 4th wraps), stacked on
            mobile. Each card pairs a hero image (with fallback) with
            the challenge headline and a CTA into the detail page. */}
        <section className="py-14 md:py-20 px-6 md:px-10">
          <div className="max-w-[1160px] mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {CASE_STUDIES.map(cs => (
                <article
                  key={cs.slug}
                  className="group flex flex-col bg-card border border-border rounded-2xl overflow-hidden transition-all hover:-translate-y-[2px] hover:shadow-[0_16px_40px_rgba(15,35,65,0.10)]"
                >
                  <CardHero cs={cs} />
                  <div className="flex flex-col flex-1 p-6">
                    <div className="text-[11px] font-bold tracking-[1.8px] uppercase text-muted-foreground mb-1.5">
                      {cs.industry} · {cs.location}
                    </div>
                    <h2 className="text-[19px] font-extrabold text-foreground tracking-[-0.3px] mb-3">
                      {cs.companyName}
                    </h2>
                    <div aria-hidden="true" className="h-[2px] w-10 bg-[#E8A838] mb-4" />
                    <p className="text-[14px] leading-relaxed text-foreground/85 mb-5 line-clamp-4">
                      {cs.challenge}
                    </p>
                    <div className="mt-auto flex items-center justify-between gap-3 pt-2 border-t border-border">
                      <span className="text-[12px] text-muted-foreground">
                        {cs.teamSize}
                      </span>
                      <Link
                        to={`/histoires-de-succes/${cs.slug}`}
                        className="inline-flex items-center gap-1.5 text-[13px] font-bold text-primary hover:text-[#E8A838] transition-colors focus:outline-none focus-visible:underline"
                        aria-label={
                          lang === 'en'
                            ? `Read the full story for ${cs.companyName}`
                            : `Lire l'histoire complète de ${cs.companyName}`
                        }
                      >
                        {lang === 'en' ? 'Read full story' : "Lire l'histoire"}
                        <ArrowRight size={14} aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Tail CTA — bridges the hub to the catalog. */}
        <section className="bg-secondary border-t border-border py-14 md:py-16 px-6 md:px-10">
          <div className="max-w-[860px] mx-auto text-center">
            <h2 className="text-[clamp(22px,2.6vw,32px)] font-extrabold tracking-[-0.4px] text-foreground mb-3">
              {lang === 'en'
                ? 'Want the same result?'
                : 'Tu veux le même résultat\u00A0?'}
            </h2>
            <p className="text-[14px] text-muted-foreground leading-relaxed mb-6 max-w-[560px] mx-auto">
              {lang === 'en'
                ? 'Browse the catalog, drop your logo, get a digital proof — production starts the moment you approve.'
                : "Parcours le catalogue, dépose ton logo, reçois une épreuve numérique — la production démarre dès que tu approuves."}
            </p>
            <Link
              to="/products"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-[#E8A838] text-[#0f2341] font-extrabold text-[15px] tracking-[-0.2px] hover:brightness-[1.05] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8A838] focus-visible:ring-offset-2"
            >
              {lang === 'en' ? 'Start now' : 'Commence maintenant'}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
