import { Link } from 'react-router-dom';
import { Award, MapPin, HeartHandshake, ArrowRight } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { SiteFooter } from '@/components/SiteFooter';
import { useLang } from '@/lib/langContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

// Task 11.9 — /about surface. A buyer vetting the brand before a
// custom order needs a story page; the Shopify catalog alone doesn't
// answer "who am I working with and where are they." Copy is kept
// placeholder-friendly and bilingual so the shop owner can swap in a
// real founder narrative without a devops roundtrip — the TODO below
// marks the exact block to edit.
//
// Max content width is clamped to ~960px so the narrative reads at a
// comfortable measure on ultrawide monitors. Stat tile values match
// the hero strip math (547 clients, 3200+ items, 4.9 rating) so the
// two surfaces can't drift apart silently.

export default function About() {
  const { lang } = useLang();
  // Task 8.12 — /about meta description. Shares the founding story
  // framing (QC printer + merchandiser established in Saint-Hyacinthe)
  // so buyers vetting the brand on Google land on this page instead of
  // /. Bilingual copy tracks the language toggle.
  useDocumentTitle(
    lang === 'en' ? 'About — Vision Affichage' : 'À propos — Vision Affichage',
    lang === 'en'
      ? 'The Vision Affichage story — printer and merchandiser established in Saint-Hyacinthe, Québec.'
      : 'L\u2019histoire de Vision Affichage — imprimeur et marchandiseur établi à Saint-Hyacinthe, Québec.',
    // Task 8.5 — OG overrides; /about uses the default branded image.
    {},
  );

  // Value cards — icons picked to echo Contact.tsx's iconography style
  // (Award for craft quality, MapPin for locality, HeartHandshake for
  // service). Rendered from data so ordering/swapping stays a one-line
  // change instead of a JSX rewrite.
  const values = [
    {
      icon: Award,
      titleFr: 'Qualité',
      titleEn: 'Quality',
      bodyFr:
        'Impression et broderie vérifiées à la main avant chaque envoi. Pas de lot envoyé sans contrôle visuel.',
      bodyEn:
        'Print and embroidery hand-checked before every shipment. No batch leaves without a visual pass.',
    },
    {
      icon: MapPin,
      titleFr: 'Local',
      titleEn: 'Local',
      bodyFr:
        'Fabriqué à Saint-Hyacinthe, Québec. Les délais courts et le support en français sont le défaut, pas un extra.',
      bodyEn:
        'Made in Saint-Hyacinthe, Québec. Short lead times and French support are the default, not an extra.',
    },
    {
      icon: HeartHandshake,
      titleFr: 'Service',
      titleEn: 'Service',
      bodyFr:
        'Réponse sous 24h en jours ouvrables. Soumissions gratuites, preuve numérique avant production.',
      bodyEn:
        'Reply within 24h on business days. Free quotes, digital proof before production runs.',
    },
  ] as const;

  const stats = [
    {
      value: '547',
      labelFr: 'Clients servis',
      labelEn: 'Clients served',
    },
    {
      value: '3\u202f200+',
      labelFr: 'Articles imprimés',
      labelEn: 'Items printed',
    },
    {
      value: '4,9\u2605',
      labelFr: 'Note moyenne',
      labelEn: 'Average rating',
    },
  ] as const;

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      <Navbar />
      <main
        id="main-content"
        className="flex-1 max-w-[960px] w-full mx-auto px-6 md:px-10 py-12 md:py-16"
      >
        {/* Hero — eyebrow + H1 + short lede. The eyebrow echoes the
            cream/gold brand accents used on the homepage feature
            strips so a returning buyer recognizes the visual
            language instantly. */}
        <section className="mb-14 md:mb-16">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[2px] text-[#E8A838] mb-3">
            <MapPin size={12} aria-hidden="true" className="-mt-px" />
            <span>Saint-Hyacinthe, Québec</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold text-[#0F2341] tracking-[-0.8px] mb-4">
            {lang === 'en' ? 'Our story' : 'Notre histoire'}
          </h1>
          <p className="text-base md:text-lg text-zinc-700 max-w-[680px] leading-relaxed">
            {lang === 'en'
              ? 'Vision Affichage — printer and merchandiser based in Saint-Hyacinthe, Québec, helping small and mid-sized buyers turn an idea into a finished garment without the big-shop runaround.'
              : 'Vision Affichage — imprimeur et marchandiseur de Saint-Hyacinthe, au Québec, qui aide les PME à transformer une idée en vêtement fini, sans le casse-tête des grosses boutiques.'}
          </p>
        </section>

        {/* TODO(about): replace placeholder narrative with real founder
            story + founding year once the shop owner provides copy.
            Keep bilingual pairing and the 2-3 paragraph rhythm. */}
        <section
          aria-labelledby="about-founded"
          className="bg-white rounded-2xl border border-zinc-200 p-6 md:p-10 shadow-sm mb-10"
        >
          <h2
            id="about-founded"
            className="text-2xl md:text-3xl font-extrabold text-[#0F2341] tracking-[-0.5px] mb-4"
          >
            {lang === 'en' ? 'Founded in Québec' : 'Fondé au Québec'}
          </h2>
          <div className="space-y-4 text-[15px] leading-relaxed text-zinc-700 max-w-[720px]">
            <p>
              {lang === 'en'
                ? 'Founded by a passionate team in Saint-Hyacinthe, Vision Affichage was built around one stubborn idea: a small business ordering 20 hoodies deserves the same level of craft as a stadium tour ordering 20,000.'
                : 'Fondée par une équipe passionnée de Saint-Hyacinthe, Vision Affichage repose sur une idée tenace : une PME qui commande 20 chandails mérite le même soin qu\u2019une tournée qui en commande 20 000.'}
            </p>
            <p>
              {lang === 'en'
                ? 'We run small-batch print and embroidery in-house, which means a designer can walk in with a sketch on a Monday and leave with a printed sample on a Wednesday. No offshoring, no week-long proofing queues, no "minimum 500 units" conversations.'
                : 'Nous produisons en petits lots, impression et broderie à l\u2019interne. Un designer peut entrer avec un croquis le lundi et repartir avec un échantillon imprimé le mercredi. Pas de sous-traitance à l\u2019étranger, pas de files d\u2019épreuves d\u2019une semaine, pas de « minimum 500 unités\u00a0».'}
            </p>
            <p>
              {lang === 'en'
                ? 'Most of our orders still come from small and mid-sized Québec buyers: local restaurants, youth sports leagues, trades crews, and one-person brands. That\u2019s the rhythm we built the shop around, and it\u2019s the rhythm we\u2019ve kept.'
                : 'La majorité de nos commandes proviennent encore de PME québécoises\u00a0: restos locaux, ligues sportives jeunesse, équipes de métiers, marques solo. C\u2019est le rythme autour duquel l\u2019atelier a été conçu, et c\u2019est le rythme que nous gardons.'}
            </p>
          </div>
        </section>

        {/* Block 2 — Values. Three cards mirroring the homepage pill
            strip conceptually (Qualité / Local / Service) but with
            body copy space for each. Grid collapses to a single
            column under md: so the cards stack rather than shrink. */}
        <section aria-labelledby="about-values" className="mb-10">
          <h2
            id="about-values"
            className="text-2xl md:text-3xl font-extrabold text-[#0F2341] tracking-[-0.5px] mb-5"
          >
            {lang === 'en' ? 'Our values' : 'Nos valeurs'}
          </h2>
          <div className="grid md:grid-cols-3 gap-4 md:gap-5">
            {values.map(v => {
              const Icon = v.icon;
              return (
                <article
                  key={v.titleEn}
                  className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm flex flex-col"
                >
                  <span
                    aria-hidden="true"
                    className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-[#E8A838]/15 text-[#E8A838] mb-4"
                  >
                    <Icon size={20} />
                  </span>
                  <h3 className="text-lg font-extrabold text-[#0F2341] tracking-[-0.3px] mb-2">
                    {lang === 'en' ? v.titleEn : v.titleFr}
                  </h3>
                  <p className="text-sm text-zinc-600 leading-relaxed">
                    {lang === 'en' ? v.bodyEn : v.bodyFr}
                  </p>
                </article>
              );
            })}
          </div>
        </section>

        {/* Block 3 — By the numbers. Stat tiles reuse the hero-strip
            figures so the two surfaces stay consistent. If those
            numbers ever move, update both call sites at once. */}
        <section aria-labelledby="about-stats" className="mb-12">
          <h2
            id="about-stats"
            className="text-2xl md:text-3xl font-extrabold text-[#0F2341] tracking-[-0.5px] mb-5"
          >
            {lang === 'en' ? 'By the numbers' : 'En chiffres'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {stats.map(s => (
              <div
                key={s.labelEn}
                className="bg-gradient-to-br from-[#0F2341] via-[#1B3A6B] to-[#0F2341] text-white rounded-2xl p-6 md:p-7 shadow-sm text-center"
              >
                <div className="text-3xl md:text-4xl font-extrabold tracking-[-0.5px] text-[#E8A838]">
                  {s.value}
                </div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-white/70 mt-2">
                  {lang === 'en' ? s.labelEn : s.labelFr}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Bottom CTA — sends the narrative toward the action that
            pays the shop: a real conversation. /contact has the
            phone, map, hours and a form fallback so whatever mode
            the buyer prefers, it's one click from here. */}
        <section
          aria-label={lang === 'en' ? 'Work with us' : 'Travailler avec nous'}
          className="bg-[#FFF8E7] border border-[#E8A838]/30 rounded-2xl p-8 md:p-10 text-center"
        >
          <h2 className="text-2xl md:text-3xl font-extrabold text-[#0F2341] tracking-[-0.5px] mb-2">
            {lang === 'en' ? 'Work with us' : 'Travailler avec nous'}
          </h2>
          <p className="text-sm md:text-base text-zinc-700 mb-6 max-w-[540px] mx-auto">
            {lang === 'en'
              ? 'Got an idea, a logo, or a half-baked napkin sketch? Send it over — quotes are free and we reply within 24h.'
              : 'Une idée, un logo ou un croquis sur un coin de napperon\u00a0? Envoyez-le — les soumissions sont gratuites et nous répondons sous 24h.'}
          </p>
          <Link
            to="/contact"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#0052CC] text-white font-extrabold text-sm hover:bg-[#003D99] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC]/50 focus-visible:ring-offset-2"
          >
            {lang === 'en' ? 'Contact us' : 'Nous joindre'}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
