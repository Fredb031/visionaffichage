import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';
import { CartDrawer } from '@/components/CartDrawer';
// MoleGame and IntroAnimation are one-off, first-visit chrome that
// most returning visitors never see — keep them out of the initial
// home-page bundle and fetch on demand.
import { lazy, Suspense } from 'react';
const MoleGame = lazy(() => import('@/components/MoleGame').then(m => ({ default: m.MoleGame })));
const IntroAnimation = lazy(() => import('@/components/IntroAnimation').then(m => ({ default: m.IntroAnimation })));
import { LoginModal } from '@/components/LoginModal';
import { TrustSignalsBar } from '@/components/TrustSignalsBar';
import { StepsTimeline } from '@/components/StepsTimeline';
import { DeliveryBadge } from '@/components/DeliveryBadge';
import { AIChat } from '@/components/AIChat';
import { FeaturedProducts } from '@/components/FeaturedProducts';
import { SiteFooter } from '@/components/SiteFooter';
import { SHOPIFY_STATS } from '@/data/shopifySnapshot';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Shirt, Brush, PackageCheck } from 'lucide-react';
import { useLang } from '@/lib/langContext';
import { useCartStore } from '@/stores/localCartStore';

const CDN = 'https://cdn.shopify.com/s/files/1/0578/1038/7059/files';

const HERO_LOGOS = [
  { src: `${CDN}/extreme-fab-coul.png?v=1763588020&width=400`, alt: 'Extreme Fab' },
  { src: `${CDN}/Sports-experts-coul.png?v=1763588020&width=400`, alt: 'Sports Experts' },
  { src: `${CDN}/E-Turgeon-Sport-coul.png?v=1763588020&width=400`, alt: 'E-Turgeon Sport' },
  { src: `${CDN}/Lacasse-coul.png?v=1763588020&width=400`, alt: 'Lacasse' },
  { src: `${CDN}/CFP-coul_0876cdef-2a96-4638-a3f3-d6b69f8d8fa0.png?v=1763588385&width=400`, alt: 'CFP' },
  { src: `${CDN}/Uni-coul.png?v=1763588020&width=400`, alt: 'Uni' },
  { src: `${CDN}/Parc-massif-coul.png?v=1763588020&width=400`, alt: 'Parc Massif' },
  { src: `${CDN}/Muni-Saint-Anselme-coul_2846d7c3-80a6-48da-a08b-ca99098aa62f.png?v=1763588679&width=400`, alt: 'Muni Saint-Anselme' },
];

const StarSvg = () => (
  <svg className="w-3 h-3 fill-accent" viewBox="0 0 24 24">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const GoogleIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

function useFadeIn() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Unobserve + disconnect as soon as the element has faded in — the
    // CSS keyframe is one-shot, so continuing to observe it burns a
    // callback on every scroll past for the life of the page. The long
    // home page has 10+ FadeIn nodes, so without this the observer
    // kept paying the cost on every scrollbar movement.
    const obs = new IntersectionObserver(
      (entries) => entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          obs.unobserve(e.target);
        }
      }),
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

