import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Briefcase, Clock, Package, UserCircle2 } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { SiteFooter } from '@/components/SiteFooter';
import { useLang } from '@/lib/langContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

// Task 10.4 — public vendor profile. A vendor needs a shareable URL to
// hand to prospects on LinkedIn / email signatures / business cards.
// This page is intentionally lightweight: chrome (Navbar/Footer), a
// hero card, a bio block, three stat tiles, and a CTA to /contact with
// the vendor id prefilled. No auth — the whole point is that cold
// prospects can open it.
//
// TODO(vendor-profiles): move VENDOR_PROFILES out of this file once the
// backend exposes a vendor_profiles table. The keys here MUST stay in
// sync with SEED_VENDORS in AdminVendors.tsx and the email→id map in
// lib/commissions.ts (resolveVendorIdForUser). The bio copy below is a
// placeholder — the owning vendor supplies the real paragraph.

interface VendorProfile {
  id: string;
  name: string;
  specialtyFr: string;
  specialtyEn: string;
  yearsActive: number;
  ordersDelivered: number;
  avgTurnaroundDaysFr: string;
  avgTurnaroundDaysEn: string;
}

const VENDOR_PROFILES: Record<string, VendorProfile> = {
  '1': {
    id: '1',
    name: 'Sophie Tremblay',
    specialtyFr: 'Spécialiste hoodies & polos',
    specialtyEn: 'Hoodie & polo specialist',
    yearsActive: 6,
    ordersDelivered: 420,
    avgTurnaroundDaysFr: '5 jours',
    avgTurnaroundDaysEn: '5 days',
  },
  '2': {
    id: '2',
    name: 'Marc-André Pelletier',
    specialtyFr: 'Spécialiste broderie & casquettes',
    specialtyEn: 'Embroidery & caps specialist',
    yearsActive: 8,
    ordersDelivered: 310,
    avgTurnaroundDaysFr: '6 jours',
    avgTurnaroundDaysEn: '6 days',
  },
  '3': {
    id: '3',
    name: 'Julie Gagnon',
    specialtyFr: 'Spécialiste t-shirts & événementiel',
    specialtyEn: 'T-shirt & event specialist',
    yearsActive: 4,
    ordersDelivered: 265,
    avgTurnaroundDaysFr: '4 jours',
    avgTurnaroundDaysEn: '4 days',
  },
};

