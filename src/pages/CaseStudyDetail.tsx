import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Users, Package, Clock } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { SiteFooter } from '@/components/SiteFooter';
import { useLang } from '@/lib/langContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { CASE_STUDIES } from '@/data/caseStudies';

/**
 * Volume II Section 14.1 — /histoires-de-succes/:slug detail page.
 * Layout per the brief:
 *  - Hero band: company name + industry, with hero image to the side
 *    (image falls back to a brand-navy gradient div on error).
 *  - 3-column stats row: team size, order size, delivery time.
 *  - Challenge / Solution / Result narrative.
 *  - Large italic blue-left-border quote.
 *  - Products-used cards linking to /product/:handle.
 *  - "Tu veux le même résultat?" CTA → /products.
 *
 * If the slug doesn't match a known case study we render a polite
 * "non trouvée" stub with a link back to the hub — matches the
 * BlogPost pattern of staying inside the chrome instead of throwing.
 */

// Hero image with onError fallback to a brand-navy gradient. Same
// pattern as the hub card so the visual treatment stays consistent
// when real photos haven't been dropped yet.
function HeroImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div
        aria-hidden="true"
        className="w-full h-full rounded-[22px] bg-gradient-to-br from-[#0f2341] via-[#0052CC] to-[#0f2341]"
      />
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      width={900}
      height={600}
      loading="eager"
      decoding="async"
      className="w-full h-full rounded-[22px] aspect-[3/2] object-cover"
      onError={() => setFailed(true)}
    />
  );
}

