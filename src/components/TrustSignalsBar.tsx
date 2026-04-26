import { Zap, MapPin, ShieldCheck, Users } from 'lucide-react';
import { useLang } from '@/lib/langContext';

const ICON_COLOR = '#0052CC';

export function TrustSignalsBar() {
  const { lang } = useLang();

  const signals = [
    {
      icon: Zap,
      title: lang === 'en' ? '5 business days' : '5 jours ouvrables',
      sub: lang === 'en' ? 'From design to doorstep' : 'De la conception à la livraison',
    },
    {
      icon: MapPin,
      title: lang === 'en' ? 'Made in Québec' : 'Fabriqué au Québec',
      sub: lang === 'en' ? 'Local printing, local quality' : 'Impression locale, qualité locale',
    },
    {
      icon: ShieldCheck,
      title: lang === 'en' ? '1-year guarantee' : 'Garantie 1 an',
      sub: lang === 'en' ? 'Print + fabric covered' : 'Impression + tissu couverts',
    },
    {
      icon: Users,
      title: lang === 'en' ? '500+ companies' : '500+ entreprises',
      sub: lang === 'en' ? 'Trust us since 2021' : 'Nous font confiance depuis 2021',
    },
  ];

  return (
    <section
      className="bg-secondary/60 border-y border-border py-6 px-6 md:px-10"
      aria-label={lang === 'en' ? 'Trust signals' : 'Nos garanties'}
    >
      {/*
        role="list" is intentional: Tailwind's `list-none` applies
        list-style: none, which Safari/VoiceOver interprets as a cue
        to drop the implicit list semantics (the four trust signals
        stop being announced as "list, 4 items"). Re-asserting the
        ARIA role keeps the landmark intact for screen-reader users
        without bringing back the visible bullets.
      */}
      <ul role="list" className="max-w-[1060px] mx-auto grid grid-cols-2 md:grid-cols-4 gap-5 list-none">
        {signals.map((s, i) => {
          const Icon = s.icon;
          return (
            <li
              key={i}
              className="flex items-center gap-3 text-left"
              aria-label={`${s.title} — ${s.sub}`}
            >
              <div className="w-10 h-10 rounded-xl bg-white border border-border flex items-center justify-center flex-shrink-0 shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
                <Icon size={18} color={ICON_COLOR} strokeWidth={2} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-extrabold text-foreground leading-tight" aria-hidden="true">{s.title}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5 leading-tight" aria-hidden="true">{s.sub}</div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