export default function VendorProfile() {
  const { vendorId } = useParams<{ vendorId: string }>();
  const { lang } = useLang();

  const profile = useMemo<VendorProfile | null>(
    () => (vendorId && VENDOR_PROFILES[vendorId]) ? VENDOR_PROFILES[vendorId] : null,
    [vendorId],
  );

  useDocumentTitle(
    profile
      ? (lang === 'en'
        ? `${profile.name} — Vision Affichage`
        : `${profile.name} — Vision Affichage`)
      : (lang === 'en'
        ? 'Vendor profile — Vision Affichage'
        : 'Profil vendeur — Vision Affichage'),
    profile
      ? (lang === 'en'
        ? `${profile.name}, ${profile.specialtyEn} at Vision Affichage. Request a quote directly.`
        : `${profile.name}, ${profile.specialtyFr} chez Vision Affichage. Demandez une soumission directement.`)
      : undefined,
    {},
  );

  // Fallback UI when the vendor id isn't in the seed map. We don't 404
  // because the URL is designed to be handed out by vendors — a soft
  // landing with a "Contact us" CTA is friendlier than a hard 404.
  if (!profile) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col">
        <Navbar />
        <main
          id="main-content"
          className="flex-1 max-w-[800px] w-full mx-auto px-6 md:px-10 py-12 md:py-16"
        >
          <section className="bg-white rounded-2xl border border-zinc-200 p-8 md:p-10 shadow-sm text-center">
            <h1 className="text-2xl md:text-3xl font-extrabold text-brand-black tracking-[-0.5px] mb-3">
              {lang === 'en' ? 'Vendor not found' : 'Vendeur introuvable'}
            </h1>
            <p className="text-sm md:text-base text-zinc-600 mb-6">
              {lang === 'en'
                ? 'We could not find this vendor profile. They may have changed teams.'
                : 'Impossible de trouver ce profil vendeur. La personne a peut-être changé d\u2019équipe.'}
            </p>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-blue text-brand-white font-extrabold text-sm hover:bg-brand-blue-hover transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/50 focus-visible:ring-offset-2"
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

  const specialty = lang === 'en' ? profile.specialtyEn : profile.specialtyFr;
  const turnaround = lang === 'en' ? profile.avgTurnaroundDaysEn : profile.avgTurnaroundDaysFr;

  const stats = [
    {
      icon: Briefcase,
      value: String(profile.yearsActive),
      labelFr: 'Années d\u2019expérience',
      labelEn: 'Years active',
    },
    {
      icon: Package,
      value: `${profile.ordersDelivered}+`,
      labelFr: 'Commandes livrées',
      labelEn: 'Orders delivered',
    },
    {
      icon: Clock,
      value: turnaround,
      labelFr: 'Délai moyen',
      labelEn: 'Avg turnaround',
    },
  ] as const;

  // Initials for the avatar — first letter of given + family name. Kept
  // synchronous (no image fetch) so the hero has no layout shift.
  const initials = profile.name
    .split(/\s+/)
    .map(p => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      <Navbar />
      <main
        id="main-content"
        className="flex-1 max-w-[800px] w-full mx-auto px-6 md:px-10 py-12 md:py-16"
      >
        {/* Hero — avatar + name + specialty eyebrow. Mirrors the
            About-page hero rhythm (eyebrow blue, H1 black, short lede
            below) so returning buyers recognize the brand surface. */}
        <section className="mb-10 md:mb-12">
          <div className="flex items-start gap-5 flex-wrap">
            <div
              aria-hidden="true"
              className="flex-shrink-0 w-20 h-20 md:w-24 md:h-24 rounded-full bg-brand-black text-brand-blue flex items-center justify-center text-2xl md:text-3xl font-extrabold tracking-tight shadow-sm"
            >
              {initials || <UserCircle2 size={36} aria-hidden="true" />}
            </div>
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[2px] text-brand-blue mb-2">
                <Briefcase size={12} aria-hidden="true" className="-mt-px" />
                <span>{specialty}</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-extrabold text-brand-black tracking-[-0.8px] mb-2">
                {profile.name}
              </h1>
              <p className="text-sm md:text-base text-zinc-600">
                {lang === 'en'
                  ? 'Vendor at Vision Affichage — Saint-Hyacinthe, Québec.'
                  : 'Vendeuse/vendeur chez Vision Affichage — Saint-Hyacinthe, Québec.'}
              </p>
            </div>
          </div>
        </section>

        {/* Bio block — placeholder bilingual copy. TODO(bio): replace
            once the vendor supplies a real paragraph. Keep the 2-3
            paragraph rhythm so the page height stays consistent. */}
        {/* TODO(bio): swap placeholder narrative for vendor-supplied
            copy. Do not invent biographical facts about the real person
            — the shop owner collects this offline. */}
        <section
          aria-labelledby="vendor-bio"
          className="bg-white rounded-2xl border border-zinc-200 p-6 md:p-8 shadow-sm mb-10"
        >
          <h2
            id="vendor-bio"
            className="text-xl md:text-2xl font-extrabold text-brand-black tracking-[-0.5px] mb-4"
          >
            {lang === 'en' ? 'About' : 'À propos'}
          </h2>
          <div className="space-y-4 text-[15px] leading-relaxed text-zinc-700">
            <p>
              {lang === 'en'
                ? 'Placeholder bio — this paragraph will be replaced with the vendor\u2019s own words. Expect a short intro covering background, how they got into print & embroidery, and what kind of projects they enjoy most.'
                : 'Biographie provisoire — ce paragraphe sera remplacé par les mots du vendeur. Attendez-vous à une courte présentation couvrant le parcours, le chemin vers l\u2019impression et la broderie, et les types de projets préférés.'}
            </p>
            <p>
              {lang === 'en'
                ? 'Placeholder continued — typical clients, favorite product categories, and the kind of rush jobs they\u2019re happy to take on will land here. For now, the stats panel below gives a factual snapshot while the real bio is being collected.'
                : 'Suite provisoire — la clientèle habituelle, les catégories de produits préférées et les commandes urgentes acceptées viendront ici. D\u2019ici là, les statistiques ci-dessous offrent un portrait factuel pendant que la vraie biographie est recueillie.'}
            </p>
          </div>
        </section>

        {/* Stats — factual numbers the vendor can vouch for even while
            the bio is still placeholder copy. Grid collapses to a
            single column under sm: so the tiles stack cleanly on
            phones. */}
        <section aria-labelledby="vendor-stats" className="mb-10">
          <h2
            id="vendor-stats"
            className="text-xl md:text-2xl font-extrabold text-brand-black tracking-[-0.5px] mb-5"
          >
            {lang === 'en' ? 'By the numbers' : 'En chiffres'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {stats.map(s => {
              const Icon = s.icon;
              return (
                <div
                  key={s.labelEn}
                  className="bg-brand-black text-brand-white rounded-2xl p-6 shadow-sm text-center"
                >
                  <div className="flex justify-center mb-2 text-brand-blue">
                    <Icon size={20} aria-hidden="true" />
                  </div>
                  <div className="text-3xl md:text-4xl font-extrabold tracking-[-0.5px] text-brand-blue">
                    {s.value}
                  </div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-brand-white/70 mt-2">
                    {lang === 'en' ? s.labelEn : s.labelFr}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* CTA — passes ?vendor=<id> through to /contact so the shop
            knows which salesperson to credit when the prospect fills
            the form. */}
        <section
          aria-label={lang === 'en' ? 'Request a quote' : 'Demander une soumission'}
          className="bg-brand-grey-light border border-brand-grey-border rounded-2xl p-8 md:p-10 text-center"
        >
          <h2 className="text-2xl md:text-3xl font-extrabold text-brand-black tracking-[-0.5px] mb-2">
            {lang === 'en' ? 'Work directly with ' : 'Travailler directement avec '}{profile.name.split(' ')[0]}
          </h2>
          <p className="text-sm md:text-base text-zinc-700 mb-6 max-w-[540px] mx-auto">
            {lang === 'en'
              ? 'Send your project details and they\u2019ll follow up with a free quote within one business day.'
              : 'Envoyez les détails de votre projet et vous recevrez une soumission gratuite sous un jour ouvrable.'}
          </p>
          <Link
            to={`/contact?vendor=${encodeURIComponent(profile.id)}`}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-blue text-brand-white font-extrabold text-sm hover:bg-brand-blue-hover transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/50 focus-visible:ring-offset-2"
          >
            {lang === 'en' ? 'Request a quote' : 'Demander une soumission'}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
