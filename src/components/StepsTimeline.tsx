import { useEffect, useRef, useState } from 'react';
import { Palette, Printer, Truck, Sparkles } from 'lucide-react';
import { useLang } from '@/lib/langContext';

export function StepsTimeline() {
  const { lang } = useLang();
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const io = new IntersectionObserver(
      entries => entries.forEach(e => e.isIntersecting && setVisible(true)),
      { threshold: 0.3 },
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, []);

  const steps = [
    {
      icon: Palette,
      day: lang === 'en' ? 'Day 1-2' : 'Jour 1-2',
      title: lang === 'en' ? 'Design & proofing' : 'Conception & épreuve',
      desc: lang === 'en' ? 'We validate your artwork and send a digital proof' : 'On valide ton logo et t\'envoie une épreuve numérique',
    },
    {
      icon: Printer,
      day: lang === 'en' ? 'Day 3-4' : 'Jour 3-4',
      title: lang === 'en' ? 'Local production' : 'Production locale',
      desc: lang === 'en' ? 'Printed in Québec, inspected for quality' : 'Imprimé au Québec, inspection qualité',
    },
    {
      icon: Truck,
      day: lang === 'en' ? 'Day 5' : 'Jour 5',
      title: lang === 'en' ? 'Delivered to your door' : 'Livré chez toi',
      desc: lang === 'en' ? 'Tracked shipping anywhere in Canada' : 'Livraison suivie partout au Canada',
    },
  ];

  return (
    <section
      ref={ref}
      className="py-20 px-6 md:px-10 bg-gradient-to-b from-background to-secondary/40"
      aria-label={lang === 'en' ? 'Delivery timeline' : 'Calendrier de livraison'}
    >
      <div className="max-w-[1060px] mx-auto">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 text-[11px] font-bold tracking-[2px] uppercase text-[#0052CC] mb-3">
            <Sparkles size={14} aria-hidden="true" />
            {lang === 'en' ? 'How it works' : 'Comment ça marche'}
          </div>
          <h2 className="text-[clamp(28px,4vw,44px)] font-extrabold tracking-[-1px] text-foreground leading-tight">
            {lang === 'en' ? (
              <>
                From idea to doorstep<br />
                <span className="text-[#0052CC]">in just 5 business days.</span>
              </>
            ) : (
              <>
                De l'idée à la livraison<br />
                <span className="text-[#0052CC]">en 5 jours ouvrables.</span>
              </>
            )}
          </h2>
        </div>

        <div className="relative">
          <div
            className="absolute top-10 left-0 right-0 h-[2px] bg-border overflow-hidden"
            aria-hidden="true"
          >
            <div
              className="h-full bg-gradient-to-r from-[#0052CC] via-[#E8A838] to-[#0052CC] origin-left transition-transform duration-[1800ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
              style={{ transform: `scaleX(${visible ? 1 : 0})` }}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <div
                  key={i}
                  className={`text-center transition-all duration-700 ease-out ${
                    visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
                  }`}
                  style={{ transitionDelay: visible ? `${i * 180}ms` : '0ms' }}
                >
                  <div className="relative w-20 h-20 mx-auto mb-5">
                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#0052CC] to-[#1B3A6B] opacity-10 blur-xl scale-110" aria-hidden="true" />
                    <div className="relative w-20 h-20 rounded-full bg-white border-2 border-[#0052CC] flex items-center justify-center shadow-[0_8px_24px_rgba(0,82,204,0.15)]">
                      <Icon size={28} className="text-[#0052CC]" strokeWidth={2} aria-hidden="true" />
                    </div>
                    <div className="absolute -top-1.5 -right-1.5 w-7 h-7 bg-[#E8A838] text-[#1B3A6B] rounded-full text-[10px] font-extrabold flex items-center justify-center shadow-md">
                      {i + 1}
                    </div>
                  </div>
                  <div className="text-[10px] font-bold tracking-[2px] uppercase text-[#0052CC] mb-1.5">
                    {step.day}
                  </div>
                  <h3 className="text-lg font-extrabold text-foreground mb-1.5">{step.title}</h3>
                  <p className="text-[13px] text-muted-foreground leading-relaxed max-w-[260px] mx-auto">
                    {step.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