export default function CaseStudyDetail() {
  const { lang } = useLang();
  const { slug = '' } = useParams<{ slug: string }>();
  const cs = CASE_STUDIES.find(c => c.slug === slug);

  useDocumentTitle(
    cs
      ? lang === 'en'
        ? `${cs.companyName} — case study — Vision Affichage`
        : `${cs.companyName} — étude de cas — Vision Affichage`
      : lang === 'en'
        ? 'Case study not found — Vision Affichage'
        : 'Étude de cas introuvable — Vision Affichage',
    cs
      ? lang === 'en'
        ? `How Vision Affichage helped ${cs.companyName} (${cs.industry}, ${cs.location}) — challenge, solution, and measurable result.`
        : `Comment Vision Affichage a aidé ${cs.companyName} (${cs.industry}, ${cs.location}) — défi, solution et résultat mesurable.`
      : lang === 'en'
        ? "We couldn't find that success story — browse the full hub."
        : "Cette histoire de succès est introuvable — consulte le carrefour complet.",
  );

  if (!cs) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main id="main-content" className="flex-1 px-6 md:px-10 py-20">
          <div className="max-w-[720px] mx-auto text-center">
            <h1 className="text-[clamp(24px,3vw,34px)] font-extrabold text-foreground mb-3">
              {lang === 'en' ? 'Case study not found' : 'Étude de cas introuvable'}
            </h1>
            <p className="text-[14px] text-muted-foreground mb-8">
              {lang === 'en'
                ? "We couldn't find that success story. Browse the full hub instead."
                : "Cette histoire est introuvable. Consulte le carrefour complet à la place."}
            </p>
            <Link
              to="/histoires-de-succes"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-primary-foreground font-bold text-[14px] hover:brightness-[1.05] transition"
            >
              <ArrowLeft size={14} aria-hidden="true" />
              {lang === 'en' ? 'All success stories' : 'Toutes les histoires'}
            </Link>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  // Stats row — three tiles with brand iconography. Numbers are read
  // from the typed CaseStudy entry so updating the dataset cascades
  // through the page without touching JSX.
  const stats = [
    {
      icon: Users,
      label: lang === 'en' ? 'Team size' : 'Taille de l\u2019équipe',
      value: cs.teamSize,
    },
    {
      icon: Package,
      label: lang === 'en' ? 'Order size' : 'Volume commandé',
      value: cs.orderSize,
    },
    {
      icon: Clock,
      label: lang === 'en' ? 'Delivery time' : 'Délai de livraison',
      value: lang === 'en'
        ? `${cs.deliveryDays} business days`
        : `${cs.deliveryDays} jours ouvrables`,
    },
  ] as const;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main id="main-content" className="flex-1">
        {/* Back link — small affordance up top so the visitor can
            return to the hub without hitting browser-back. */}
        <div className="max-w-[1160px] mx-auto px-6 md:px-10 pt-8">
          <Link
            to="/histoires-de-succes"
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            {lang === 'en' ? 'All success stories' : 'Toutes les histoires'}
          </Link>
        </div>

        {/* Hero — name + industry on the left, image on the right.
            Stacks on mobile so the headline lands above the photo. */}
        <section className="py-10 md:py-14 px-6 md:px-10">
          <div className="max-w-[1160px] mx-auto grid md:grid-cols-2 gap-10 md:gap-14 items-center">
            <div>
              <div className="text-[11px] font-bold tracking-[2.5px] uppercase text-primary mb-3">
                {cs.industry} · {cs.location}
              </div>
              <h1 className="text-[clamp(28px,3.6vw,46px)] font-extrabold tracking-[-0.6px] text-foreground leading-[1.1] mb-4">
                {cs.companyName}
              </h1>
              <p className="text-[15px] text-muted-foreground leading-relaxed">
                {cs.challenge}
              </p>
            </div>
            <div>
              <HeroImage
                src={cs.heroImage}
                alt={lang === 'en' ? `${cs.companyName} team in Vision Affichage gear` : `Équipe de ${cs.companyName} en vêtements Vision Affichage`}
              />
            </div>
          </div>
        </section>

        {/* 3-column stats row — keystone numbers above the narrative. */}
        <section className="border-y border-border bg-secondary">
          <div className="max-w-[1160px] mx-auto grid grid-cols-1 md:grid-cols-3">
            {stats.map((s, i) => {
              const Icon = s.icon;
              return (
                <div
                  key={i}
                  className="py-8 px-6 text-center md:border-r border-border last:border-r-0"
                >
                  <div className="mx-auto mb-3 w-12 h-12 rounded-xl bg-primary/[0.08] flex items-center justify-center">
                    <Icon className="text-primary" size={22} strokeWidth={1.75} aria-hidden="true" />
                  </div>
                  <div className="text-[11px] font-extrabold tracking-[2.5px] uppercase text-muted-foreground mb-1.5">
                    {s.label}
                  </div>
                  <div className="text-[18px] md:text-[20px] font-extrabold text-foreground tracking-[-0.3px]">
                    {s.value}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Narrative — Challenge / Solution / Result. Stacked, with
            the result block accented in gold to match the brand
            keystone treatment used on the homepage. */}
        <section className="py-14 md:py-20 px-6 md:px-10">
          <div className="max-w-[860px] mx-auto space-y-10">
            <div>
              <div className="text-[11px] font-bold tracking-[2.5px] uppercase text-muted-foreground mb-2">
                {lang === 'en' ? 'Challenge' : 'Défi'}
              </div>
              <h2 className="sr-only">{lang === 'en' ? 'Challenge' : 'Défi'}</h2>
              <p className="text-[16px] leading-[1.75] text-foreground/90">
                {cs.challenge}
              </p>
            </div>
            <div>
              <div className="text-[11px] font-bold tracking-[2.5px] uppercase text-muted-foreground mb-2">
                {lang === 'en' ? 'Solution' : 'Solution'}
              </div>
              <h2 className="sr-only">{lang === 'en' ? 'Solution' : 'Solution'}</h2>
              <p className="text-[16px] leading-[1.75] text-foreground/90">
                {cs.solution}
              </p>
            </div>
            <div>
              <div className="text-[11px] font-bold tracking-[2.5px] uppercase text-[#E8A838] mb-2">
                {lang === 'en' ? 'Result' : 'Résultat'}
              </div>
              <h2 className="sr-only">{lang === 'en' ? 'Result' : 'Résultat'}</h2>
              <p className="text-[17px] leading-[1.7] font-bold text-foreground tracking-[-0.2px]">
                {cs.result}
              </p>
            </div>

            {/* Big italic quote with brand-blue left border. */}
            <blockquote className="border-l-[4px] border-[#0052CC] pl-5 md:pl-7 py-2">
              <p className="font-lora text-[20px] md:text-[24px] italic text-foreground leading-[1.5] tracking-[-0.2px]">
                « {cs.quote} »
              </p>
              <footer className="mt-4 text-[13px] text-muted-foreground not-italic">
                — {cs.quotePerson}
              </footer>
            </blockquote>
          </div>
        </section>

        {/* Products used — small cards linking to /product/<handle>.
            Handles are the data file's productsUsed strings; if the
            operator ships a real Shopify handle the link resolves;
            otherwise the PDP renders a not-found state and we keep
            the wiring honest. */}
        <section className="border-t border-border py-14 md:py-16 px-6 md:px-10 bg-background">
          <div className="max-w-[1160px] mx-auto">
            <div className="text-[11px] font-bold tracking-[2.5px] uppercase text-primary mb-2.5">
              {lang === 'en' ? 'Products used' : 'Produits utilisés'}
            </div>
            <h2 className="text-[clamp(22px,2.4vw,30px)] font-extrabold tracking-[-0.4px] text-foreground mb-7">
              {lang === 'en'
                ? 'The exact gear in this story'
                : 'Le matériel exact de cette histoire'}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              {cs.productsUsed.map(handle => (
                <Link
                  key={handle}
                  to={`/product/${handle}`}
                  className="group flex flex-col bg-secondary border border-border rounded-xl p-4 transition-all hover:-translate-y-[2px] hover:shadow-[0_8px_20px_rgba(15,35,65,0.08)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  <div className="aspect-square rounded-lg bg-gradient-to-br from-[#0f2341]/[0.08] to-[#0052CC]/[0.08] mb-3" aria-hidden="true" />
                  <div className="text-[13px] font-bold text-foreground tracking-[-0.2px] capitalize mb-1">
                    {handle.replace(/-/g, ' ')}
                  </div>
                  <span className="mt-auto inline-flex items-center gap-1 text-[12px] font-semibold text-primary group-hover:text-[#E8A838] transition-colors">
                    {lang === 'en' ? 'View product' : 'Voir le produit'}
                    <ArrowRight size={12} aria-hidden="true" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Tail CTA — same pattern as the hub but framed as a direct
            invitation: same result, same playbook, start now. */}
        <section className="bg-secondary border-t border-border py-16 md:py-20 px-6 md:px-10">
          <div className="max-w-[860px] mx-auto text-center">
            <h2 className="text-[clamp(24px,2.8vw,34px)] font-extrabold tracking-[-0.5px] text-foreground mb-3">
              {lang === 'en'
                ? 'Want the same result? Start now'
                : 'Tu veux le même résultat\u00A0? Commence maintenant'}
            </h2>
            <p className="text-[14px] text-muted-foreground leading-relaxed mb-6 max-w-[560px] mx-auto">
              {lang === 'en'
                ? 'Pick your products, drop your logo, approve the digital proof — your story is the next one we ship.'
                : "Choisis tes produits, dépose ton logo, approuve l'épreuve numérique — ton histoire sera la prochaine qu'on livre."}
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
