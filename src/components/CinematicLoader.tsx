import { useEffect, useState } from 'react';

export function CinematicLoader({ onComplete }: { onComplete: () => void }) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setExiting(true), 2200);
    const t2 = setTimeout(onComplete, 3100);
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 bg-black z-[9999] flex items-center justify-center overflow-hidden ${exiting ? 'animate-[ldCurtain_0.9s_cubic-bezier(.7,0,.3,1)_forwards]' : ''}`}
    >
      {/* Grid */}
      <div
        className="absolute inset-0 opacity-0 animate-[ldGridIn_1s_0.3s_ease_forwards]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.03) 1px,transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* Corner markers */}
      {['top-10 left-10 border-t border-l', 'top-10 right-10 border-t border-r', 'bottom-10 left-10 border-b border-l', 'bottom-10 right-10 border-b border-r'].map((cls, i) => (
        <div key={i} className={`absolute w-6 h-6 border-primary-foreground/20 opacity-0 animate-[ldCornerIn_0.5s_1s_ease_forwards] ${cls}`} />
      ))}

      {/* Scan line */}
      <div className="absolute top-[-2px] left-0 right-0 h-[2px] animate-[ldScan_1.8s_0.6s_ease-in-out]" style={{ background: 'linear-gradient(90deg,transparent,hsla(40,82%,40%,0.8),transparent)' }} />

      {/* Center */}
      <div className="relative z-[2] flex flex-col items-center">
        <div className="overflow-hidden h-14 flex items-center">
          <img
            src="https://visionaffichage.com/cdn/shop/files/Logo-vision-horizontal-blanc.png?height=135&v=1694121209"
            alt="Vision"
            className="h-11 opacity-0 animate-[ldLogoUp_0.9s_0.4s_cubic-bezier(.16,1,.3,1)_forwards]"
            style={{ transform: 'translateY(56px)' }}
          />
        </div>
        <div className="h-[1.5px] w-0 mt-3.5 animate-[ldLineDraw_1s_0.9s_cubic-bezier(.4,0,.2,1)_forwards]" style={{ background: 'linear-gradient(90deg,transparent,hsl(var(--gold)),transparent)' }} />
        <div className="text-[10px] font-bold tracking-[4px] uppercase mt-5 animate-[ldTagIn_0.7s_1.2s_ease_forwards]" style={{ color: 'rgba(255,255,255,0)' }}>
          Merch d'entreprise
        </div>
      </div>
    </div>
  );
}
