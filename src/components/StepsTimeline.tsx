import { useEffect, useRef, useState } from 'react';
import { Palette, Printer, Truck, Sparkles } from 'lucide-react';
import { useLang } from '@/lib/langContext';

/**
 * StepsTimeline — the "From idea to doorstep in 5 business days" banner.
 *
 * The bar, the progress colours around each ring, and the ring borders
 * are all animated AMBIENTLY — they move on their own without needing
 * a hover. Nothing pops, nothing scales on mouseover. The colours just
 * drift through the Vision blue → gold → emerald gradient.
 */
export function StepsTimeline() {
  const { lang } = useLang();
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const io = new IntersectionObserver(
      (entries, observer) => entries.forEach(e => {
        if (!e.isIntersecting) return;
        setVisible(true);
        // One-shot reveal — stop observing so the CSS transitions
        // aren't re-kicked on every scroll past. Saves a callback
        // + a render on each scroll frame the timeline crosses.
        observer.unobserve(e.target);
      }),
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
      accent: '#0052CC',
    },
    {
      icon: Printer,
      day: lang === 'en' ? 'Day 3-4' : 'Jour 3-4',
      title: lang === 'en' ? 'Local production' : 'Production locale',
      desc: lang === 'en' ? 'Printed in Québec, inspected for quality' : 'Imprimé au Québec, inspection qualité',
      accent: '#E8A838',
    },
    {
      icon: Truck,
      day: lang === 'en' ? 'Day 5' : 'Jour 5',
      title: lang === 'en' ? 'Delivered to your door' : 'Livré chez toi',
      desc: lang === 'en' ? 'Tracked shipping anywhere in Canada' : 'Livraison suivie partout au Canada',
      accent: '#10B981',
    },
  ];

  return (
    <section
      ref={ref}
      className="py-20 px-6 md:px-10 bg-gradient-to-b from-background to-secondary/40"
      aria-label={lang === 'en' ? 'Delivery timeline' : 'Calendrier de livraison'}
    >
      {/* Keyframes — scoped to this component so the homepage CSS doesn't grow. */}
      <style>{`
        @keyframes va-bar-shift { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }
        @keyframes va-ring-rotate { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes va-halo-breath { 0%,100% { opacity: .08; transform: scale(1.05); } 50% { opacity: .22; transform: scale(1.18); } }
        @media (prefers-reduced-motion: reduce) {
          .va-animate-bar, .va-animate-ring, .va-animate-halo { animation: none !important; }
        }
      `}</style>

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
          {/* Base progress rail — draws in on scroll-into-view, then the
              coloured gradient drifts across it forever. */}
          <div
            className="absolute top-10 left-0 right-0 h-[2px] bg-border overflow-hidden"
            aria-hidden="true"
          >
            <div
              className="va-animate-bar h-full origin-left transition-transform duration-[1800ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
              style={{
                transform: `scaleX(${visible ? 1 : 0})`,
                background: 'linear-gradient(90deg, #0052CC 0%, #E8A838 50%, #10B981 100%)',
                backgroundSize: '200% 100%',
                animation: visible ? 'va-bar-shift 12s linear infinite' : undefined,
              }}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {steps.map((step, i) => {
              const Icon = step.icon;
              const accent = step.accent;
              return (
                <div
                  key={i}
                  className={`text-center transition-all duration-700 ease-out ${
                    visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
                  }`}
                  style={{ transitionDelay: visible ? `${i * 180}ms` : '0ms' }}
                >
                  <div className="relative w-20 h-20 mx-auto mb-5">
                    {/* Breathing halo — subtle ambient pulse (no hover trigger) */}
                    <div
                      className="va-animate-halo absolute inset-0 rounded-full blur-xl"
                      style={{
                        background: accent,
                        animation: `va-halo-breath 6s ease-in-out ${i * 1.5}s infinite`,
                      }}
                      aria-hidden="true"
                    />
                    {/* Conic ring — slowly rotates the brand gradient around
                        each circle so the entire timeline feels alive. */}
                    <div
                      className="va-animate-ring absolute -inset-[3px] rounded-full"
                      style={{
                        background: `conic-gradient(from 0deg, ${accent}, #E8A838, #10B981, #0052CC, ${accent})`,
                        animation: `va-ring-rotate ${14 + i * 2}s linear infinite`,
                        filter: 'blur(0.5px)',
                      }}
                      aria-hidden="true"
                    />
                    <div
                      className="relative w-20 h-20 rounded-full bg-white border-2 flex items-center justify-center"
                      style={{
                        borderColor: accent,
                        boxShadow: `0 8px 24px ${accent}26`,
                      }}
                    >
                      <Icon size={30} strokeWidth={1.75} aria-hidden="true" style={{ color: accent }} />
                    </div>
                    <div
                      className="absolute -top-1.5 -right-1.5 w-7 h-7 rounded-full text-[10px] font-extrabold flex items-center justify-center shadow-md"
                      style={{ background: '#E8A838', color: '#1B3A6B' }}
                      aria-hidden="true"
                    >
                      {i + 1}
                    </div>
                  </div>
                  <div
                    className="text-[10px] font-bold tracking-[2px] uppercase mb-1.5"
                    style={{ color: accent }}
                  >
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
