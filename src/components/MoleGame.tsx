import { useState, useEffect, useCallback, useRef } from 'react';
import { Share2 } from 'lucide-react';
import { useLang } from '@/lib/langContext';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

const BEST_SCORE_KEY = 'va:mole-game-best';

const readBestScore = (): number => {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = window.localStorage.getItem(BEST_SCORE_KEY);
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
};

const writeBestScore = (n: number): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(BEST_SCORE_KEY, String(n));
  } catch {
    /* storage unavailable — silently ignore */
  }
};

const clearBestScore = (): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(BEST_SCORE_KEY);
  } catch {
    /* storage unavailable — silently ignore */
  }
};

interface MoleGameProps {
  isOpen: boolean;
  onClose: (won: boolean) => void;
}

// Realistic brown mole SVG — no emoji, taste-skill compliant.
// aria-hidden because the clickable button wrapping this SVG owns the
// accessible name ("Whack mole 1/2/3"). Without it, screen readers would
// read the raw <svg> title/graphic content on top of the button label.
const MoleSvg = ({ id }: { id: string }) => (
  <svg className="mole-svg block select-none pointer-events-none" width="86" height="90" viewBox="0 0 86 90" aria-hidden="true" focusable="false">
    <ellipse cx="43" cy="72" rx="31" ry="25" fill="#3D2510"/>
    <ellipse cx="43" cy="74" rx="18" ry="16" fill="#6B4228"/>
    <ellipse cx="43" cy="44" rx="26" ry="24" fill="#3D2510"/>
    <ellipse cx="43" cy="44" rx="26" ry="24" fill={`url(#furGrad${id})`} opacity=".5"/>
    <ellipse cx="43" cy="57" rx="11" ry="8" fill="#2E1A0E"/>
    <ellipse cx="43" cy="55" rx="8" ry="5.5" fill="#C47A5A"/>
    <circle cx="40" cy="55" r="2.2" fill="#1A0800"/>
    <circle cx="46" cy="55" r="2.2" fill="#1A0800"/>
    <circle cx="32" cy="40" r="3.5" fill="#1A0800"/>
    <circle cx="54" cy="40" r="3.5" fill="#1A0800"/>
    <circle cx="33" cy="39" r="1.2" fill="rgba(255,255,255,.55)"/>
    <circle cx="55" cy="39" r="1.2" fill="rgba(255,255,255,.55)"/>
    <ellipse cx="21" cy="33" rx="6" ry="5" fill="#2E1A0E"/>
    <ellipse cx="65" cy="33" rx="6" ry="5" fill="#2E1A0E"/>
    <ellipse cx="17" cy="77" rx="10" ry="7" fill="#3D2510" transform="rotate(-25,17,77)"/>
    <line x1="10" y1="73" x2="7" y2="68" stroke="#1A0800" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="14" y1="71" x2="12" y2="65" stroke="#1A0800" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="18" y1="70" x2="17" y2="64" stroke="#1A0800" strokeWidth="1.5" strokeLinecap="round"/>
    <ellipse cx="69" cy="77" rx="10" ry="7" fill="#3D2510" transform="rotate(25,69,77)"/>
    <line x1="76" y1="73" x2="79" y2="68" stroke="#1A0800" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="72" y1="71" x2="74" y2="65" stroke="#1A0800" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="68" y1="70" x2="69" y2="64" stroke="#1A0800" strokeWidth="1.5" strokeLinecap="round"/>
    <defs>
      <radialGradient id={`furGrad${id}`} cx="40%" cy="30%">
        <stop offset="0" stopColor="#fff" stopOpacity=".08"/>
        <stop offset="100%" stopColor="#000" stopOpacity=".15"/>
      </radialGradient>
    </defs>
  </svg>
);

