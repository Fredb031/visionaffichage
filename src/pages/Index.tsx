import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';
import { lazy, Suspense, useState, useEffect, useRef, useCallback } from 'react';
const MoleGame = lazy(() => import('@/components/MoleGame').then(m => ({ default: m.MoleGame })));
const IntroAnimation = lazy(() => import('@/components/IntroAnimation').then(m => ({ default: m.IntroAnimation })));
const CartDrawer = lazy(() => import('@/components/CartDrawer').then((m) => ({ default: m.CartDrawer })));
const LoginModal = lazy(() => import('@/components/LoginModal').then((m) => ({ default: m.LoginModal })));
import { AIChat } from '@/components/AIChat';
import { SiteFooter } from '@/components/SiteFooter';
import { Link } from 'react-router-dom';
import { ChevronDown, Lock } from 'lucide-react';
import { useLang } from '@/lib/langContext';
import { useCartStore } from '@/stores/localCartStore';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

const FAQ_FR = [
  { q: 'Y a-t-il une quantité minimum?', a: 'Aucun minimum — commande dès 1 pièce. Que tu aies besoin d’un seul échantillon ou de 500 uniformes, le prix unitaire reste juste.' },
  { q: 'En combien de temps vais-je recevoir ma commande?', a: 'Délai standard de 5 jours ouvrables après approbation. Les commandes passées avant 15 h partent en production la journée même.' },
  { q: 'Quels formats de fichier acceptez-vous?', a: 'Vectoriels (SVG, AI, PDF) idéaux. PNG haute résolution fonctionne aussi (300 DPI minimum). On t’avise si on a besoin d’une meilleure version avant de facturer.' },
  { q: 'Puis-je commander un seul échantillon?', a: 'Oui. Une pièce, livrée en 5 jours. C’est la meilleure façon de tester avant de commander pour ton équipe.' },
  { q: 'Que se passe-t-il si vous ratez mon délai?', a: 'Si on dépasse les 5 jours ouvrables d’une seule journée — remboursement intégral, sans questions.' },
  { q: 'Broderie ou sérigraphie?', a: 'Broderie pour casquettes, polos, vestes (look premium qui dure). Sérigraphie pour t-shirts et hoodies (plus net, plus rapide). On te recommande selon la pièce.' },
  { q: 'Y a-t-il un rabais de volume?', a: 'Oui. Paliers à 12, 25, 50, 100 et 250 pièces par design. Les paliers s’affichent en direct dans le calculateur.' },
  { q: 'Quelle est votre politique de retour?', a: 'Erreur de notre part — refait gratuitement, livraison aller-retour à nos frais. Garantie un an sur couture et impression à usage normal.' },
];

const FAQ_EN = [
  { q: 'Is there a minimum order quantity?', a: 'No minimum — order as little as 1 piece. Whether you need a single sample or 500 uniforms, the per-unit price stays fair.' },
  { q: 'How fast will I receive my order?', a: 'Standard 5 business days after approval. Orders placed before 3 pm hit production the same day.' },
  { q: 'What file formats do you accept?', a: 'Vector (SVG, AI, PDF) is ideal. High-res PNG works too (300 DPI minimum). We tell you if we need a better version before charging.' },
  { q: 'Can I order a single sample?', a: 'Yes. One piece, delivered in 5 days. Best way to test before ordering for the whole team.' },
  { q: 'What happens if you miss the deadline?', a: 'Past 5 business days by a single day — full refund, no questions.' },
  { q: 'Embroidery or screen print?', a: 'Embroidery for caps, polos, jackets (premium, lasts decades). Screen print for tees and hoodies (sharper, faster). We recommend per piece.' },
  { q: 'Bulk discount?', a: 'Yes. Tiers at 12, 25, 50, 100, 250 pieces per design. Tiers show live in the quote builder.' },
  { q: 'Return policy?', a: 'Our mistake — remade free, shipping both ways on us. One-year guarantee on stitching and print under normal use.' },
];