function FadeIn({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useFadeIn();
  return <div ref={ref} className={`fi ${className}`}>{children}</div>;
}

export default function Index() {
  const { t, lang } = useLang();
  const cart = useCartStore();
  const [cartOpen, setCartOpen] = useState(false);
  const [showGame, setShowGame] = useState(false);
  const [showLoader, setShowLoader] = useState(true);
  const [loginOpen, setLoginOpen] = useState(false);
  const [heroStaggered, setHeroStaggered] = useState(false);
  const [playingVideo, setPlayingVideo] = useState<number | null>(null);

  // Track timers kicked off by the loader so route change (user clicks
  // through to /products before the game popup appears) doesn't fire
  // state updates on an unmounted page.
  const loaderTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  useEffect(() => {
    return () => {
      loaderTimersRef.current.forEach(t => clearTimeout(t));
      loaderTimersRef.current = [];
    };
  }, []);

  const handleLoaderComplete = useCallback(() => {
    setShowLoader(false);
    loaderTimersRef.current.push(setTimeout(() => setHeroStaggered(true), 100));
    // Auto-open the mini-game on first site visit only (once per browser).
    // Wrap in try/catch — a Safari private browsing window can throw on
    // localStorage.getItem and that uncaught error would break the loader
    // teardown before hero stagger finishes.
    let alreadyPlayed = true;
    try {
      alreadyPlayed = typeof window !== 'undefined' && localStorage.getItem('moleGamePlayed') === 'true';
    } catch { /* private mode — treat as "already seen" so the game doesn't pop repeatedly */ }
    if (!alreadyPlayed) {
      loaderTimersRef.current.push(setTimeout(() => setShowGame(true), 650));
    }
  }, []);

  const handleGameClose = (won: boolean) => {
    setShowGame(false);
    try {
      localStorage.setItem('moleGamePlayed', 'true');
    } catch {
      // Private browsing mode or quota — one-time game, not worth blocking on.
    }
    if (won) {
      cart.applyDiscount('VISION10');
    }
  };

  const allLogos = [...HERO_LOGOS, ...HERO_LOGOS];

  return (
    <div id="main-content" tabIndex={-1} className="min-h-screen bg-background pb-20 focus:outline-none">
      <Suspense fallback={null}>
        {showLoader && <IntroAnimation onComplete={handleLoaderComplete} />}
        {showGame && <MoleGame isOpen={showGame} onClose={handleGameClose} />}
      </Suspense>
      <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
      <Navbar onOpenCart={() => setCartOpen(true)} onOpenLogin={() => setLoginOpen(true)} />
      <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />

      {/* Hero */}
      <section className="min-h-dvh flex flex-col items-center justify-center text-center px-6 md:px-10 pt-[88px] pb-16 relative overflow-hidden">
        <div className="absolute top-[30%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, hsla(var(--navy), 0.08) 0%, transparent 70%)' }} />
        <div className={`relative z-[1] max-w-[920px] mx-auto ${heroStaggered ? '' : '[&>*]:opacity-0 [&>*]:translate-y-[18px]'}`}>
          {/* Kicker */}
          <div className={`mb-6 flex flex-col items-center gap-3 ${heroStaggered ? 'animate-[staggerUp_0.7s_0.05s_cubic-bezier(.16,1,.3,1)_forwards] opacity-0 translate-y-[18px]' : ''}`}>
            <DeliveryBadge size="md" />
            <p className="text-sm text-muted-foreground max-w-[600px] leading-relaxed">
              {t('kicker')}
            </p>
          </div>

          {/* H1 — editorial weight contrast: the verbs whisper (Lora italic
              300) so the two numerical promises ("3 minutes." / "5 days.")
              crash down in 800-weight sans. This is the one spot where
              Vision's pitch lives or dies, so the typography earns its
              drama here and stays quiet everywhere else on the page. The
              accent duration stays navy (text-primary) to keep brand
              palette intact. */}
          <h1 className={`text-[clamp(48px,7.5vw,92px)] leading-[0.92] tracking-[-3px] text-foreground mb-9 ${heroStaggered ? 'animate-[staggerUp_0.85s_0.18s_cubic-bezier(.16,1,.3,1)_forwards] opacity-0 translate-y-[18px]' : ''}`}>
            <span className="font-lora italic font-light text-[0.62em] tracking-[-0.5px] text-foreground/70 block mb-[-0.08em]">
              {t('h1line1')}
            </span>
            <span className="font-extrabold block">
              {t('h1line2')}
            </span>
            <span className="block text-primary">
              {(() => {
                // Split the accent line at the first digit so the numeric
                // promise ("5 days.") dominates while the lead-in verb
                // ("Received in" / "Reçue en") echoes the Lora whisper
                // above. Falls back gracefully if translation ever ships
                // without a digit.
                const raw = t('h1accent');
                const m = raw.match(/^(.*?)(\d.*)$/);
                if (!m) return <span className="font-extrabold">{raw}</span>;
                const [, lead, rest] = m;
                return (
                  <>
                    <span className="font-lora italic font-light text-[0.62em] tracking-[-0.5px] text-primary/75 mr-[0.18em]">
                      {lead.trim()}
                    </span>
                    <span className="font-extrabold">{rest}</span>
                  </>
                );
              })()}
            </span>
          </h1>

          {/* Metric strip — compact horizontal proof points directly
              under the H1 to translate the numeric promise into tangible
              credibility before the CTA. Uppercase wide-tracked caps +
              navy text with a gold star, matching the trust-signal
              typographic language used elsewhere on Index. */}
          <div className={`mb-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] md:text-[12px] font-semibold tracking-[2.5px] uppercase text-primary ${heroStaggered ? 'animate-[staggerUp_0.6s_0.28s_cubic-bezier(.16,1,.3,1)_forwards] opacity-0 translate-y-[10px]' : ''}`}>
            {lang === 'en' ? (
              <>
                <span>500+ companies</span>
                <span aria-hidden="true" className="text-primary/40">·</span>
                <span className="inline-flex items-center gap-1">4.9 <span className="text-accent">★</span></span>
                <span aria-hidden="true" className="text-primary/40">·</span>
                <span>5 business days</span>
                <span aria-hidden="true" className="text-primary/40">·</span>
                <span>Made in Québec</span>
              </>
            ) : (
              <>
                <span>500+ entreprises</span>
                <span aria-hidden="true" className="text-primary/40">·</span>
                <span className="inline-flex items-center gap-1">4,9 <span className="text-accent">★</span></span>
                <span aria-hidden="true" className="text-primary/40">·</span>
                <span>5 jours ouvrables</span>
                <span aria-hidden="true" className="text-primary/40">·</span>
                <span>Fabriqué au Québec</span>
              </>
            )}
          </div>

          {/* CTA */}
          <div className={heroStaggered ? 'animate-[staggerUp_0.7s_0.35s_cubic-bezier(.16,1,.3,1)_forwards] opacity-0 translate-y-[18px]' : ''}>
            <Link
              to="/products"
              className="inline-block text-[17px] font-extrabold text-primary-foreground gradient-navy-dark border-none px-14 py-[18px] rounded-full tracking-[-0.2px] mb-8 relative overflow-hidden cursor-pointer transition-shadow hover:shadow-[0_18px_48px_hsla(var(--navy),0.5)] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#E8A838]/60 focus-visible:ring-offset-2"
              style={{ boxShadow: '0 10px 32px hsla(var(--navy), 0.38)' }}
            >
              {t('heroCta')}
            </Link>
          </div>

          {/* Logo marquee — promoted ABOVE the "Aucun minimum" line per
              user feedback ("les logos en-dessus"). Reads visually as
              social proof → commitment pitch. */}
          <div className={`w-full max-w-[680px] mx-auto mt-6 mb-4 overflow-hidden relative ${heroStaggered ? 'animate-[staggerUp_0.7s_0.5s_cubic-bezier(.16,1,.3,1)_forwards] opacity-0 translate-y-[18px]' : ''}`}>
            <div className="absolute top-0 bottom-0 left-0 w-16 z-[2] pointer-events-none bg-gradient-to-r from-background to-transparent" />
            <div className="absolute top-0 bottom-0 right-0 w-16 z-[2] pointer-events-none bg-gradient-to-l from-background to-transparent" />
            <div className="flex w-max" style={{ animation: 'heroLogoScroll 24s linear infinite' }}>
              {allLogos.map((logo, i) => (
                <img
                  key={i}
                  src={logo.src}
                  alt={logo.alt}
                  width={128}
                  height={64}
                  loading={i < 4 ? 'eager' : 'lazy'}
                  decoding="async"
                  className="h-[64px] w-auto px-8 object-contain grayscale opacity-[0.45] hover:grayscale-0 hover:opacity-100 transition-all"
                  onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
                />
              ))}
            </div>
          </div>

          {/* "Aucun minimum + Receive by …" — sits directly under the
              marquee so the commitment (ETA) reads right after the social
              proof. Date is live: today + 5 business days (+1 if past
              the 3 pm cutoff, matching the Checkout ship-by promise). */}
          <p className={`text-[12px] text-foreground/80 font-semibold mb-4 ${heroStaggered ? 'animate-[staggerUp_0.6s_0.58s_cubic-bezier(.16,1,.3,1)_forwards] opacity-0 translate-y-[10px]' : ''}`}>
            {(() => {
              const now = new Date();
              const cutoff = new Date(now);
              cutoff.setHours(15, 0, 0, 0);
              const after3pm = now > cutoff;
              // Checkout shifts by +1 business day when the order rolls
              // past the 3pm production cutoff. Mirror that here so the
              // homepage promise doesn't under-quote by a day for late-
              // afternoon shoppers who then go to checkout and see a
              // later date.
              const eta = new Date(now);
              let added = 0;
              const target = after3pm ? 6 : 5;
              while (added < target) {
                eta.setDate(eta.getDate() + 1);
                const d = eta.getDay();
                if (d !== 0 && d !== 6) added++;
              }
              const fmtRaw = (l: 'fr-CA' | 'en-CA') =>
                eta.toLocaleDateString(l, { weekday: 'long', day: 'numeric', month: 'long' });
              // Capitalize first letter for visual polish — French
              // locale returns lowercase weekdays ("vendredi 24 avril")
              // but uppercased reads cleaner in a pill.
              const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
              const dateEn = cap(fmtRaw('en-CA'));
              const dateFr = cap(fmtRaw('fr-CA'));
              return lang === 'en'
                ? <>⚡ No minimum order · Ordered today, arriving <span className="text-[#0052CC]">{dateEn}</span></>
                : <>⚡ Aucun minimum · Commande aujourd'hui, reçu le <span className="text-[#0052CC]">{dateFr}</span></>;
            })()}
          </p>

          {/* Google row */}
          <div className={`flex items-center justify-center gap-2 ${heroStaggered ? 'animate-[staggerUp_0.6s_0.63s_cubic-bezier(.16,1,.3,1)_forwards] opacity-0 translate-y-[18px]' : ''}`}>
            <GoogleIcon />
            <div className="flex gap-0.5">
              {[...Array(5)].map((_, i) => <StarSvg key={i} />)}
            </div>
            <span className="text-[14px] font-bold text-foreground">{t('googleReviews')}</span>
          </div>
        </div>
      </section>

      {/* Trust signals — right below hero */}
      <TrustSignalsBar />

      {/* Featured products — grab attention right after trust */}
      <FeaturedProducts />

      {/* Steps timeline — gamified delivery journey */}
      <StepsTimeline />

      {/* Steps */}
      <FadeIn>
        <section className="gradient-navy-dark py-12 px-6 md:px-10">
          <div className="max-w-[1060px] mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-primary-foreground/[0.07] rounded-[18px] overflow-hidden">
              {[
                { n: '01', Icon: Shirt,         key: 'step1' as const },
                { n: '02', Icon: Brush,         key: 'step2' as const },
                { n: '03', Icon: PackageCheck,  key: 'step3' as const },
              ].map((step, i) => {
                const Icon = step.Icon;
                return (
                  <div key={i} className="bg-primary-foreground/[0.04] text-center py-10 px-7 transition-colors hover:bg-primary-foreground/[0.07]">
                    <div className="mx-auto mb-4 w-12 h-12 rounded-xl bg-primary-foreground/[0.08] flex items-center justify-center">
                      <Icon className="text-primary-foreground/80" size={22} strokeWidth={1.75} aria-hidden="true" />
                    </div>
                    <div className="text-[11px] font-extrabold tracking-[3px] text-primary-foreground/30 mb-2">{lang === 'en' ? 'STEP' : 'ÉTAPE'} {step.n}</div>
                    <div className="text-[18px] md:text-[22px] font-extrabold text-primary-foreground tracking-[-0.3px]">{t(step.key)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </FadeIn>

      {/* Stats Bar */}
      <FadeIn>
        <section className="border-b border-border">
          <div className="max-w-[1060px] mx-auto grid grid-cols-2 md:grid-cols-4">
            {[
              // Thin NBSP between '33' and '000+' so the number never
              // wraps mid-digit-group (French typography rule).
              { num: '33\u202F000+', key: 'produitLivres' as const },
              { num: lang === 'en' ? '5 days' : '5 jours',  key: 'delaiLivraison' as const },
              { num: '500+',     key: 'entreprisesSatisfaites' as const },
              { num: '5,0',      key: 'noteGoogle' as const },
            ].map((item, i) => (
              <div key={i} className="py-7 text-center border-r border-border last:border-r-0">
                <div className="text-[28px] font-extrabold text-primary">{item.num}</div>
                <div className="text-[12px] text-muted-foreground mt-1">{t(item.key)}</div>
              </div>
            ))}
          </div>
        </section>
      </FadeIn>

      {/* Sam's Story */}
      <FadeIn>
        <section className="py-20 px-6 md:px-10 max-w-[1060px] mx-auto">
          <div className="grid md:grid-cols-2 gap-[72px] items-center">
            <div>
              <div className="text-[11px] font-bold tracking-[2px] uppercase text-primary mb-3">
                {lang === 'en' ? 'Our story' : 'Notre histoire'}
              </div>
              <h2 className="text-[clamp(26px,3vw,38px)] font-extrabold tracking-[-0.5px] text-foreground leading-tight mb-[18px]">
                {lang === 'en' ? 'Why I founded Vision in 2021' : "Pourquoi j'ai fondé Vision en 2021"}
              </h2>
              <p className="text-[15px] text-muted-foreground leading-[1.8] mb-3.5">
                {lang === 'en'
                  ? <>I saw too many great businesses lose clients — not because they lacked talent, but because they <strong className="text-foreground">didn't project the image</strong> they deserved.</>
                  : <>{"J'ai vu trop souvent de bonnes entreprises perdre des clients — pas parce qu'elles manquaient de talent, mais parce qu'elles "}<strong className="text-foreground">{"ne donnaient pas l'image"}</strong>{" qu'elles méritaient."}</>}
              </p>
              <p className="text-[15px] text-muted-foreground leading-[1.8] mb-3.5">
                {lang === 'en'
                  ? "A poorly dressed team is a missed opportunity at every meeting. I created Vision so every entrepreneur can show up with confidence, from the very first glance."
                  : "Une équipe mal habillée, c'est une occasion manquée à chaque rencontre. J'ai créé Vision pour que chaque entrepreneur puisse se présenter avec confiance, dès le premier regard."}
              </p>
              <p className="text-[15px] text-muted-foreground leading-[1.8]">
                {lang === 'en'
                  ? <>{`Today, we've dressed over 500 teams. And with every order, it's the same conviction: `}<strong className="text-foreground">the image you project builds the reputation you deserve.</strong></>
                  : <>{"Aujourd'hui, on a habillé plus de 500 équipes. Et à chaque commande, c'est la même conviction : "}<strong className="text-foreground">{"l'image que tu projettes construit la réputation que tu mérites."}</strong></>}
              </p>
              <div className="font-lora text-[22px] italic text-primary mt-6">— Samuel</div>
              <div className="text-[12px] text-muted-foreground mt-[3px]">
                {lang === 'en' ? 'Founder, Vision Affichage' : 'Fondateur, Vision Affichage'}
              </div>
            </div>
            <div className="relative">
              <img
                src="https://cdn.shopify.com/s/files/1/0578/1038/7059/files/c85663f5-e0c1-43ce-a427-00852120bc46.jpg?v=1763532442&width=800"
                alt={lang === 'en' ? 'Samuel, founder of Vision Affichage' : 'Samuel, fondateur de Vision Affichage'}
                width={800}
                height={1000}
                loading="lazy"
                decoding="async"
                className="w-full rounded-[22px] aspect-[4/5] object-cover"
                onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
              />
              <div className="absolute bottom-[18px] left-[18px] right-[18px] bg-card/95 backdrop-blur-[10px] rounded-xl p-3.5 flex items-center gap-3">
                <div className="w-[38px] h-[38px] gradient-navy-dark rounded-[10px] flex items-center justify-center flex-shrink-0">
                  <svg className="w-[18px] h-[18px] stroke-primary-foreground fill-none" strokeWidth="1.5" strokeLinecap="round" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                </div>
                <div>
                  <div className="text-[12px] font-bold text-foreground">{lang === 'en' ? '+33,000 products delivered' : '+33\u202F000 produits livrés'}</div>
                  <div className="text-[11px] text-muted-foreground">{lang === 'en' ? 'Since 2021' : 'Depuis 2021'}</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </FadeIn>

      {/* Video Testimonials */}
      <FadeIn>
        <section className="bg-secondary border-t border-border py-[68px] px-6 md:px-10">
          <div className="max-w-[1060px] mx-auto">
            <div className="text-[11px] font-bold tracking-[2px] uppercase text-primary mb-2.5">
              {lang === 'en' ? 'Testimonials' : 'Témoignages'}
            </div>
            <h2 className="text-[clamp(24px,3vw,36px)] font-extrabold tracking-[-0.5px] text-foreground mb-8">
              {lang === 'en' ? 'They speak better than we do.' : 'Ils parlent mieux que nous.'}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {[
                { name: 'Anthony Ouellet', co: 'Sous Pression', img: `${CDN}/preview_images/f95a004374be46dba55baf59721ce807.thumbnail.0000000000.jpg?v=1770475023&width=600`, video: `${CDN}/f95a004374be46dba55baf59721ce807.HD-1080p-4.8Mbps-52069500.mp4` },
                { name: 'Hubert Cazes',    co: 'Perfocazes',   img: `${CDN}/preview_images/72a54f824d3d4139b646cc3e21e1371c.thumbnail.0000000000.jpg?v=1770474993&width=600`, video: `${CDN}/72a54f824d3d4139b646cc3e21e1371c.HD-1080p-4.8Mbps-52069480.mp4` },
                { name: 'Luca Jalbert',   co: "L'univers de Luca Jalbert", img: `${CDN}/preview_images/40a1dafa21da49eaa892ab5ed9929163.thumbnail.0000000000.jpg?v=1770579609&width=600`, video: `${CDN}/40a1dafa21da49eaa892ab5ed9929163.HD-1080p-4.8Mbps-52075605.mp4` },
              ].map((v, i) => {
                const isPlaying = playingVideo === i;
                return (
                  <div key={i} className="bg-card border border-border rounded-[18px] overflow-hidden transition-all hover:-translate-y-[3px] hover:shadow-[0_16px_40px_rgba(0,0,0,0.09)] group">
                    <div className="aspect-[9/12] relative bg-foreground overflow-hidden">
                      {isPlaying ? (
                        <video
                          src={v.video}
                          poster={v.img}
                          controls
                          autoPlay
                          playsInline
                          onEnded={() => setPlayingVideo(null)}
                          className="w-full h-full object-cover bg-black"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPlayingVideo(i)}
                          className="absolute inset-0 w-full h-full border-none p-0 cursor-pointer group/play focus:outline-none focus-visible:ring-4 focus-visible:ring-[#0052CC] focus-visible:ring-inset"
                          aria-label={lang === 'en' ? `Play video testimonial from ${v.name}` : `Lire le témoignage vidéo de ${v.name}`}
                        >
                          <img src={v.img} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover opacity-[0.85] transition-opacity group-hover:opacity-100" onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-[56px] h-[56px] bg-white/95 rounded-full flex items-center justify-center transition-transform group-hover/play:scale-110 shadow-xl">
                              <svg className="w-[20px] h-[20px] fill-primary ml-[3px]" viewBox="0 0 24 24" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                            </div>
                          </div>
                        </button>
                      )}
                    </div>
                    <div className="p-3.5 px-4">
                      <div className="text-[13px] font-bold text-foreground">{v.name}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{v.co}</div>
                      <div className="flex gap-0.5 mt-[7px]" role="img" aria-label={lang === 'en' ? '5 out of 5 stars' : '5 étoiles sur 5'}>
                        {[...Array(5)].map((_, j) => <StarSvg key={j} />)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </FadeIn>

      {/* Reviews */}
      <FadeIn>
        <section className="py-[68px] px-6 md:px-10 border-t border-border">
          <div className="max-w-[1060px] mx-auto">
            <div className="flex items-center gap-[22px] mb-[26px] flex-wrap">
              <div className="text-center">
                <div className="text-[48px] font-extrabold text-primary leading-none">5,0</div>
                <div className="flex gap-[3px] justify-center my-1">{[...Array(5)].map((_, i) => <StarSvg key={i} />)}</div>
                <div className="text-[11px] text-muted-foreground">{lang === 'en' ? '41 reviews' : '41 avis'}</div>
              </div>
              <div className="w-px h-14 bg-border" />
              <div>
                <h3 className="text-xl font-extrabold text-foreground">
                  {lang === 'en' ? 'What our clients say' : 'Ce que nos clients disent'}
                </h3>
                <p className="text-[13px] text-muted-foreground mt-0.5">
                  {lang === 'en' ? 'Quebec entrepreneurs · Real reviews' : 'Entrepreneurs québécois · Avis réels'}
                </p>
                <div className="flex items-center gap-1.5 mt-[7px]">
                  <GoogleIcon />
                  <span className="text-[12px] font-bold text-primary">
                    {lang === 'en' ? 'Verified Google reviews' : 'Avis Google vérifiés'}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide md:grid md:grid-cols-3 md:overflow-visible">
              {[
                { init: 'SL', name: 'Samuel Lacroix',           date: lang === 'en' ? '2 months ago' : 'Il y a 2 mois', color: '#1B3A6B', txt: lang === 'en' ? '"Amazing service! Great quality and super fast. Highly recommend for any business wanting to look professional."' : '"Super service! Très bonne qualité et super rapide! Je recommande fortement à toutes les entreprises qui veulent avoir l\'air professionnel."' },
                { init: 'WB', name: 'William Barry',             date: lang === 'en' ? '3 months ago' : 'Il y a 3 mois', color: '#1a3d2e', txt: lang === 'en' ? '"I highly recommend Vision Affichage! Fast, courteous service. A true professional who understands SMB needs."' : '"Je recommande fortement Vision Affichage! Service très rapide, courtois. Un vrai professionnel qui comprend les besoins d\'une PME."' },
                { init: 'JP', name: 'Jean-Philippe N.-L.',       date: lang === 'en' ? '4 months ago' : 'Il y a 4 mois', color: '#5f1f1f', txt: lang === 'en' ? '"Great service, dynamic team. Just as good for custom orders as large corporate orders. I recommend!"' : '"Super bon service, équipe dynamique. Aussi bon pour les commandes custom que les grosses commandes entreprises. Je recommande!"' },
                { init: 'MC', name: 'Marie-Claude Tremblay',     date: lang === 'en' ? '5 months ago' : 'Il y a 5 mois', color: '#4C1D95', txt: lang === 'en' ? '"We ordered hoodies for our whole team and the result was impeccable. Fast delivery, premium quality. Will reorder!"' : '"On a commandé des hoodies pour toute notre équipe et le résultat était impeccable. Livraison rapide, qualité premium. On recommande!"' },
                { init: 'PD', name: 'Patrick Dubois',            date: lang === 'en' ? '6 months ago' : 'Il y a 6 mois', color: '#0F2341', txt: lang === 'en' ? '"Excellent experience from A to Z. The customizer tool is brilliant and the final product exceeded expectations."' : '"Excellente expérience du début à la fin. L\'outil de personnalisation est génial et le produit final a dépassé nos attentes."' },
                { init: 'AB', name: 'Audrey Bergeron',           date: lang === 'en' ? '7 months ago' : 'Il y a 7 mois', color: '#6B1B1B', txt: lang === 'en' ? '"Perfect for our construction company. Tough quality, quick turnaround, competitive prices. Our go-to for all our merch."' : '"Parfait pour notre compagnie de construction. Qualité solide, délai rapide, prix compétitifs. Notre référence pour tout notre merch."' },
              ].map((r, i) => (
                <div key={i} className="min-w-[280px] md:min-w-0 snap-start bg-secondary border border-border rounded-2xl p-[18px] px-5 flex-shrink-0">
                  <div className="flex items-center gap-2.5 mb-2.5">
                    <div className="w-[36px] h-[36px] rounded-full flex items-center justify-center text-[12px] font-extrabold text-primary-foreground flex-shrink-0" style={{ background: r.color }}>{r.init}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-bold text-foreground truncate">{r.name}</div>
                      <div className="text-[11px] text-muted-foreground mt-px">{r.date}</div>
                    </div>
                    <GoogleIcon />
                  </div>
                  <div className="flex gap-0.5 mb-2">{[...Array(5)].map((_, j) => <StarSvg key={j} />)}</div>
                  <p className="text-[13px] text-muted-foreground leading-relaxed">{r.txt}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </FadeIn>

      {/* Logo Marquee — after reviews */}
      <FadeIn>
        <section className="border-t border-b border-border py-7 overflow-hidden bg-background">
          <div className="text-center text-[11px] font-bold tracking-[2.5px] uppercase text-muted-foreground mb-5">
            {lang === 'en' ? 'Companies that trust us' : 'Des entreprises qui nous font confiance'}
          </div>
          <div className="overflow-hidden relative">
            <div className="absolute top-0 bottom-0 left-0 w-20 z-[2] pointer-events-none bg-gradient-to-r from-background to-transparent" />
            <div className="absolute top-0 bottom-0 right-0 w-20 z-[2] pointer-events-none bg-gradient-to-l from-background to-transparent" />
            <div className="flex gap-0 w-max" style={{ animation: 'marqueeScroll 28s linear infinite' }}>
              {[...HERO_LOGOS, ...HERO_LOGOS].map((logo, i) => (
                <div key={i} className="px-10 flex items-center justify-center h-[88px]">
                  <img
                    src={logo.src}
                    alt={logo.alt}
                    width={128}
                    height={64}
                    loading="lazy"
                    decoding="async"
                    className="h-[64px] w-auto object-contain grayscale opacity-[0.40] hover:grayscale-0 hover:opacity-100 transition-all"
                    onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      </FadeIn>

      {/* Footer CTA */}
      <FadeIn>
        <section className="py-20 px-6 md:px-10 text-center">
          <div className="inline-flex items-center gap-2 text-[12px] font-bold tracking-[1.5px] uppercase border rounded-full px-[18px] py-[7px] mb-[18px]" style={{ color: 'hsl(var(--gold))', background: 'hsla(var(--gold), 0.12)', borderColor: 'hsla(var(--gold), 0.2)' }}>
            <svg className="w-3.5 h-3.5 stroke-accent fill-none" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z"/></svg>
            {lang === 'en' ? 'Delivered in 5 business days' : 'Livré en 5 jours ouvrables'}
          </div>
          <h2 className="text-[clamp(34px,5vw,58px)] font-extrabold tracking-[-2px] text-foreground mb-[13px] leading-none">
            {lang === 'en' ? <>Your brand image<br />starts here.</> : <>{"L'image de ta marque"}<br />commence ici.</>}
          </h2>
          <p className="text-[15px] text-muted-foreground mb-[34px]">
            {lang === 'en' ? 'No minimum · 1-year quality guarantee · 5 business days' : 'Aucun minimum · Qualité garantie 1 an · 5 jours ouvrables'}
          </p>
          <Link
            to="/products"
            className="text-[17px] font-extrabold text-primary-foreground gradient-navy-dark border-none px-14 py-[18px] rounded-full cursor-pointer transition-all hover:-translate-y-0.5 inline-block focus:outline-none focus-visible:ring-4 focus-visible:ring-[#E8A838]/60 focus-visible:ring-offset-2"
            style={{ boxShadow: '0 10px 32px hsla(var(--navy), 0.38)' }}
          >
            {t('heroCta')}
          </Link>
        </section>
      </FadeIn>

      <SiteFooter />

      <AIChat />
      <BottomNav />
    </div>
  );
}
