import { useRef } from 'react';
import { Zap, MapPin, ShieldCheck, Users } from 'lucide-react';
import { useReducedMotion } from 'framer-motion';
import { useLang } from '@/lib/langContext';
import { useCountUp } from '@/hooks/useCountUp';
import { useInView } from '@/hooks/useInView';

const ICON_COLOR = '#0052CC';

export function TrustSignalsBar() {
  const { lang } = useLang();

  // Animate "500+ companies" tile when the bar scrolls into view —
  // mirrors the same effect on the hero trust line so a returning
  // visitor sees consistent motion language across surfaces. The other
  // three tiles aren't animated: "5 business days" is below the
  // ANIMATION_MIN threshold (counting 0→5 looks staccato), and "Made in
  // Québec" / "1-year guarantee" aren't pure integer counters.
  const reduceMotion = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(sectionRef, { threshold: 0.5 });
  const companiesCount = useCountUp(500, inView, reduceMotion ? 0 : 1500);

  const companiesTitle =
    lang === 'en'
      ? `${companiesCount.toLocaleString('en-CA')}+ companies`
      : `${companiesCount.toLocaleString('fr-CA')}+ entreprises`;

  const signals = [
    {
      icon: Zap,
      title: lang === 'en' ? '5 business days' : '5 jours ouvrables',
      sub: lang === 'en' ? 'Proof to doorstep, no rush fee' : 'Épreuve à porte, sans frais de rush',
    },
    {
      icon: MapPin,
      title: lang === 'en' ? 'Printed in Québec' : 'Imprimé au Québec',
      sub: lang === 'en' ? 'OEKO-TEX® certified inks' : 'Encres certifiées OEKO-TEX®',
    },
    {
      icon: ShieldCheck,
      title: lang === 'en' ? '1-year remake guarantee' : 'Garantie 1 an refaite',
      sub: lang === 'en' ? 'We misprint, we redo it free' : 'Mauvais résultat, on refait sans frais',
    },
    {
      icon: Users,
      title: companiesTitle,
      sub: lang === 'en' ? '5/5 on Google · since 2021' : '5/5 sur Google · depuis 2021',
    },
  ];

  return (
    <section
      ref={sectionRef}
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