const REVIEWS = [
  { fr: { q: 'Reçu en 4 jours pile. Mes gars ont adoré le hoodie. On va recommander pour le reste de l’équipe.', n: 'Marc Lévesque', c: 'Construction Frères' }, en: { q: 'Got it in 4 days flat. Crew loved the hoodie. Re-ordering for the rest.', n: 'Marc Lévesque', c: 'Construction Frères' } },
  { fr: { q: 'Aucun minimum, vraiment. J’ai commencé avec 3 polos pour tester. Qualité impeccable.', n: 'Sophie Tremblay', c: 'Paysages Verts' }, en: { q: 'No minimum, for real. Started with 3 polos to test. Quality was spot-on.', n: 'Sophie Tremblay', c: 'Paysages Verts' } },
  { fr: { q: 'Le logo brodé sur les casquettes est incroyable. Mes clients me demandent où je les ai eues.', n: 'Karim Benoît', c: 'Plomberie Pro' }, en: { q: 'The embroidered logo on the caps is incredible. Clients ask me where I got them.', n: 'Karim Benoît', c: 'Plomberie Pro' } },
];

const INDUSTRIES = ['CONSTRUCTION', 'PAYSAGEMENT', 'PLOMBERIE', 'ÉLECTRICITÉ', 'TOITURE', 'SÉCURITÉ', 'TRANSPORT', 'EXCAVATION', 'MÉCANIQUE', 'PEINTURE'];

const BENTO_PRODUCTS = [
  { sku: 'ATC1000',  type: 'T-SHIRT',          name: 'T-shirt unisexe',           price: '4.15$',  handle: 'atc1000', img: 'https://cdn.shopify.com/s/files/1/0578/1038/7059/files/ATC1000-Devant.jpg?v=1770866927',  size: 'large' as const },
  { sku: 'S445',     type: 'POLO',             name: 'Polo performance',          price: '27.99$', handle: 's445-1',  img: 'https://cdn.shopify.com/s/files/1/0578/1038/7059/files/S445-Devant.jpg?v=1770866896',     size: 'large' as const },
  { sku: 'S445LS',   type: 'POLO MANCHES LONGUES', name: 'Polo manches longues',  price: '33.59$', handle: 's445ls-1', img: 'https://cdn.shopify.com/s/files/1/0578/1038/7059/files/S445LS-Devant.jpg?v=1770866896',  size: 'small' as const },
  { sku: 'L445',     type: 'POLO FEMME',        name: 'Polo femme',                price: '27.99$', handle: 'l445-1',   img: 'https://cdn.shopify.com/s/files/1/0578/1038/7059/files/L445-Devant.jpg?v=1770866896',    size: 'small' as const },
  { sku: '6245CM',   type: 'CASQUETTE',         name: 'Casquette dad vintage',     price: '11.54$', handle: '6245cm',   img: 'https://cdn.shopify.com/s/files/1/0578/1038/7059/files/IMG_5337.jpg?v=1777758336',     size: 'small' as const },
  { sku: 'C100',     type: 'TUQUE',             name: 'Tuque acrylique',           price: '4.50$',  handle: 'c100-1',   img: 'https://cdn.shopify.com/s/files/1/0578/1038/7059/files/IMG_5332.jpg?v=1777758336',     size: 'small' as const },
];

const HERO_IMG = 'https://cdn.shopify.com/s/files/1/0578/1038/7059/files/hf_20260130_190909_bf75301e-d22b-41a1-93d2-5bb932ac4df5_1.png?v=1769816240';

