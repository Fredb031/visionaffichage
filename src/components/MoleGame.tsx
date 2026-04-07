import { useState, useEffect, useCallback, useRef } from 'react';

interface MoleGameProps {
  isOpen: boolean;
  onClose: (won: boolean) => void;
}

export function MoleGame({ isOpen, onClose }: MoleGameProps) {
  const [hits, setHits] = useState(0);
  const [timeLeft, setTimeLeft] = useState(20);
  const [activeMole, setActiveMole] = useState<number | null>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameWon, setGameWon] = useState(false);
  const [hitMole, setHitMole] = useState<number | null>(null);
  const [stars, setStars] = useState<{ id: number; x: number; y: number }[]>([]);
  const targetHits = 5;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const moleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const starId = useRef(0);

  const moleColors = ['#8B4513', '#A0522D', '#6B3410'];

  const showMole = useCallback(() => {
    if (!gameStarted || gameWon) return;
    const idx = Math.floor(Math.random() * 3);
    setActiveMole(idx);
    moleRef.current = setTimeout(() => {
      setActiveMole(null);
      moleRef.current = setTimeout(showMole, 300 + Math.random() * 500);
    }, 1000 + Math.random() * 800);
  }, [gameStarted, gameWon]);

  useEffect(() => {
    if (!isOpen) {
      setHits(0);
      setTimeLeft(20);
      setGameStarted(false);
      setGameWon(false);
      setActiveMole(null);
      return;
    }
    // Auto-start after a short delay
    const t = setTimeout(() => setGameStarted(true), 500);
    return () => clearTimeout(t);
  }, [isOpen]);

  useEffect(() => {
    if (!gameStarted || gameWon) return;
    showMole();
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          if (moleRef.current) clearTimeout(moleRef.current);
          setActiveMole(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (moleRef.current) clearTimeout(moleRef.current);
    };
  }, [gameStarted, gameWon, showMole]);

  useEffect(() => {
    if (hits >= targetHits && !gameWon) {
      setGameWon(true);
      setActiveMole(null);
      if (timerRef.current) clearInterval(timerRef.current);
      if (moleRef.current) clearTimeout(moleRef.current);
    }
  }, [hits, gameWon]);

  const handleWhack = (idx: number, e: React.MouseEvent) => {
    if (activeMole !== idx) return;
    e.stopPropagation();
    setHitMole(idx);
    setHits(prev => prev + 1);

    const rect = (e.target as HTMLElement).getBoundingClientRect();
    starId.current++;
    setStars(prev => [...prev, { id: starId.current, x: rect.left + rect.width / 2, y: rect.top }]);
    setTimeout(() => setStars(prev => prev.filter(s => s.id !== starId.current)), 600);

    setActiveMole(null);
    setTimeout(() => setHitMole(null), 150);
    if (moleRef.current) clearTimeout(moleRef.current);
    moleRef.current = setTimeout(showMole, 400);
  };

  if (!isOpen) return null;

  const progress = (hits / targetHits) * 100;
  const gameLost = timeLeft === 0 && !gameWon;

  return (
    <div
      className={`fixed inset-0 bg-foreground/75 backdrop-blur-[14px] z-[800] flex items-center justify-center transition-opacity duration-400 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
    >
      {/* Stars */}
      {stars.map(s => (
        <div key={s.id} className="fixed pointer-events-none z-[810] text-xl animate-starburst" style={{ left: s.x, top: s.y }}>
          ⭐
        </div>
      ))}

      <div className="bg-card rounded-[28px] w-[500px] max-w-[95vw] overflow-hidden shadow-[0_40px_80px_rgba(0,0,0,0.3)] transform transition-transform duration-400">
        {/* Header */}
        <div className="gradient-navy-dark p-7 pb-5 text-center">
          <div className="inline-block bg-primary-foreground/15 border border-primary-foreground/20 text-primary-foreground text-[10px] font-bold tracking-[2.5px] px-4 py-1 rounded-full mb-3.5">
            🎮 MINI-JEU EXCLUSIF
          </div>
          <h2 className="text-[26px] font-extrabold text-primary-foreground leading-tight mb-1.5">
            Frappe les taupes,<br />gagne 10% de rabais!
          </h2>
          <p className="text-[13px] text-primary-foreground/60">
            Frappe {targetHits} taupes avant que le temps s'écoule
          </p>
        </div>

        {!gameWon && !gameLost ? (
          <>
            {/* Stats */}
            <div className="flex justify-between px-5 py-3 bg-secondary border-b border-border">
              <div className="text-center">
                <div className="text-[22px] font-extrabold text-primary">{hits}</div>
                <div className="text-[10px] font-semibold tracking-[1.5px] text-muted-foreground uppercase mt-0.5">Frappes</div>
              </div>
              <div className="text-center">
                <div className="text-[22px] font-extrabold text-primary">{targetHits}</div>
                <div className="text-[10px] font-semibold tracking-[1.5px] text-muted-foreground uppercase mt-0.5">Objectif</div>
              </div>
              <div className="text-center">
                <div className="text-[22px] font-extrabold text-primary">{timeLeft}</div>
                <div className="text-[10px] font-semibold tracking-[1.5px] text-muted-foreground uppercase mt-0.5">Secondes</div>
              </div>
            </div>

            {/* Game field */}
            <div className="relative min-h-[220px] overflow-hidden" style={{ background: 'linear-gradient(180deg, #87CEEB 0%, #98D8A8 55%, #5D8A3C 55%)' }}>
              <div className="absolute bottom-0 left-0 right-0 h-[45%]" style={{ background: 'linear-gradient(180deg, #5D8A3C, #3d6b20)' }} />
              <div className="flex justify-around items-end relative z-[2] px-2 pt-16 pb-4">
                {[0, 1, 2].map((idx) => (
                  <div key={idx} className="flex flex-col items-center relative w-[110px]">
                    {/* Mole container */}
                    <div className="absolute bottom-[14px] w-[78px] h-[80px] flex items-end justify-center overflow-hidden z-[2]">
                      <div
                        onClick={(e) => handleWhack(idx, e)}
                        className={`w-[72px] h-[76px] rounded-[50%_50%_40%_40%] cursor-pointer relative flex-shrink-0 transition-transform duration-150 select-none ${
                          activeMole === idx && hitMole !== idx ? 'translate-y-0' : 'translate-y-full'
                        } ${hitMole === idx ? 'scale-75' : ''}`}
                        style={{ background: moleColors[idx] }}
                      >
                        <div className="absolute inset-0 rounded-[50%_50%_40%_40%] flex flex-col items-center justify-center gap-0.5">
                          <div className="flex gap-2.5">
                            <div className="w-3 h-[13px] bg-card rounded-full relative">
                              <div className="absolute w-[7px] h-[7px] bg-foreground rounded-full top-[3px] left-[2.5px]" />
                            </div>
                            <div className="w-3 h-[13px] bg-card rounded-full relative">
                              <div className="absolute w-[7px] h-[7px] bg-foreground rounded-full top-[3px] left-[2.5px]" />
                            </div>
                          </div>
                          <div className="w-2.5 h-2 bg-destructive/70 rounded-full" />
                          <div className="w-[22px] h-2.5 border-b-[2.5px] border-foreground/35 rounded-b-[50%]" />
                        </div>
                      </div>
                    </div>
                    {/* Hole */}
                    <div
                      className="w-[86px] h-7 rounded-[50%] relative z-[3]"
                      style={{
                        background: 'radial-gradient(ellipse at 50% 40%, #1a0a00 0%, #2d1a0a 60%, #3d2a1a 100%)',
                        boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.6), 0 4px 8px rgba(0,0,0,0.3)',
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Progress */}
            <div className="h-1.5 bg-muted mx-7 mt-1">
              <div className="h-full rounded-sm transition-all duration-300" style={{ width: `${progress}%`, background: 'linear-gradient(90deg, hsl(var(--gold)), hsl(var(--gold2)))' }} />
            </div>
            <div className="text-[11px] text-muted-foreground text-center py-3">
              Frappe les taupes !
            </div>

            {/* Skip */}
            <div className="text-center pb-3 text-[12px] text-muted-foreground">
              <button onClick={() => onClose(false)} className="text-foreground/60 underline cursor-pointer bg-transparent border-none text-[12px]">
                Pas le temps? Continuer sans rabais
              </button>
            </div>
          </>
        ) : gameWon ? (
          <div className="p-7 text-center">
            <div className="text-[52px] mb-3 animate-bounce-in">🎉</div>
            <h3 className="text-[28px] font-extrabold text-primary mb-1.5">Bravo, tu as gagné!</h3>
            <p className="text-sm text-muted-foreground mb-5">Ton code de 10% de rabais est prêt</p>
            <div className="bg-secondary border-2 border-dashed border-accent rounded-xl py-3.5 px-7 mb-2.5">
              <span className="text-[22px] font-extrabold tracking-[4px] text-primary">VISION10</span>
            </div>
            <p className="text-[11px] text-muted-foreground mb-5">Valide 48h · Appliqué automatiquement au panier</p>
            <button
              onClick={() => onClose(true)}
              className="block w-full py-4 gradient-navy-dark text-primary-foreground border-none rounded-xl text-[15px] font-bold cursor-pointer transition-opacity hover:opacity-88"
            >
              Magasiner maintenant →
            </button>
          </div>
        ) : (
          <div className="p-7 text-center">
            <div className="text-[52px] mb-3">😢</div>
            <h3 className="text-[28px] font-extrabold text-primary mb-1.5">Temps écoulé!</h3>
            <p className="text-sm text-muted-foreground mb-5">Tu as frappé {hits}/{targetHits} taupes</p>
            <button
              onClick={() => onClose(false)}
              className="block w-full py-4 gradient-navy-dark text-primary-foreground border-none rounded-xl text-[15px] font-bold cursor-pointer transition-opacity hover:opacity-88"
            >
              Continuer sans rabais →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