// Sad face SVG icon — replaces banned emoji
const SadFaceSvg = () => (
  <svg width="52" height="52" viewBox="0 0 52 52" fill="none" className="mx-auto mb-3">
    <circle cx="26" cy="26" r="26" fill="hsla(216,59%,26%,0.1)"/>
    <circle cx="19" cy="22" r="2.5" fill="hsl(216,59%,26%)"/>
    <circle cx="33" cy="22" r="2.5" fill="hsl(216,59%,26%)"/>
    <path d="M18 33c2.2-3.2 5.2-4.5 8-4.5s5.8 1.3 8 4.5" stroke="hsl(216,59%,26%)" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
  </svg>
);

// Trophy icon — replaces banned 🏆 emoji in the "new record" badge so the
// component stays emoji-free across both win and loss states. Inline so
// it inherits currentColor from the surrounding gold-text badge.
const TrophySvg = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
    className="inline-block align-[-2px] mr-1"
  >
    <path d="M8 21h8" />
    <path d="M12 17v4" />
    <path d="M7 4h10v5a5 5 0 0 1-10 0V4z" />
    <path d="M17 6h2a2 2 0 0 1 0 4h-2" />
    <path d="M7 6H5a2 2 0 0 0 0 4h2" />
  </svg>
);

export function MoleGame({ isOpen, onClose }: MoleGameProps) {
  const { lang } = useLang();
  const [hits, setHits] = useState(0);
  const [timeLeft, setTimeLeft] = useState(20);
  useEscapeKey(isOpen, useCallback(() => onClose(false), [onClose]));
  const trapRef = useFocusTrap<HTMLDivElement>(isOpen);
  useBodyScrollLock(isOpen);
  const [moleStates, setMoleStates] = useState<('down' | 'up' | 'hit')[]>(['down', 'down', 'down']);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameWon, setGameWon] = useState(false);
  const [stars, setStars] = useState<{ id: number; x: number; y: number }[]>([]);
  const [bestScore, setBestScore] = useState<number>(() => readBestScore());
  const [newRecord, setNewRecord] = useState(false);
  const [copied, setCopied] = useState(false);
  const recordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const targetHits = 5;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const moleTimers = useRef<(ReturnType<typeof setTimeout> | null)[]>([null, null, null]);
  // Collect the "whack feedback" timers (star-fade + mole-reset) so we
  // can clear them on unmount. Without this, closing the game within
  // 700 ms of a hit fired setStars on a component about to unmount,
  // which logs a React dev warning + wastes a render.
  const whackTimers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const starId = useRef(0);
  const gameOverRef = useRef(false);

  const scheduleMole = useCallback((idx: number, delay: number) => {
    if (gameOverRef.current) return;
    moleTimers.current[idx] = setTimeout(() => {
      if (gameOverRef.current) return;
      setMoleStates(prev => { const n = [...prev]; n[idx] = 'up'; return n; });
      moleTimers.current[idx] = setTimeout(() => {
        setMoleStates(prev => { const n = [...prev]; n[idx] = 'down'; return n; });
        if (!gameOverRef.current) scheduleMole(idx, 400 + Math.random() * 900);
      }, 1700);
    }, delay);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setHits(0); setTimeLeft(20); setGameStarted(false); setGameWon(false);
      setMoleStates(['down', 'down', 'down']);
      setNewRecord(false);
      setCopied(false);
      if (recordTimerRef.current) { clearTimeout(recordTimerRef.current); recordTimerRef.current = null; }
      if (copiedTimerRef.current) { clearTimeout(copiedTimerRef.current); copiedTimerRef.current = null; }
      gameOverRef.current = false;
      return;
    }
    // Refresh best score on open in case it changed elsewhere
    setBestScore(readBestScore());
    const t = setTimeout(() => setGameStarted(true), 500);
    return () => clearTimeout(t);
  }, [isOpen]);

  useEffect(() => {
    if (!gameStarted || gameWon) return;
    gameOverRef.current = false;
    [0, 1, 2].forEach(i => scheduleMole(i, Math.random() * 1200));
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          gameOverRef.current = true;
          clearInterval(timerRef.current!);
          moleTimers.current.forEach(t => { if (t) clearTimeout(t); });
          setMoleStates(['down', 'down', 'down']);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    // Snapshot the timer array at effect-setup time — React may have
    // reassigned .current by cleanup-time, which is exactly what the
    // react-hooks/exhaustive-deps rule warns about.
    const timers = moleTimers.current;
    const whacks = whackTimers.current;
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timers.forEach(t => { if (t) clearTimeout(t); });
      whacks.forEach(t => clearTimeout(t));
      whacks.clear();
    };
  }, [gameStarted, gameWon, scheduleMole]);

  useEffect(() => {
    if (hits >= targetHits && !gameWon) {
      setGameWon(true);
      gameOverRef.current = true;
      setMoleStates(['down', 'down', 'down']);
      if (timerRef.current) clearInterval(timerRef.current);
      moleTimers.current.forEach(t => { if (t) clearTimeout(t); });
    }
  }, [hits, gameWon]);

  // Persist best score once the game ends (win or time-out). We read the
  // latest stored value to avoid stale-closure races if another tab
  // updated it while this game was running.
  const gameOver = gameWon || (timeLeft === 0 && gameStarted);
  useEffect(() => {
    if (!gameOver) return;
    const stored = readBestScore();
    if (hits > stored) {
      writeBestScore(hits);
      setBestScore(hits);
      setNewRecord(true);
      if (recordTimerRef.current) clearTimeout(recordTimerRef.current);
      recordTimerRef.current = setTimeout(() => {
        setNewRecord(false);
        recordTimerRef.current = null;
      }, 3000);
    } else {
      setBestScore(stored);
    }
  }, [gameOver, hits]);

  useEffect(() => {
    return () => {
      if (recordTimerRef.current) clearTimeout(recordTimerRef.current);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  const handleShareScore = async () => {
    const text = lang === 'en'
      ? `I scored ${hits} in the mole game on Vision Affichage!`
      : `J'ai fait ${hits} points au jeu des taupes sur Vision Affichage !`;
    const shareData = {
      title: 'Vision Affichage',
      text,
      url: typeof window !== 'undefined' ? window.location.origin : '',
    };
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        /* user cancelled or share failed — fall through to clipboard */
      }
    }
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`${text} ${shareData.url}`.trim());
      }
    } catch {
      /* clipboard unavailable — swallow */
    }
    setCopied(true);
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => {
      setCopied(false);
      copiedTimerRef.current = null;
    }, 2000);
  };

  const handleResetBest = () => {
    if (typeof window === 'undefined') return;
    const ok = window.confirm(lang === 'en' ? 'Reset best score?' : 'Réinitialiser le meilleur score ?');
    if (!ok) return;
    clearBestScore();
    setBestScore(0);
  };

  const handleWhack = (idx: number, e: React.MouseEvent | React.KeyboardEvent) => {
    if (moleStates[idx] !== 'up' || gameOverRef.current) return;
    e.stopPropagation();
    if (moleTimers.current[idx]) clearTimeout(moleTimers.current[idx]!);
    setMoleStates(prev => { const n = [...prev]; n[idx] = 'hit'; return n; });
    setHits(prev => prev + 1);

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    starId.current++;
    const sid = starId.current;
    setStars(prev => [...prev, { id: sid, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }]);
    const starTimer = setTimeout(() => {
      whackTimers.current.delete(starTimer);
      setStars(prev => prev.filter(s => s.id !== sid));
    }, 700);
    whackTimers.current.add(starTimer);

    const resetTimer = setTimeout(() => {
      whackTimers.current.delete(resetTimer);
      setMoleStates(prev => { const n = [...prev]; n[idx] = 'down'; return n; });
      if (!gameOverRef.current) scheduleMole(idx, 300 + Math.random() * 700);
    }, 180);
    whackTimers.current.add(resetTimer);
  };

  if (!isOpen) return null;

  const progress = (hits / targetHits) * 100;
  const gameLost = timeLeft === 0 && !gameWon;

  return (
    <div
      ref={trapRef}
      tabIndex={-1}
      className="fixed inset-0 z-[800] flex items-center justify-center focus:outline-none"
      style={{ background: 'rgba(8,14,32,.82)', backdropFilter: 'blur(18px)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="mole-game-title"
    >
      {/* Star burst effects */}
      {stars.map(s => (
        <div
          key={s.id}
          className="fixed pointer-events-none z-[910] text-lg animate-starburst font-bold"
          style={{ left: s.x, top: s.y, color: 'hsl(var(--gold))' }}
        >
          ✦
        </div>
      ))}

      <div className="bg-card rounded-3xl w-[480px] max-w-[94vw] overflow-hidden shadow-[0_40px_80px_rgba(0,0,0,0.35)] relative">
        {/* Always-visible close button so customers can dismiss the popup */}
        <button
          type="button"
          onClick={() => onClose(false)}
          aria-label={lang === 'en' ? 'Close' : 'Fermer'}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>

        {/* Header */}
        <div className="gradient-navy-dark p-[26px] pb-5 text-center">
          <div className="inline-block border border-primary-foreground/20 text-primary-foreground/70 text-[10px] font-bold tracking-[2.5px] px-4 py-[5px] rounded-full mb-3">
            {lang === 'en' ? 'EXCLUSIVE MINI-GAME' : 'MINI-JEU EXCLUSIF'}
          </div>
          <h2 id="mole-game-title" className="text-2xl font-extrabold text-primary-foreground leading-[1.2] mb-[5px]">
            {lang === 'en' ? <>Whack the moles,<br/>win 10% off</> : <>Frappe les taupes,<br/>gagne 10% de rabais</>}
          </h2>
          <p className="text-[13px] text-primary-foreground/50">
            {lang === 'en' ? `Hit ${targetHits} moles before time runs out` : `Frappe ${targetHits} taupes avant la fin du temps`}
          </p>
        </div>

        {!gameWon && !gameLost ? (
          <>
            {/* Stats */}
            <div className="flex justify-between px-5 py-3 bg-secondary border-b border-border">
              {[{ v: hits, l: lang === 'en' ? 'Hits' : 'Frappes' }, { v: targetHits, l: lang === 'en' ? 'Target' : 'Objectif' }, { v: timeLeft, l: lang === 'en' ? 'Seconds' : 'Secondes' }].map((s, i) => (
                <div key={i} className="text-center">
                  <div className={`text-2xl font-extrabold ${i === 2 && timeLeft <= 5 ? 'text-destructive' : 'text-primary'}`}>{s.v}</div>
                  <div className="text-[10px] font-bold tracking-[1.5px] text-muted-foreground uppercase mt-0.5">{s.l}</div>
                </div>
              ))}
            </div>
            {/* Best score display */}
            <div className="flex items-center justify-center gap-2 px-5 py-1.5 bg-secondary/60 border-b border-border text-[11px] text-muted-foreground">
              <span className="font-semibold">
                {lang === 'en' ? `Best: ${bestScore}` : `Meilleur score : ${bestScore}`}
              </span>
              {bestScore > 0 && (
                <>
                  <span aria-hidden="true" className="opacity-40">·</span>
                  <button
                    type="button"
                    onClick={handleResetBest}
                    className="underline text-foreground/50 hover:text-foreground/80 bg-transparent border-none p-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] rounded-sm"
                  >
                    {lang === 'en' ? 'Reset' : 'Réinitialiser'}
                  </button>
                </>
              )}
            </div>

            {/* Game field */}
            <div
              className="relative min-h-[210px] pt-4 px-7"
              style={{ background: 'linear-gradient(180deg, #AADCF5 0%, #AADCF5 40%, #7BC67E 40%, #5BA85E 55%, #4A9052 100%)' }}
            >
              <div className="flex justify-around items-end px-1">
                {[0, 1, 2].map(idx => (
                  <div key={idx} className="flex flex-col items-center relative w-[120px]">
                    {/* Mole slot — button so the mole is keyboard-whackable
                        (Enter/Space) and screen-reader-announceable.
                        Disabled while the mole is 'down' so tab order
                        still reaches it but clicking a hidden mole is a
                        no-op rather than a phantom hit. */}
                    <div className="absolute bottom-4 w-[90px] h-[94px] overflow-hidden flex items-end justify-center z-[2]">
                      <button
                        type="button"
                        onClick={(e) => handleWhack(idx, e)}
                        onKeyDown={(e) => {
                          // Space scrolls the page on default <button>
                          // behaviour — preventDefault so pressing Space
                          // to whack doesn't jump the dialog backdrop.
                          // Don't prevent Enter (activates onClick natively).
                          if (e.key === ' ') e.preventDefault();
                        }}
                        aria-label={lang === 'en' ? `Whack mole ${idx + 1}` : `Frapper la taupe ${idx + 1}`}
                        aria-pressed={moleStates[idx] === 'hit'}
                        className="transition-transform select-none bg-transparent border-none p-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--gold))] focus-visible:ring-offset-2 rounded-full"
                        style={{
                          transform: moleStates[idx] === 'up'
                            ? 'translateY(0)'
                            : moleStates[idx] === 'hit'
                            ? 'translateY(100%) scaleX(0.8)'
                            : 'translateY(100%)',
                          transition: moleStates[idx] === 'hit'
                            ? 'transform 0.08s ease-in'
                            : 'transform 0.22s cubic-bezier(.34,1.2,.64,1)',
                        }}
                      >
                        <MoleSvg id={`${idx}`} />
                      </button>
                    </div>
                    {/* Hole */}
                    <div
                      className="w-[90px] h-[30px] rounded-[50%] relative z-[3]"
                      style={{
                        background: 'radial-gradient(ellipse at 50% 35%, #1a0800 0%, #2e1505 55%, #3d2010 100%)',
                        boxShadow: 'inset 0 5px 14px rgba(0,0,0,0.7), 0 5px 10px rgba(0,0,0,0.3)',
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Progress bar */}
            <div className="px-7">
              <div
                className="h-[5px] bg-muted mt-2.5 mb-1 rounded-full overflow-hidden"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={targetHits}
                aria-valuenow={hits}
                aria-label={lang === 'en' ? 'Moles hit' : 'Taupes frappées'}
              >
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${progress}%`,
                    background: 'linear-gradient(90deg, hsl(var(--navy)), hsl(var(--gold)))',
                  }}
                />
              </div>
              <div className="text-[12px] text-muted-foreground text-center pb-3">
                {lang === 'en' ? `${hits}/${targetHits} moles hit` : `${hits}/${targetHits} taupes frappées`}
              </div>
              {/* Screen-reader-only live region so each hit is announced
                  (the visible score above updates silently otherwise —
                  assistive-tech users can't hear their progress). Polite
                  so it queues behind button-press feedback instead of
                  interrupting it. */}
              <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
                {hits > 0 && (lang === 'en'
                  ? `${hits} of ${targetHits} moles hit`
                  : `${hits} taupes sur ${targetHits} frappées`)}
              </div>
            </div>

            <div className="text-center pb-3 text-[12px] text-muted-foreground">
              <button onClick={() => onClose(false)} className="text-foreground/50 underline cursor-pointer bg-transparent border-none text-[12px] hover:text-foreground/80 transition-colors">
                {lang === 'en' ? 'No time? Skip' : 'Pas le temps ? Passer'}
              </button>
            </div>
          </>
        ) : gameWon ? (
          /* WIN STATE */
          <div className="p-1 px-7 pb-7 text-center">
            <div className="mx-auto mb-3 w-14 h-14 mt-4">
              <svg viewBox="0 0 56 56" fill="none">
                <circle cx="28" cy="28" r="28" fill="hsla(216,59%,26%,0.1)"/>
                <path d="M16 28l9 9 16-18" stroke="hsl(216,59%,26%)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3 className="text-[26px] font-extrabold text-primary mb-1.5">
              {lang === 'en' ? 'Nice, you won!' : 'Bravo, tu as gagné !'}
            </h3>
            {newRecord && (
              <div
                role="status"
                aria-live="polite"
                className="text-[12px] font-bold text-[hsl(var(--gold))] mb-2"
              >
                <TrophySvg />
                {lang === 'en' ? 'New record!' : 'Nouveau record !'}
              </div>
            )}
            <p className="text-[12px] text-muted-foreground mb-2">
              {lang === 'en' ? `Best: ${bestScore}` : `Meilleur score : ${bestScore}`}
            </p>
            <p className="text-[13px] text-muted-foreground mb-4">
              {lang === 'en' ? '10% off your first order' : '10% de rabais sur ta première commande'}
            </p>
            <div className="bg-secondary border-[1.5px] border-dashed border-accent rounded-xl py-3 px-7 mb-2">
              <span className="text-xl font-extrabold tracking-[4px] text-primary">VISION10</span>
            </div>
            <p className="text-[11px] text-muted-foreground mb-[18px]">
              {lang === 'en' ? 'Valid 7 days · Automatically applied to cart' : 'Valide 7 jours · Appliqué automatiquement au panier'}
            </p>
            <button
              type="button"
              onClick={() => onClose(true)}
              className="block w-full py-[15px] gradient-navy-dark text-primary-foreground border-none rounded-xl text-sm font-extrabold cursor-pointer transition-opacity hover:opacity-88 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC]"
            >
              {lang === 'en' ? 'Start shopping' : 'Commencer à magasiner'}
            </button>
            <button
              type="button"
              onClick={handleShareScore}
              className="mt-2 inline-flex items-center justify-center gap-2 w-full py-[11px] bg-transparent border border-border rounded-xl text-[13px] font-semibold text-foreground cursor-pointer transition-colors hover:bg-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC]"
            >
              <Share2 width={15} height={15} aria-hidden="true" />
              <span>
                {copied
                  ? (lang === 'en' ? 'Copied' : 'Copié')
                  : (lang === 'en' ? 'Share my score' : 'Partager mon score')}
              </span>
            </button>
          </div>
        ) : (
          /* LOSS STATE — no emoji! */
          <div className="p-7 text-center">
            <SadFaceSvg />
            <h3 className="text-[26px] font-extrabold text-primary mb-1.5">
              {lang === 'en' ? 'Time\'s up!' : 'Temps écoulé !'}
            </h3>
            {newRecord && (
              <div
                role="status"
                aria-live="polite"
                className="text-[12px] font-bold text-[hsl(var(--gold))] mb-2"
              >
                <TrophySvg />
                {lang === 'en' ? 'New record!' : 'Nouveau record !'}
              </div>
            )}
            <p className="text-[13px] text-muted-foreground mb-1">
              {lang === 'en' ? `You hit ${hits}/${targetHits} moles` : `Tu as frappé ${hits}/${targetHits} taupes`}
            </p>
            <p className="text-[12px] text-muted-foreground mb-1">
              {lang === 'en' ? `Best: ${bestScore}` : `Meilleur score : ${bestScore}`}
            </p>
            <p className="text-[12px] text-muted-foreground mb-5">
              {lang === 'en' ? 'Tough one! You can still continue.' : 'C\'est dur ! Tu peux quand même continuer.'}
            </p>
            <button
              type="button"
              onClick={() => onClose(false)}
              className="block w-full py-[15px] gradient-navy-dark text-primary-foreground border-none rounded-xl text-sm font-extrabold cursor-pointer transition-opacity hover:opacity-88 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC]"
            >
              {lang === 'en' ? 'Continue without discount' : 'Continuer sans rabais'}
            </button>
            <button
              type="button"
              onClick={handleShareScore}
              className="mt-2 inline-flex items-center justify-center gap-2 w-full py-[11px] bg-transparent border border-border rounded-xl text-[13px] font-semibold text-foreground cursor-pointer transition-colors hover:bg-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC]"
            >
              <Share2 width={15} height={15} aria-hidden="true" />
              <span>
                {copied
                  ? (lang === 'en' ? 'Copied' : 'Copié')
                  : (lang === 'en' ? 'Share my score' : 'Partager mon score')}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
