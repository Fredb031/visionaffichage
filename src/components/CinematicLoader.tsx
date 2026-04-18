import { useEffect, useReducer } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLang } from '@/lib/langContext';

type Phase = 'grid' | 'logo' | 'tagline' | 'exit' | 'done';

const SEQUENCE: Array<{ phase: Phase; after: number }> = [
  { phase: 'logo', after: 420 },
  { phase: 'tagline', after: 900 },
  { phase: 'exit', after: 2250 },
  { phase: 'done', after: 2950 },
];

export function CinematicLoader({ onComplete }: { onComplete: () => void }) {
  const [phase, next] = useReducer<(s: Phase) => Phase>((s) => {
    const i = SEQUENCE.findIndex(x => x.phase === s);
    return i === -1 ? SEQUENCE[0].phase : SEQUENCE[Math.min(i + 1, SEQUENCE.length - 1)].phase;
  }, 'grid');

  const { lang } = useLang();

  useEffect(() => {
    const timers = SEQUENCE.map(({ after }, i) =>
      setTimeout(() => {
        next();
        if (i === SEQUENCE.length - 1) onComplete();
      }, after),
    );
    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  const tagline = lang === 'en' ? 'Premium merch. Delivered in 5 business days.' : 'Merch premium. Livré en 5 jours ouvrables.';

  return (
    <AnimatePresence>
      {phase !== 'done' && (
        <motion.div
          key="loader"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, filter: 'blur(8px)', scale: 1.02 }}
          transition={{ duration: 0.7, ease: [0.76, 0, 0.24, 1] }}
          className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
          style={{
            background:
              'radial-gradient(ellipse at 30% 20%, #1B3A6B 0%, #0F2341 45%, #081528 100%)',
          }}
          aria-hidden={phase === 'exit'}
        >
          <div
            className="absolute inset-0 opacity-[0.14] pointer-events-none"
            style={{
              backgroundImage:
                'linear-gradient(#ffffff1a 1px, transparent 1px), linear-gradient(90deg, #ffffff1a 1px, transparent 1px)',
              backgroundSize: '44px 44px',
              maskImage: 'radial-gradient(circle at 50% 50%, black 20%, transparent 70%)',
              WebkitMaskImage: 'radial-gradient(circle at 50% 50%, black 20%, transparent 70%)',
            }}
          />

          <motion.div
            className="absolute w-[720px] h-[720px] rounded-full pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(232,168,56,0.16) 0%, transparent 65%)',
            }}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
          />

          <motion.div
            className="absolute w-px"
            style={{
              background: 'linear-gradient(180deg, transparent, rgba(232,168,56,0.5), transparent)',
              top: '20%',
              bottom: '20%',
              left: '50%',
            }}
            initial={{ scaleY: 0, opacity: 0 }}
            animate={{ scaleY: 1, opacity: phase === 'exit' ? 0 : 1 }}
            transition={{ duration: 1.1, delay: 0.1, ease: [0.4, 0, 0.2, 1] }}
          />

          <div className="relative z-10 flex flex-col items-center">
            <motion.img
              src="https://visionaffichage.com/cdn/shop/files/Logo-vision-horizontal-blanc.png?height=135&v=1694121209"
              alt="Vision Affichage"
              className="h-10 md:h-12"
              initial={{ opacity: 0, y: 24, letterSpacing: '0.18em' }}
              animate={{
                opacity: phase === 'grid' ? 0 : 1,
                y: phase === 'grid' ? 24 : 0,
                letterSpacing: '0em',
              }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            />

            <motion.div
              className="h-[1.5px] mt-5 rounded-full"
              style={{
                background:
                  'linear-gradient(90deg, transparent, hsl(40, 82%, 55%), transparent)',
              }}
              initial={{ width: 0, opacity: 0 }}
              animate={{
                width: phase === 'grid' ? 0 : 160,
                opacity: phase === 'grid' ? 0 : 1,
              }}
              transition={{ duration: 0.8, delay: 0.35, ease: [0.4, 0, 0.2, 1] }}
            />

            <motion.p
              className="mt-6 text-white/80 text-[13px] md:text-[14px] font-medium tracking-[0.12em] uppercase text-center px-6"
              initial={{ opacity: 0, y: 10 }}
              animate={{
                opacity: phase === 'tagline' || phase === 'exit' ? 1 : 0,
                y: phase === 'tagline' || phase === 'exit' ? 0 : 10,
              }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            >
              {tagline}
            </motion.p>

            <motion.div
              className="mt-8 flex gap-1.5"
              initial={{ opacity: 0 }}
              animate={{ opacity: phase === 'tagline' || phase === 'exit' ? 1 : 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              {[0, 1, 2].map(i => (
                <motion.span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-white/60"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.1, delay: i * 0.18, repeat: Infinity, ease: 'easeInOut' }}
                />
              ))}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
