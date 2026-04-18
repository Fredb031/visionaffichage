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

  // Hovered step index — drives the colour-wipe and scaling animations.
  // null means nothing active; defaults to -1 on mobile where hover
  // doesn't exist so touching a step lights it up briefly.
  const [hovered, setHovered] = useState<number | null>(null);

  const steps = [
    {
      icon: Palette,
      day: lang === 'en' ? 'Day 1-2' : 'Jour 1-2',
      title: lang === 'en' ? 'Design & proofing' : 'Conception & épreuve',
      desc: lang === 'en' ? 'We validate your artwork and send a digital proof' : 'On valide ton logo et t\'envoie une épreuve numérique',
      accent: '#0052CC',    // Vision blue
      tint:   'rgba(0,82,204,0.08)',
      emoji:  '🎨',
    },
    {
      icon: Printer,
      day: lang === 'en' ? 'Day 3-4' : 'Jour 3-4',
      title: lang === 'en' ? 'Local production' : 'Production locale',
      desc: lang === 'en' ? 'Printed in Québec, inspected for quality' : 'Imprimé au Québec, inspection qualité',
      accent: '#E8A838',    // gold
      tint:   'rgba(232,168,56,0.10)',
      emoji:  '🖨️',
    },
    {
      icon: Truck,
      day: lang === 'en' ? 'Day 5' : 'Jour 5',
      title: lang === 'en' ? 'Delivered to your door' : 'Livré chez toi',
      desc: lang === 'en' ? 'Tracked shipping anywhere in Canada' : 'Livraison suivie partout au Canada',
      accent: '#10B981',    // emerald
      tint:   'rgba(16,185,129,0.10)',
      emoji:  '📦',
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
              className="h-full bg-gradient-to-r from-[#0052CC] via-[#E8A838] to-[#10B981] origin-left transition-transform duration-[1800ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
              style={{ transform: `scaleX(${visible ? 1 : 0})` }}
            />
            {/* Extra glow blob that follows the hovered step so the whole
                timeline feels responsive, not just the card that's lit. */}
            {hovered !== null && (
              <div
                className="h-full absolute top-0 w-24 blur-md transition-all duration-500 ease-out"
                style={{
                  background: steps[hovered]?.accent,
                  opacity: 0.6,
                  left: `calc(${(hovered + 0.5) * (100 / steps.length)}% - 3rem)`,
                }}
              />
            )}
          </div>

          <div
            className="grid grid-cols-1 md:grid-cols-3 gap-8 relative"
            onPointerLeave={() => setHovered(null)}
          >
            {steps.map((step, i) => {
              const Icon = step.icon;
              const isActive = hovered === i;
              const accent = step.accent;
              return (
                <button
                  type="button"
                  key={i}
                  onPointerEnter={() => setHovered(i)}
                  onFocus={() => setHovered(i)}
                  onBlur={() => setHovered(null)}
                  onClick={() => setHovered(i)}
                  aria-label={`${step.day} — ${step.title}`}
                  className={`group relative text-center rounded-2xl px-4 py-5 transition-all duration-500 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#0052CC] ${
                    visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
                  } ${isActive ? '-translate-y-1' : ''}`}
                  style={{
                    transitionDelay: visible ? `${i * 180}ms` : '0ms',
                    background: isActive ? step.tint : 'transparent',
                  }}
                >
                  <div className="relative w-20 h-20 mx-auto mb-5">
                    {/* Outer halo pulses brighter on hover with the step's accent colour. */}
                    <div
                      className="absolute inset-0 rounded-full blur-xl transition-all duration-500"
                      style={{
                        background: accent,
                        opacity: isActive ? 0.35 : 0.10,
                        transform: isActive ? 'scale(1.3)' : 'scale(1.1)',
                      }}
                      aria-hidden="true"
                    />
                    <div
                      className="relative w-20 h-20 rounded-full bg-white border-2 flex items-center justify-center transition-all duration-500"
                      style={{
                        borderColor: accent,
                        boxShadow: isActive
                          ? `0 14px 38px ${accent}55, inset 0 0 0 4px ${accent}14`
                          : `0 8px 24px ${accent}26`,
                        transform: isActive ? 'scale(1.08)' : 'scale(1)',
                      }}
                    >
                      <Icon
                        size={28}
                        strokeWidth={2}
                        aria-hidden="true"
                        style={{ color: accent }}
                        className="transition-transform duration-500 group-hover:rotate-[-4deg] group-hover:scale-110"
                      />
                    </div>
                    <div
                      className="absolute -top-1.5 -right-1.5 w-7 h-7 rounded-full text-[10px] font-extrabold flex items-center justify-center shadow-md transition-all duration-500"
                      style={{
                        background: isActive ? accent : '#E8A838',
                        color: isActive ? '#FFFFFF' : '#1B3A6B',
                        transform: isActive ? 'scale(1.15)' : 'scale(1)',
                      }}
                    >
                      {i + 1}
                    </div>
                    {/* Tiny floating emoji on hover — playful touch. */}
                    <div
                      className={`absolute -bottom-1 left-1/2 -translate-x-1/2 text-lg pointer-events-none transition-all duration-500 ${
                        isActive ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
                      }`}
                      aria-hidden="true"
                    >
                      {step.emoji}
                    </div>
                  </div>
                  <div
                    className="text-[10px] font-bold tracking-[2px] uppercase mb-1.5 transition-colors duration-500"
                    style={{ color: accent }}
                  >
                    {step.day}
                  </div>
                  <h3 className="text-lg font-extrabold text-foreground mb-1.5">{step.title}</h3>
                  <p className="text-[13px] text-muted-foreground leading-relaxed max-w-[260px] mx-auto">
                    {step.desc}
                  </p>
                  {/* Bottom underline that draws in on hover. */}
                  <div
                    className="absolute bottom-3 left-1/2 -translate-x-1/2 h-[2px] rounded-full transition-all duration-500"
                    style={{
                      background: accent,
                      width: isActive ? '60%' : '0%',
                    }}
                    aria-hidden="true"
                  />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
