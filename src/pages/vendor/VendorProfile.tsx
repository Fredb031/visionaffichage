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
// hero card, three stat tiles, and a CTA to /contact with the vendor
// id prefilled. No auth — the whole point is that cold prospects can
// open it.
//
// TODO(vendor-profiles): move VENDOR_PROFILES out of this file once the
// backend exposes a vendor_profiles table. The keys here MUST stay in
// sync with SEED_VENDORS in AdminVendors.tsx and the email→id map in
// lib/commissions.ts (resolveVendorIdForUser).

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
            <h1 className="text-2xl md:text-3xl font-extrabold text-[#0F2341] tracking-[-0.5px] mb-3">
              {lang === 'en' ? 'Vendor not found' : 'Vendeur introuvable'}
            </h1>
            <p className="text-sm md:text-base text-zinc-600 mb-6">
              {lang === 'en'
                ? 'We could not find this vendor profile. They may have changed teams.'
                : 'Impossible de trouver ce profil vendeur. La personne a peut-être changé d\u2019équipe.'}
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
            About-page hero rhythm (eyebrow gold, H1 navy, short lede
            below) so returning buyers recognize the brand surface. */}
        <section className="mb-10 md:mb-12">
          <div className="flex items-start gap-5 flex-wrap">
            <div
              aria-hidden="true"
              className="flex-shrink-0 w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-br from-[#0F2341] via-[#1B3A6B] to-[#0F2341] text-[#E8A838] flex items-center justify-center text-2xl md:text-3xl font-extrabold tracking-tight shadow-sm"
            >
              {initials || <UserCircle2 size={36} aria-hidden="true" />}
            </div>
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[2px] text-[#E8A838] mb-2">
                <Briefcase size={12} aria-hidden="true" className="-mt-px" />
                <span>{specialty}</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-extrabold text-[#0F2341] tracking-[-0.8px] mb-2">
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

        {/* Stats — factual numbers the vendor can vouch for. Grid
            collapses to a single column under sm: so the tiles stack
            cleanly on phones. */}
        <section aria-labelledby="vendor-stats" className="mb-10">
          <h2
            id="vendor-stats"
            className="text-xl md:text-2xl font-extrabold text-[#0F2341] tracking-[-0.5px] mb-5"
          >
            {lang === 'en' ? 'By the numbers' : 'En chiffres'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {stats.map(s => {
              const Icon = s.icon;
              return (
                <div
                  key={s.labelEn}
                  className="bg-gradient-to-br from-[#0F2341] via-[#1B3A6B] to-[#0F2341] text-white rounded-2xl p-6 shadow-sm text-center"
                >
                  <div className="flex justify-center mb-2 text-[#E8A838]">
                    <Icon size={20} aria-hidden="true" />
                  </div>
                  <div className="text-3xl md:text-4xl font-extrabold tracking-[-0.5px] text-[#E8A838]">
                    {s.value}
                  </div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-white/70 mt-2">
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
          className="bg-[#FFF8E7] border border-[#E8A838]/30 rounded-2xl p-8 md:p-10 text-center"
        >
          <h2 className="text-2xl md:text-3xl font-extrabold text-[#0F2341] tracking-[-0.5px] mb-2">
            {lang === 'en' ? 'Work directly with ' : 'Travailler directement avec '}{profile.name.split(' ')[0]}
          </h2>
          <p className="text-sm md:text-base text-zinc-700 mb-6 max-w-[540px] mx-auto">
            {lang === 'en'
              ? 'Send your project details and they\u2019ll follow up with a free quote within one business day.'
              : 'Envoyez les détails de votre projet et vous recevrez une soumission gratuite sous un jour ouvrable.'}
          </p>
          <Link
            to={`/contact?vendor=${encodeURIComponent(profile.id)}`}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#0052CC] text-white font-extrabold text-sm hover:bg-[#0041A6] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC]/50 focus-visible:ring-offset-2"
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
