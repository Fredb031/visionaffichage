import { useState, useEffect, useCallback, useRef } from 'react';

interface MoleGameProps {
  isOpen: boolean;
  onClose: (won: boolean) => void;
}

const MoleSvg = ({ id, onClick }: { id: string; onClick: (e: React.MouseEvent) => void }) => (
  <svg className="mole-svg block cursor-pointer" width="86" height="90" viewBox="0 0 86 90" onClick={onClick}>
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

export function MoleGame({ isOpen, onClose }: MoleGameProps) {
  const [hits, setHits] = useState(0);
  const [timeLeft, setTimeLeft] = useState(20);
  const [moleStates, setMoleStates] = useState<('down' | 'up' | 'hit')[]>(['down', 'down', 'down']);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameWon, setGameWon] = useState(false);
  const [stars, setStars] = useState<{ id: number; x: number; y: number }[]>([]);
  const targetHits = 5;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const moleTimers = useRef<(ReturnType<typeof setTimeout> | null)[]>([null, null, null]);
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
      gameOverRef.current = false;
      return;
    }
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
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      moleTimers.current.forEach(t => { if (t) clearTimeout(t); });
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

  const handleWhack = (idx: number, e: React.MouseEvent) => {
    if (moleStates[idx] !== 'up' || gameOverRef.current) return;
    e.stopPropagation();

    if (moleTimers.current[idx]) clearTimeout(moleTimers.current[idx]!);
    setMoleStates(prev => { const n = [...prev]; n[idx] = 'hit'; return n; });
    setHits(prev => prev + 1);

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    starId.current++;
    const sid = starId.current;
    setStars(prev => [...prev, { id: sid, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }]);
    setTimeout(() => setStars(prev => prev.filter(s => s.id !== sid)), 700);

    setTimeout(() => {
      setMoleStates(prev => { const n = [...prev]; n[idx] = 'down'; return n; });
      if (!gameOverRef.current) scheduleMole(idx, 300 + Math.random() * 700);
    }, 180);
  };

  if (!isOpen) return null;

  const progress = (hits / targetHits) * 100;
  const gameLost = timeLeft === 0 && !gameWon;

  return (
    <div className={`fixed inset-0 z-[800] flex items-center justify-center transition-opacity duration-350 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} style={{ background: 'rgba(8,14,32,.78)', backdropFilter: 'blur(16px)' }}>
      {stars.map(s => (
        <div key={s.id} className="fixed pointer-events-none z-[910] text-lg animate-starburst font-bold" style={{ left: s.x, top: s.y, color: 'hsl(var(--gold))' }}>✦</div>
      ))}

      <div className="bg-card rounded-3xl w-[480px] max-w-[94vw] overflow-hidden shadow-[0_40px_80px_rgba(0,0,0,0.3)] transition-transform duration-400">
        {/* Header */}
        <div className="gradient-navy-dark p-[26px] pb-5 text-center">
          <div className="inline-block border border-primary-foreground/20 text-primary-foreground/70 text-[10px] font-bold tracking-[2.5px] px-4 py-[5px] rounded-full mb-3">MINI-JEU EXCLUSIF</div>
          <h2 className="text-2xl font-extrabold text-primary-foreground leading-[1.2] mb-[5px]">
            Frappe les taupes,<br/>gagne 10% de rabais
          </h2>
          <p className="text-[13px] text-primary-foreground/50">Frappe {targetHits} taupes avant la fin du temps</p>
        </div>

        {!gameWon && !gameLost ? (
          <>
            {/* Stats */}
            <div className="flex justify-between px-5 py-3 bg-secondary border-b border-border">
              {[{ v: hits, l: 'Frappes' }, { v: targetHits, l: 'Objectif' }, { v: timeLeft, l: 'Secondes' }].map((s, i) => (
                <div key={i} className="text-center">
                  <div className="text-2xl font-extrabold text-primary">{s.v}</div>
                  <div className="text-[10px] font-bold tracking-[1.5px] text-muted-foreground uppercase mt-0.5">{s.l}</div>
                </div>
              ))}
            </div>

            {/* Game field */}
            <div className="relative min-h-[210px] pt-4 px-7" style={{ background: 'linear-gradient(180deg, #AADCF5 0%, #AADCF5 40%, #7BC67E 40%, #5BA85E 55%, #4A9052 100%)' }}>
              <div className="flex justify-around items-end px-1">
                {[0, 1, 2].map(idx => (
                  <div key={idx} className="flex flex-col items-center relative w-[120px]">
                    {/* Mole slot */}
                    <div className="absolute bottom-4 w-[90px] h-[94px] overflow-hidden flex items-end justify-center z-[2]">
                      <div
                        className="transition-transform select-none"
                        style={{
                          transform: moleStates[idx] === 'up' ? 'translateY(0)' : moleStates[idx] === 'hit' ? 'translateY(100%) scaleX(0.8)' : 'translateY(100%)',
                          transition: moleStates[idx] === 'hit' ? 'transform 0.08s ease-in' : 'transform 0.2s cubic-bezier(.34,1.2,.64,1)',
                        }}
                      >
                        <MoleSvg id={`${idx}`} onClick={(e) => handleWhack(idx, e)} />
                      </div>
                    </div>
                    {/* Hole */}
                    <div
                      className="w-[90px] h-[30px] rounded-[50%] relative z-[3]"
                      style={{ background: 'radial-gradient(ellipse at 50% 35%, #1a0800 0%, #2e1505 55%, #3d2010 100%)', boxShadow: 'inset 0 5px 14px rgba(0,0,0,0.7), 0 5px 10px rgba(0,0,0,0.3)' }}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Progress */}
            <div className="px-7">
              <div className="h-[5px] bg-muted mt-2.5 mb-1">
                <div className="h-full rounded-sm transition-all duration-300" style={{ width: `${progress}%`, background: 'linear-gradient(90deg, hsl(var(--navy)), hsl(var(--gold)))' }} />
              </div>
              <div className="text-[12px] text-muted-foreground text-center pb-3">
                {hits >= targetHits ? 'Objectif atteint!' : `${hits}/${targetHits} taupes frappées`}
              </div>
            </div>

            <div className="text-center pb-2.5 text-[12px] text-muted-foreground">
              <button onClick={() => onClose(false)} className="text-foreground/60 underline cursor-pointer bg-transparent border-none text-[12px]">
                Pas le temps? Passer
              </button>
            </div>
          </>
        ) : gameWon ? (
          <div className="p-1 px-7 pb-7 text-center">
            <div className="mx-auto mb-3 w-14 h-14">
              <svg viewBox="0 0 56 56" fill="none"><circle cx="28" cy="28" r="28" fill="hsla(var(--navy), 0.1)"/><path d="M18 28l8 8 14-16" stroke="hsl(var(--navy))" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <h3 className="text-[26px] font-extrabold text-primary mb-1.5">Bravo, tu as gagné!</h3>
            <p className="text-[13px] text-muted-foreground mb-4">10% de rabais sur ta première commande</p>
            <div className="bg-secondary border-[1.5px] border-dashed border-accent rounded-xl py-3 px-7 mb-2">
              <span className="text-xl font-extrabold tracking-[4px] text-primary">VISION10</span>
            </div>
            <p className="text-[11px] text-muted-foreground mb-[18px]">Valide 48h · Appliqué automatiquement au panier</p>
            <button
              onClick={() => onClose(true)}
              className="block w-full py-[15px] gradient-navy-dark text-primary-foreground border-none rounded-xl text-sm font-extrabold cursor-pointer transition-opacity hover:opacity-88"
            >
              Commencer à magasiner
            </button>
          </div>
        ) : (
          <div className="p-7 text-center">
            <div className="text-[52px] mb-3">😢</div>
            <h3 className="text-[26px] font-extrabold text-primary mb-1.5">Temps écoulé!</h3>
            <p className="text-[13px] text-muted-foreground mb-5">Tu as frappé {hits}/{targetHits} taupes</p>
            <button
              onClick={() => onClose(false)}
              className="block w-full py-[15px] gradient-navy-dark text-primary-foreground border-none rounded-xl text-sm font-extrabold cursor-pointer transition-opacity hover:opacity-88"
            >
              Continuer sans rabais →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}