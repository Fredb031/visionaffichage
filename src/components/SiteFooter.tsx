import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, CheckCircle2 } from 'lucide-react';
import { useLang } from '@/lib/langContext';
import { isValidEmail, normalizeInvisible } from '@/lib/utils';

export function SiteFooter() {
  const { lang } = useLang();
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  // Surfaces a soft-error line when isValidEmail rejects the submitted
  // address. Before this, the form swallowed "a@b.c"-style inputs that
  // pass the browser's type=email check but fail our stricter regex —
  // the user saw nothing, assumed it worked, and never got a newsletter.
  const [emailErr, setEmailErr] = useState(false);
  // Track the pending reset timer so we can cancel it on unmount — without
  // this, users who submit and then navigate away within 3.5s trigger a
  // state update on an unmounted component (React dev warning + wasted work).
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    // Use the same full normalization pipeline as isValidEmail applies
    // internally (normalizeInvisible + trim + lower). Without this step,
    // a paste with a zero-width space would pass isValidEmail (which
    // strips invisibles before the regex check) but we'd then store the
    // RAW pasted value in localStorage — the backend would bounce that
    // address when a real newsletter send fires.
    const normalized = normalizeInvisible(email).trim().toLowerCase();
    if (!isValidEmail(normalized)) {
      setEmailErr(true);
      return;
    }
    setEmailErr(false);
    try {
      const raw = JSON.parse(localStorage.getItem('vision-newsletter') ?? '[]');
      // Defensive: filter out non-strings so a corrupted row doesn't
      // poison the Set comparison below (list.includes would miss the
      // duplicate and we'd double-subscribe). Older builds stored raw
      // strings; a devtools edit or hand-built JSON could slip objects
      // in. Cap at 2000 AFTER the append so the new entry is always
      // included — the previous slice(-2000) BEFORE the push could
      // produce a 2001-entry list (cap+1) on the boundary case.
      const arr: unknown[] = Array.isArray(raw) ? raw : [];
      const clean = arr.filter((v): v is string => typeof v === 'string');
      if (!clean.includes(normalized)) {
        clean.push(normalized);
        // Keep only the most-recent 2000 — a brand-new subscriber
        // is the freshest and stays in the list.
        const capped = clean.slice(-2000);
        localStorage.setItem('vision-newsletter', JSON.stringify(capped));
      }
    } catch { /* noop */ }
    setSubscribed(true);
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => {
      setSubscribed(false);
      setEmail('');
      resetTimerRef.current = null;
    }, 3500);
  };

  return (
    <footer className="bg-gradient-to-br from-[#0F2341] via-[#1B3A6B] to-[#0F2341] text-white pt-14 pb-8 px-6 md:px-10 mt-12">
      <div className="max-w-[1100px] mx-auto">
        {/* Newsletter signup */}
        <div className="grid md:grid-cols-2 gap-8 pb-10 border-b border-white/10">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[2px] text-[#E8A838] mb-2">
              {lang === 'en' ? 'Stay in the loop' : 'Reste informé'}
            </div>
            <h3 className="text-2xl md:text-3xl font-extrabold tracking-[-0.5px] mb-2">
              {lang === 'en' ? 'New products. Real perks.' : 'Nouveaux produits. Vrais avantages.'}
            </h3>
            <p className="text-sm text-white/60">
              {lang === 'en'
                ? 'Quarterly roundup of new merch + exclusive bulk discounts. Zero spam.'
                : 'Récap trimestriel des nouveautés + rabais exclusifs sur grosse commande. Zéro spam.'}
            </p>
          </div>

          {subscribed ? (
            <div
              className="flex items-center gap-3 bg-emerald-500/15 border border-emerald-400/30 rounded-2xl p-4 self-center"
              role="status"
              aria-live="polite"
            >
              <CheckCircle2 size={20} className="text-emerald-300 flex-shrink-0" aria-hidden="true" />
              <div>
                <div className="font-bold">{lang === 'en' ? 'Subscribed!' : 'Inscrit !'}</div>
                <div className="text-xs text-white/70">
                  {lang === 'en' ? 'See you in your inbox.' : 'À bientôt dans ta boîte courriel.'}
                </div>
              </div>
            </div>
          ) : (
            <form
              onSubmit={handleSubscribe}
              className="flex flex-col self-center w-full max-w-md"
              aria-label={lang === 'en' ? 'Newsletter signup' : 'Inscription à l\u2019infolettre'}
            >
              <div className="flex items-stretch">
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); if (emailErr) setEmailErr(false); }}
                  placeholder={lang === 'en' ? 'your@email.com' : 'ton@courriel.com'}
                  aria-label={lang === 'en' ? 'Email address' : 'Adresse courriel'}
                  aria-required="true"
                  aria-invalid={emailErr || undefined}
                  className={`flex-1 px-4 py-3 bg-white/10 border rounded-l-xl text-sm placeholder:text-white/40 outline-none focus:bg-white/15 focus-visible:ring-2 focus-visible:ring-[#E8A838]/50 transition-shadow ${
                    emailErr ? 'border-rose-400/70 focus:border-rose-300' : 'border-white/20 focus:border-[#E8A838]'
                  }`}
                  autoComplete="email"
                  required
                />
                <button
                  type="submit"
                  disabled={!email.trim()}
                  className="px-5 bg-[#E8A838] text-[#1B3A6B] font-extrabold text-sm rounded-r-xl hover:bg-[#F0B449] disabled:opacity-60 disabled:hover:bg-[#E8A838] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8A838]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F2341]"
                >
                  {lang === 'en' ? 'Subscribe' : "M'inscrire"}
                </button>
              </div>
              {emailErr && (
                <p role="alert" className="text-[11px] text-rose-300 font-semibold mt-1.5 pl-1">
                  {lang === 'en'
                    ? 'That email doesn\u2019t look valid — double-check it and try again.'
                    : 'Ce courriel ne semble pas valide — vérifie-le et réessaie.'}
                </p>
              )}
            </form>
          )}
        </div>

        {/* Link columns */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-10 border-b border-white/10">
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-3">
              {lang === 'en' ? 'Shop' : 'Boutique'}
            </h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/products" className="text-white/80 hover:text-[#E8A838]">{lang === 'en' ? 'All products' : 'Tous les produits'}</Link></li>
              <li><Link to="/products?cat=tshirts" className="text-white/80 hover:text-[#E8A838]">T-Shirts</Link></li>
              <li><Link to="/products?cat=chandails" className="text-white/80 hover:text-[#E8A838]">Hoodies</Link></li>
              <li><Link to="/products?cat=headwear" className="text-white/80 hover:text-[#E8A838]">{lang === 'en' ? 'Caps & Beanies' : 'Casquettes & Tuques'}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-3">
              {lang === 'en' ? 'Company' : 'Entreprise'}
            </h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#about" className="text-white/80 hover:text-[#E8A838]">{lang === 'en' ? 'About us' : 'À propos'}</a></li>
              <li><a href="#testimonials" className="text-white/80 hover:text-[#E8A838]">{lang === 'en' ? 'Testimonials' : 'Témoignages'}</a></li>
              <li><a href="#how-it-works" className="text-white/80 hover:text-[#E8A838]">{lang === 'en' ? 'How it works' : 'Comment ça marche'}</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-3">
              {lang === 'en' ? 'Support' : 'Aide'}
            </h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/track" className="text-white/80 hover:text-[#E8A838]">{lang === 'en' ? 'Track an order' : 'Suivre une commande'}</Link></li>
              <li><Link to="/account" className="text-white/80 hover:text-[#E8A838]">{lang === 'en' ? 'My account' : 'Mon compte'}</Link></li>
              <li><a href="mailto:info@visionaffichage.com" className="text-white/80 hover:text-[#E8A838]">Contact</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-3">
              {lang === 'en' ? 'Reach us' : 'Nous joindre'}
            </h4>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2 text-white/80">
                <Phone size={12} className="text-[#E8A838]" aria-hidden="true" />
                <a href="tel:+13673804808" className="hover:text-[#E8A838] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8A838]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F2341] rounded">367-380-4808</a>
              </li>
              <li className="flex items-center gap-2 text-white/80 break-all">
                <Mail size={12} className="text-[#E8A838]" aria-hidden="true" />
                <a href="mailto:info@visionaffichage.com" className="hover:text-[#E8A838] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8A838]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F2341] rounded">info@visionaffichage.com</a>
              </li>
              <li className="flex items-center gap-2 text-white/80">
                <MapPin size={12} className="text-[#E8A838]" aria-hidden="true" />
                Québec, Canada
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom row */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-6">
          <div className="flex items-center gap-3">
            <img
              src="https://visionaffichage.com/cdn/shop/files/Logo-vision-horizontal-blanc.png?height=135&v=1694121209"
              alt="Vision Affichage"
              className="h-5 opacity-70"
              onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
            />
          </div>
          <div className="text-[11px] text-white/40">
            © {new Date().getFullYear()} Vision Affichage · {lang === 'en' ? 'Made in Québec' : 'Fabriqué au Québec'} · {lang === 'en' ? 'All rights reserved' : 'Tous droits réservés'}
          </div>
        </div>
      </div>
    </footer>
  );
}