export default function Index() {
  const { lang } = useLang();
  useDocumentTitle(
    lang === 'en' ? 'Vision Affichage — Custom merch' : 'Vision Affichage — Merch d’entreprise personnalisé',
    lang === 'en'
      ? 'Vision Affichage — Custom merch for Québec businesses. 5-day turnaround, refunded if late, from 1 piece.'
      : 'Vision Affichage — Merch personnalisée pour entreprises du Québec. 5 jours ouvrables, remboursé si retard, à partir d’une pièce.',
    {},
  );
  const cart = useCartStore();
  const [cartOpen, setCartOpen] = useState(false);
  const [showGame, setShowGame] = useState(false);
  const [showLoader] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  const heroRef = useRef<HTMLElement>(null);
  const bentoRef = useRef<HTMLElement>(null);
  const processRef = useRef<HTMLElement>(null);
  const faqGroupRef = useRef<HTMLDivElement>(null);

  // GSAP timeline + scroll triggers. Respects prefers-reduced-motion via
  // the matchMedia branch — when reduced motion is requested, content
  // mounts at its final state and skips the entrance choreography.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out', duration: 0.6 } });
      tl.from('.hero-headline', { y: 24, opacity: 0 })
        .from('.hero-meta', { y: 16, opacity: 0, duration: 0.5 }, '-=0.4')
        .from('.hero-image-wrap', { scaleY: 0.94, opacity: 0, transformOrigin: 'top center' }, '-=0.35')
        .from('.hero-stats > *', { y: 12, opacity: 0, stagger: 0.08, duration: 0.4 }, '-=0.2');

      gsap.from('.bento-card', {
        scrollTrigger: { trigger: bentoRef.current, start: 'top 85%' },
        y: 18, opacity: 0, stagger: 0.07, duration: 0.5, ease: 'power2.out',
      });

      gsap.from('.process-step', {
        scrollTrigger: { trigger: processRef.current, start: 'top 80%' },
        x: -20, opacity: 0, stagger: 0.15, duration: 0.6, ease: 'power2.out',
      });

      gsap.utils.toArray<HTMLElement>('.section-reveal').forEach((s) => {
        gsap.from(s, {
          scrollTrigger: { trigger: s, start: 'top 88%' },
          y: 14, opacity: 0, duration: 0.55, ease: 'power2.out',
        });
      });

      document.querySelectorAll<HTMLElement>('[data-countup]').forEach((el) => {
        const target = parseInt(el.dataset.countup || '0', 10);
        const obj = { v: 0 };
        gsap.to(obj, {
          v: target,
          scrollTrigger: { trigger: el, start: 'top 90%' },
          duration: 1.4,
          ease: 'power2.inOut',
          onUpdate() {
            el.textContent = Math.round(obj.v).toLocaleString('fr-CA');
          },
        });
      });
    });

    return () => ctx.revert();
  }, []);

  // FAQ accordion — one-at-a-time open behaviour.
  useEffect(() => {
    const root = faqGroupRef.current;
    if (!root) return;
    const items = Array.from(root.querySelectorAll<HTMLDetailsElement>('details[data-faq-item]'));
    const onToggle = (e: Event) => {
      const t = e.target as HTMLDetailsElement;
      if (!t.open) return;
      items.forEach(d => { if (d !== t && d.open) d.open = false; });
    };
    items.forEach(d => d.addEventListener('toggle', onToggle));
    return () => items.forEach(d => d.removeEventListener('toggle', onToggle));
  }, [lang]);

  // Organization + LocalBusiness + FAQPage JSON-LD schemas.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const exists = document.head.querySelector('script[data-vision-org-ld]');
    if (exists) return;
    const orgSchema = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Vision Affichage',
      url: 'https://visionaffichage.com',
      logo: 'https://visionaffichage.com/logo.svg',
      telephone: '+1-367-380-4808',
      email: 'info@visionaffichage.com',
      address: { '@type': 'PostalAddress', addressLocality: 'Saint-Hyacinthe', addressRegion: 'QC', addressCountry: 'CA' },
      sameAs: ['https://instagram.com/visionaffichage', 'https://facebook.com/visionaffichage'],
    };
    const el = document.createElement('script');
    el.type = 'application/ld+json';
    el.dataset.visionOrgLd = 'true';
    el.text = JSON.stringify(orgSchema);
    document.head.appendChild(el);
    return () => { if (el.parentNode) document.head.removeChild(el); };
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (document.head.querySelector('script[data-faq-ld]')) return;
    const pairs = lang === 'en' ? FAQ_EN : FAQ_FR;
    const faqSchema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: pairs.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
    };
    const el = document.createElement('script');
    el.type = 'application/ld+json';
    el.dataset.faqLd = 'true';
    el.text = JSON.stringify(faqSchema);
    document.head.appendChild(el);
    return () => { if (el.parentNode) document.head.removeChild(el); };
  }, [lang]);

  const handleLoaderComplete = useCallback(() => {
    let alreadyPlayed = true;
    try {
      alreadyPlayed = typeof window !== 'undefined' && localStorage.getItem('moleGamePlayed') === 'true';
    } catch { /* noop */ }
    if (!alreadyPlayed) setTimeout(() => setShowGame(true), 650);
  }, []);

  const handleGameClose = (won: boolean) => {
    setShowGame(false);
    try { localStorage.setItem('moleGamePlayed', 'true'); } catch { /* noop */ }
    if (won) cart.applyDiscount('VISION10');
  };

  const FAQ = lang === 'en' ? FAQ_EN : FAQ_FR;

  return (
    <div id="main-content" tabIndex={-1} className="min-h-screen bg-va-paper pb-20 focus:outline-none">
      <Suspense fallback={null}>
        {showLoader && <IntroAnimation onComplete={handleLoaderComplete} />}
        {showGame && <MoleGame isOpen={showGame} onClose={handleGameClose} />}
      </Suspense>
      {loginOpen && (
        <Suspense fallback={null}>
          <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
        </Suspense>
      )}
      <Navbar onOpenCart={() => setCartOpen(true)} onOpenLogin={() => setLoginOpen(true)} />
      <Suspense fallback={null}>
        <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />
      </Suspense>

      {/* HERO — light editorial. Mega Prompt v4.0 §4. */}
      <section ref={heroRef} className="bg-va-paper pt-10 pb-16 md:pt-14 md:pb-20">
        <div className="max-w-[1400px] mx-auto px-6 md:px-16 lg:px-24">
          {/* A. Headline + meta band */}
          <div className="grid md:grid-cols-2 gap-8 items-end mb-10">
            <h1 className="hero-headline font-display font-extrabold text-va-ink text-[44px] md:text-[52px] leading-[0.98] tracking-[-0.04em] max-w-[460px]">
              {lang === 'en' ? (
                <>Kit your crew <span className="text-va-gold">this Friday.</span></>
              ) : (
                <>Habille ton équipe <span className="text-va-gold">ce vendredi.</span></>
              )}
            </h1>
            <div className="hero-meta md:text-right">
              <div className="text-[9px] font-bold tracking-[0.16em] uppercase text-va-muted mb-2">
                {lang === 'en' ? 'Already delivered in Quebec' : 'Déjà livrés au Québec'}
              </div>
              <div className="font-display font-extrabold text-[28px] tracking-[-0.03em] text-va-ink">
                <span data-countup="33000">33 000</span>+
              </div>
            </div>
          </div>

          {/* B. Hero image */}
          <div className="hero-image-wrap relative w-full overflow-hidden rounded-[4px] mb-5" style={{ height: 'min(46vw, 320px)' }}>
            <img
              src={HERO_IMG}
              alt={lang === 'en' ? 'Vision Affichage corporate merchandise' : 'Merchandising corporatif Vision Affichage'}
              loading="eager"
              decoding="async"
              {...{ fetchpriority: 'high' }}
              className="w-full h-full object-cover object-[center_25%]"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.background = '#F0EDE8'; }}
            />
            <div aria-hidden className="absolute bottom-3 right-4 text-[9px] tracking-[0.18em] uppercase text-white/40 font-semibold">
              VISIONAFFICHAGE.COM
            </div>
          </div>

          {/* C. Stats bar */}
          <div className="hero-stats border-t border-va-border pt-4 grid grid-cols-2 md:grid-cols-4 gap-6 items-center">
            <div>
              <div className="font-display font-extrabold text-[20px] tracking-[-0.03em] text-va-ink leading-none">5 jours</div>
              <div className="text-[9px] font-bold tracking-[0.16em] uppercase text-va-muted mt-2">
                {lang === 'en' ? 'Guaranteed delivery' : 'Livraison garantie'}
              </div>
            </div>
            <div>
              <div className="font-display font-extrabold text-[20px] tracking-[-0.03em] text-va-ink leading-none">
                <span data-countup="500">500</span>+
              </div>
              <div className="text-[9px] font-bold tracking-[0.16em] uppercase text-va-muted mt-2">
                {lang === 'en' ? 'Companies' : 'Entreprises'}
              </div>
            </div>
            <div>
              <div className="font-display font-extrabold text-[20px] tracking-[-0.03em] text-va-ink leading-none">1 pièce</div>
              <div className="text-[9px] font-bold tracking-[0.16em] uppercase text-va-muted mt-2">
                {lang === 'en' ? 'Minimum' : 'Minimum'}
              </div>
            </div>
            <Link
              to="/boutique"
              className="inline-flex items-center justify-center bg-va-gold hover:bg-va-gold-h text-va-ink font-bold text-[11px] tracking-[0.04em] px-5 py-3 rounded-[2px] transition-colors duration-150 hover:scale-[1.02] active:scale-[0.97]"
            >
              {lang === 'en' ? 'VIEW PRODUCTS →' : 'VOIR LES PRODUITS →'}
            </Link>
          </div>
        </div>
      </section>

      {/* INDUSTRIES MARQUEE */}
      <section aria-label={lang === 'en' ? 'Industries served' : 'Industries servies'} className="border-y border-va-border bg-va-paper py-3 overflow-hidden">
        <div className="flex w-max animate-[marqueeScroll_40s_linear_infinite] whitespace-nowrap">
          {[...INDUSTRIES, ...INDUSTRIES, ...INDUSTRIES].map((ind, i) => (
            <div key={i} className="px-6 text-[9px] font-semibold tracking-[0.2em] text-va-muted">
              {ind} <span className="text-va-ghost ml-6">·</span>
            </div>
          ))}
        </div>
      </section>

      {/* BENTO PRODUCTS */}
      <section ref={bentoRef} className="section-reveal bg-va-white px-6 md:px-16 lg:px-20 py-20">
        <div className="max-w-[1400px] mx-auto">
          <div className="flex items-end justify-between mb-8">
            <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-va-muted">
              {lang === 'en' ? 'Our products' : 'Nos produits'}
            </div>
            <Link to="/boutique" className="text-[11px] font-bold text-va-gold hover:text-va-gold-h tracking-[0.04em]">
              {lang === 'en' ? 'See all →' : 'Voir tout →'}
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {BENTO_PRODUCTS.map((p) => {
              const isLarge = p.size === 'large';
              return (
                <Link
                  key={p.sku}
                  to={`/product/${p.handle}`}
                  className={`bento-card group bg-va-warm hover:bg-[#e8e3dc] rounded-[3px] overflow-hidden transition-colors duration-150 ${isLarge ? 'md:col-span-2' : ''} ${isLarge ? 'border-b-2 border-va-gold' : ''}`}
                >
                  <div className="bg-va-paper flex items-center justify-center p-4" style={{ height: isLarge ? 170 : 120 }}>
                    <img
                      src={p.img}
                      alt={p.name}
                      loading="lazy"
                      decoding="async"
                      className="max-h-full max-w-full object-contain group-hover:scale-[1.04] transition-transform duration-300"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
                    />
                  </div>
                  <div className="p-3 md:p-3.5">
                    <div className="text-[8px] font-bold tracking-[0.14em] uppercase text-va-muted mb-1">
                      {p.type} · {p.sku}
                    </div>
                    <div className="font-display font-bold text-[12px] md:text-[13px] text-va-ink mb-1 leading-tight">
                      {p.name}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="font-mono font-bold text-[11px] text-va-ink">{p.price}</div>
                      <div className="text-[9px] font-bold tracking-[0.04em] text-va-gold uppercase">
                        {lang === 'en' ? 'Customize →' : 'Personnaliser →'}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* PROCESS — dark canvas, 01/02/03 */}
      <section ref={processRef} className="bg-va-dark text-white px-6 md:px-16 lg:px-24 py-20 md:py-28">
        <div className="max-w-[1400px] mx-auto">
          <div className="border-b border-white/8 pb-6 mb-12 flex flex-wrap items-end gap-4 justify-between">
            <h2 className="font-display font-extrabold text-[18px] md:text-[22px] tracking-[-0.025em] text-white">
              {lang === 'en' ? 'How it works' : 'Comment ça marche'}
            </h2>
            <div className="text-[9px] font-bold tracking-[0.18em] uppercase text-[#555]">
              {lang === 'en' ? 'ZERO FRICTION · ZERO SURPRISE' : 'ZÉRO FRICTION · ZÉRO SURPRISE'}
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-px bg-white/6">
            {[
              { n: '01', fr: { t: 'Tu envoies ton logo', b: 'PNG, SVG ou JPEG. Pas de brief. Pas de call.' }, en: { t: 'You send your logo', b: 'PNG, SVG, or JPEG. No brief. No call.' } },
              { n: '02', fr: { t: 'On imprime. Tu approuves rien.', b: 'Standards de l’industrie appliqués automatiquement.' }, en: { t: 'We print. You approve nothing.', b: 'Industry standards applied automatically.' } },
              { n: '03', fr: { t: 'Livré en 5 jours. Garanti.', b: 'Si retard d’une seule journée — remboursé sans questions.' }, en: { t: 'Delivered in 5 days. Guaranteed.', b: 'A single day late — refunded, no questions.' } },
            ].map((s) => {
              const c = lang === 'en' ? s.en : s.fr;
              return (
                <div key={s.n} className="process-step bg-va-dark p-8 md:p-10">
                  <div className="font-mono font-black text-[44px] md:text-[52px] text-va-gold leading-none mb-6">
                    {s.n}
                  </div>
                  <div className="font-display font-bold text-white text-[12px] md:text-[13px] mb-3 tracking-[-0.01em]">
                    {c.t}
                  </div>
                  <div className="text-[#666] text-[11px] leading-[1.55]">{c.b}</div>
                </div>
              );
            })}
          </div>
        </div>
        {/* Guarantee bar */}
        <div className="max-w-[1400px] mx-auto mt-10 bg-va-gold text-va-ink px-6 md:px-10 py-4 flex flex-wrap items-center justify-between gap-3 rounded-[2px]">
          <div className="text-[9px] md:text-[10px] font-bold tracking-[0.1em] uppercase">
            {lang === 'en' ? 'SATISFACTION GUARANTEED · 5 DAYS OR REFUNDED · FROM 1 PIECE' : 'SATISFACTION GARANTIE · 5 JOURS OU REMBOURSÉ · À PARTIR D’1 PIÈCE'}
          </div>
          <div className="text-[9px] md:text-[10px] font-bold tracking-[0.1em] uppercase">
            {lang === 'en' ? 'FREE SHIPPING OVER $300' : 'LIVRAISON GRATUITE DÈS 300$'}
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section className="section-reveal bg-va-white border-t border-va-border px-6 md:px-16 lg:px-24 py-20">
        <div className="max-w-[1400px] mx-auto">
          <div className="grid md:grid-cols-[auto_1fr] gap-8 md:gap-16 items-end mb-10">
            <div>
              <div className="font-mono font-black text-[52px] md:text-[64px] text-va-ink leading-none">5.0</div>
              <div className="text-va-gold text-xl mt-1" aria-hidden>★★★★★</div>
              <div className="text-[9px] font-bold tracking-[0.16em] uppercase text-va-muted mt-2">
                {lang === 'en' ? '50+ verified Google reviews' : '50+ avis Google vérifiés'}
              </div>
            </div>
            <div className="md:max-w-md md:text-right">
              <h2 className="font-display font-extrabold text-va-ink text-[22px] md:text-[26px] tracking-[-0.025em] leading-[1.1]">
                {lang === 'en' ? 'What entrepreneurs are saying' : 'Ce que les entrepreneurs disent'}
              </h2>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            {REVIEWS.map((r, i) => {
              const c = lang === 'en' ? r.en : r.fr;
              return (
                <article key={i} className="bg-va-warm rounded-[3px] p-4 md:p-5">
                  <div className="text-va-gold text-sm mb-3" aria-hidden>★★★★★</div>
                  <p className="text-va-dim text-[12px] italic leading-[1.55] mb-4">&ldquo;{c.q}&rdquo;</p>
                  <div className="text-[10px] font-bold tracking-[0.04em] uppercase text-va-ink">{c.n}</div>
                  <div className="text-[9px] tracking-[0.06em] uppercase text-va-muted">{c.c}</div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* FINALE CTA */}
      <section className="bg-va-dark text-white px-6 md:px-16 lg:px-24 py-20 md:py-24">
        <div className="max-w-[1400px] mx-auto grid md:grid-cols-[1fr_auto] gap-8 md:gap-12 items-end">
          <h2 className="font-display font-extrabold text-white text-[26px] md:text-[34px] leading-[1.08] tracking-[-0.025em]">
            {lang === 'en' ? (
              <>Every week without a uniform — that’s ad budget <span className="text-va-gold">wasted.</span></>
            ) : (
              <>Chaque semaine sans uniforme, c’est de la pub <span className="text-va-gold">perdue.</span></>
            )}
          </h2>
          <Link
            to="/boutique"
            className="inline-flex items-center justify-center bg-va-gold hover:bg-va-gold-h text-va-ink font-extrabold text-[10px] md:text-[11px] tracking-[0.06em] px-6 py-4 rounded-[2px] transition-colors duration-150 hover:scale-[1.02] active:scale-[0.97] whitespace-nowrap"
          >
            {lang === 'en' ? 'ORDER THIS FRIDAY →' : 'COMMANDER CE VENDREDI →'}
          </Link>
        </div>
        <div className="max-w-[1400px] mx-auto mt-8 text-[9px] font-semibold tracking-[0.16em] uppercase text-white/35">
          {lang === 'en' ? 'NO MINIMUM · 5-DAY GUARANTEE · REFUNDED IF LATE · SECURE SSL' : 'AUCUN MINIMUM · 5 JOURS GARANTIS · REMBOURSÉ SI RETARD · SSL SÉCURISÉ'}
        </div>
      </section>

      {/* FAQ */}
      <section className="section-reveal scroll-mt-20 py-16 px-6 md:px-10 border-t border-va-border bg-va-paper">
        <div className="max-w-[780px] mx-auto">
          <div className="text-center mb-10">
            <div className="text-[10px] font-bold tracking-[0.18em] uppercase text-va-muted mb-2">
              {lang === 'en' ? 'FAQ' : 'Questions fréquentes'}
            </div>
            <h2 className="font-display font-extrabold text-va-ink text-[26px] md:text-[30px] tracking-[-0.025em] leading-tight">
              {lang === 'en' ? 'Everything you need to know' : 'Tout ce que tu dois savoir'}
            </h2>
          </div>
          <style>{`
            .faq-group summary::-webkit-details-marker { display: none; }
            .faq-group summary::marker { content: ''; }
            .faq-group details[open] .faq-chevron { transform: rotate(180deg); }
          `}</style>
          <div ref={faqGroupRef} className="faq-group flex flex-col gap-2">
            {FAQ.map((item, i) => (
              <details
                key={i}
                data-faq-item
                className="group rounded-[3px] bg-va-white border border-va-border transition-colors hover:bg-va-warm/50"
              >
                <summary className="flex items-center justify-between gap-4 cursor-pointer list-none px-5 py-4 rounded-[3px] text-[13px] md:text-[14px] font-medium text-va-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-va-gold focus-visible:ring-offset-1">
                  <span>{item.q}</span>
                  <ChevronDown size={16} strokeWidth={2} aria-hidden className="faq-chevron flex-shrink-0 text-va-gold transition-transform duration-200" />
                </summary>
                <div className="px-5 pb-4 pt-0 text-[12px] text-va-dim leading-[1.65]">
                  {item.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Trust badges */}
      <section className="section-reveal border-t border-va-border py-8 px-6 md:px-10 bg-va-white">
        <div className="max-w-[1060px] mx-auto">
          <div className="flex items-center justify-center gap-2 mb-3 text-va-muted">
            <Lock size={11} strokeWidth={2} aria-hidden />
            <span className="text-[10px] font-bold tracking-[0.18em] uppercase">
              {lang === 'en' ? 'Secure payment' : 'Paiement sécurisé'}
            </span>
          </div>
          <ul className="flex flex-wrap items-center justify-center gap-2">
            {['VISA', 'Mastercard', 'AMEX', 'Apple Pay', 'Google Pay', 'Shopify'].map((p) => (
              <li key={p} className="inline-flex items-center h-[26px] px-3 rounded-[3px] border border-va-border bg-va-warm/40 text-[10px] font-bold tracking-[0.06em] text-va-muted uppercase">
                {p}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <SiteFooter />
      <AIChat />
      <BottomNav />
    </div>
  );
}
