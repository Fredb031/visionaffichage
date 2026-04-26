import { useEffect, useState } from 'react';
import { Sparkles, Gift } from 'lucide-react';
import { useLang } from '@/lib/langContext';
import { getLoyalty, type LoyaltyAccount, type LoyaltyTier } from '@/lib/loyalty';

/**
 * Loyalty dashboard tile — Mega Blueprint Section 15.2. Shows the
 * customer's current points balance, dollar-equivalent rebate (1¢
 * per point on a $5-per-100 ladder), tier badge, and a tier-progress
 * hint that fades out once the visitor reaches Gold (free express
 * shipping unlocked).
 */
const TIER_LABELS: Record<LoyaltyTier, string> = {
  bronze: 'BRONZE',
  silver: 'SILVER',
  gold: 'GOLD',
};

const TIER_TONE: Record<LoyaltyTier, string> = {
  bronze: 'bg-[#B87333]/20 text-[#FFD9A8] border-[#B87333]/40',
  silver: 'bg-zinc-300/20 text-zinc-100 border-zinc-300/40',
  gold: 'bg-[#E8A838]/20 text-[#FFE7A3] border-[#E8A838]/50',
};

export function LoyaltyCard() {
  const { lang } = useLang();
  const [account, setAccount] = useState<LoyaltyAccount | null>(null);

  // Lazy-hydrate after mount so SSR/hydration mismatch doesn't flag a
  // localStorage-derived value vs. the server-rendered placeholder.
  useEffect(() => {
    setAccount(getLoyalty());
  }, []);

  if (!account) {
    return (
      <div
        className="relative overflow-hidden rounded-2xl p-5 md:p-6 mb-5 bg-gradient-to-br from-[#0052CC] to-[#1B3A6B] text-white min-h-[170px]"
        aria-busy="true"
        aria-live="polite"
      >
        <span className="sr-only">{lang === 'en' ? 'Loading loyalty balance…' : 'Chargement du solde…'}</span>
      </div>
    );
  }

  const dollarValue = (account.points / 100 * 5).toFixed(2);
  const remainingToGold = Math.max(0, 5000 - account.lifetime);
  const showProgressHint = account.lifetime < 5000;

  return (
    <section
      aria-labelledby="loyalty-heading"
      className="relative overflow-hidden rounded-2xl p-5 md:p-6 mb-5 bg-gradient-to-br from-[#0052CC] to-[#1B3A6B] text-white shadow-lg"
    >
      {/* Decorative spark — purely visual, hidden from a11y tree. */}
      <Sparkles
        size={120}
        aria-hidden="true"
        className="absolute -top-6 -right-6 text-white/5 pointer-events-none"
      />

      <div className="relative flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">
            {lang === 'en' ? 'Your balance' : 'Ton solde'}
          </div>
          <h2
            id="loyalty-heading"
            className="text-3xl md:text-4xl font-extrabold mt-1 leading-none"
          >
            {account.points.toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA')} pts
          </h2>
          <div className="text-xs md:text-sm opacity-90 mt-1.5">
            {lang === 'en'
              ? `= $${dollarValue} discount available`
              : `= ${dollarValue}$ de rabais disponible`}
          </div>
        </div>

        <span
          className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-1 rounded-full border ${TIER_TONE[account.tier]}`}
          aria-label={`${lang === 'en' ? 'Tier' : 'Niveau'}: ${TIER_LABELS[account.tier]}`}
        >
          {TIER_LABELS[account.tier]}
        </span>
      </div>

      {showProgressHint && (
        <div className="relative mt-4 flex items-center gap-2 text-[11px] md:text-xs bg-white/10 rounded-lg px-3 py-2 border border-white/15">
          <Gift size={14} aria-hidden="true" className="flex-shrink-0 opacity-90" />
          <span className="leading-snug">
            {lang === 'en'
              ? `Free express delivery in ${remainingToGold.toLocaleString('en-CA')} pts`
              : `Prochaine livraison express gratuite dans ${remainingToGold.toLocaleString('fr-CA')} pts`}
          </span>
        </div>
      )}
    </section>
  );
}

export default LoyaltyCard;
