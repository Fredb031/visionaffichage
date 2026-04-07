import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';
import { CartDrawer } from '@/components/CartDrawer';
import { MoleGame } from '@/components/MoleGame';
import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

const avatarColors = ['#1B3A6B', '#1a3d2e', '#5f1f1f', '#6b6b6b'];
const avatarInitials = ['SL', 'WB', 'JP', 'AO'];

const StarSvg = () => (
  <svg className="w-3.5 h-3.5 fill-accent" viewBox="0 0 24 24">
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
    const obs = new IntersectionObserver(
      (entries) => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in'); }),
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
  const [cartOpen, setCartOpen] = useState(false);
  const [showGame, setShowGame] = useState(false);
  const [showLoader, setShowLoader] = useState(true);

  useEffect(() => {
    const hasPlayed = sessionStorage.getItem('moleGamePlayed');
    const timer = setTimeout(() => {
      setShowLoader(false);
      if (!hasPlayed) setShowGame(true);
    }, 2200);
    return () => clearTimeout(timer);
  }, []);

  const handleGameClose = (won: boolean) => {
    setShowGame(false);
    sessionStorage.setItem('moleGamePlayed', 'true');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Loader */}
      {showLoader && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-7 transition-opacity duration-600" style={{ background: 'hsl(218 62% 16%)' }}>
          <div className="opacity-0 animate-[lIn_0.7s_0.4s_cubic-bezier(.34,1.4,.64,1)_forwards] translate-y-2.5">
            <img
              src="https://visionaffichage.com/cdn/shop/files/Logo-vision-horizontal-blanc.png?height=135&v=1694121209"
              alt="Vision"
              className="h-10"
            />
            <div className="text-[11px] font-semibold tracking-[3px] uppercase text-primary-foreground/25 mt-2.5">Merch d'entreprise</div>
          </div>
          <div className="w-[180px] h-[1.5px] bg-primary-foreground/10 rounded overflow-hidden">
            <div className="h-full rounded" style={{ background: 'linear-gradient(90deg, hsl(var(--gold)), #F5C842)', animation: 'lFill 1.5s 0.6s ease forwards', width: 0 }} />
          </div>
        </div>
      )}

      <MoleGame isOpen={showGame} onClose={handleGameClose} />
      <Navbar onOpenCart={() => setCartOpen(true)} />
      <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />

      {/* Hero */}
      <section className="min-h-screen flex flex-col items-center justify-center text-center px-6 md:px-10 pt-[88px] pb-16 relative overflow-hidden">
        <div className="absolute top-[30%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, hsla(var(--navy), 0.07) 0%, transparent 70%)' }} />
        <div className="relative z-[1] max-w-[900px] mx-auto">
          <FadeIn>
            {/* Google rating row */}
            <div className="flex items-center justify-center gap-2 mb-7">
              <div className="flex items-center gap-0.5">
                {[...Array(5)].map((_, i) => <StarSvg key={i} />)}
              </div>
              <span className="text-[12px] font-bold text-muted-foreground">5,0 sur Google</span>
              <span className="text-border text-sm">·</span>
              <span className="text-[12px] font-bold text-muted-foreground">+500 entreprises satisfaites</span>
            </div>
          </FadeIn>

          <FadeIn>
            <h1 className="text-[clamp(42px,6.5vw,80px)] font-extrabold leading-[0.97] tracking-[-2.5px] text-foreground mb-0">
              Tes clients te voient<br />avant de t'entendre.
              <span className="block text-primary">Soigne ce qu'ils voient.</span>
            </h1>
          </FadeIn>

          <FadeIn>
            <p className="text-base text-muted-foreground leading-[1.75] max-w-[480px] mt-5 mb-9 mx-auto">
              Commande en 3 minutes. Reçois en 5 jours ouvrables. Ton équipe habillée à l'image de ta marque — sans minimum, sans complication.
            </p>
          </FadeIn>

          <FadeIn>
            <Link
              to="/products"
              className="text-[17px] font-extrabold text-primary-foreground gradient-navy-dark border-none px-[52px] py-[18px] rounded-full cursor-pointer transition-all tracking-[-0.2px] mb-7 inline-block hover:-translate-y-0.5"
              style={{ boxShadow: '0 10px 32px hsla(var(--navy), 0.38)' }}
            >
              Voir les produits
            </Link>
          </FadeIn>

          <FadeIn>
            <div className="flex items-center justify-center gap-3">
              <div className="flex">
                {avatarInitials.map((init, i) => (
                  <div
                    key={i}
                    className="w-[31px] h-[31px] rounded-full border-[2.5px] border-background flex items-center justify-center text-[10px] font-extrabold text-primary-foreground"
                    style={{ marginLeft: i > 0 ? '-9px' : 0, backgroundColor: avatarColors[i] }}
                  >
                    {init}
                  </div>
                ))}
              </div>
              <div className="text-left">
                <div className="flex gap-0.5 mb-0.5">
                  {[...Array(5)].map((_, i) => <StarSvg key={i} />)}
                </div>
                <div className="text-[12px] text-muted-foreground">Noté 5/5 · 41 avis vérifiés</div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Steps */}
      <FadeIn>
        <section className="gradient-navy-dark py-[68px] px-6 md:px-10">
          <div className="max-w-[1060px] mx-auto">
            <div className="text-[11px] font-bold tracking-[3px] text-primary-foreground/25 uppercase mb-2.5">Processus</div>
            <h2 className="text-[clamp(28px,4vw,44px)] font-extrabold text-primary-foreground tracking-[-1px] mb-12 leading-[1.05]">
              Trois étapes.<br /><em className="text-primary-foreground/28 not-italic">C'est tout.</em>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-primary-foreground/7 rounded-[18px] overflow-hidden">
              {[
                { n: '01', title: 'Choisis ton produit', desc: 'T-shirt, hoodie, casquette, manteau. Sélectionne la couleur et la quantité. Aucun minimum.', icon: (
                  <svg className="w-[22px] h-[22px] stroke-primary-foreground/70 fill-none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.57a1 1 0 00.99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 002-2V10h2.15a1 1 0 00.99-.84l.58-3.57a2 2 0 00-1.34-2.23z"/></svg>
                )},
                { n: '02', title: 'Upload ton logo', desc: "On enlève le fond et convertit en SVG automatiquement. Aperçu en direct sur le produit.", icon: (
                  <svg className="w-[22px] h-[22px] stroke-primary-foreground/70 fill-none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                )},
                { n: '03', title: 'Reçois en 5 jours', desc: "On imprime, on emballe, on expédie. Livraison en 5 jours ouvrables. Qualité garantie 1 an.", icon: (
                  <svg className="w-[22px] h-[22px] stroke-primary-foreground/70 fill-none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                )},
              ].map((step, i) => (
                <div key={i} className="bg-primary-foreground/[0.04] p-8 transition-colors hover:bg-primary-foreground/[0.07]">
                  <div className="text-[10px] font-extrabold tracking-[2.5px] text-primary-foreground/20 mb-[18px]">{step.n} —</div>
                  <div className="w-11 h-11 bg-primary-foreground/[0.08] rounded-xl flex items-center justify-center mx-auto mb-4">
                    {step.icon}
                  </div>
                  <div className="text-base font-bold text-primary-foreground mb-[7px]">{step.title}</div>
                  <div className="text-[13px] text-primary-foreground/[0.42] leading-relaxed">{step.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </FadeIn>

      {/* Stats Bar */}
      <FadeIn>
        <section className="border-b border-border">
          <div className="max-w-[1060px] mx-auto grid grid-cols-2 md:grid-cols-4">
            {[
              { num: '33K+', label: 'Produits livrés', icon: <svg className="w-4 h-4 stroke-accent fill-none" strokeWidth="1.5" strokeLinecap="round" viewBox="0 0 24 24"><path d="M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zM1 7l3-4h16l3 4"/></svg> },
              { num: '5 jours', label: 'Délai de livraison', icon: <svg className="w-4 h-4 stroke-accent fill-none" strokeWidth="1.5" strokeLinecap="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> },
              { num: '500+', label: 'Entreprises satisfaites', icon: <svg className="w-4 h-4 stroke-accent fill-none" strokeWidth="1.5" strokeLinecap="round" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg> },
              { num: '5,0', label: 'Note Google', icon: <svg className="w-4 h-4 stroke-accent fill-none" strokeWidth="1.5" strokeLinecap="round" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> },
            ].map((item, i) => (
              <div key={i} className="py-7 text-center border-r border-border last:border-r-0 flex flex-col items-center gap-1.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'hsla(var(--gold), 0.12)' }}>
                  {item.icon}
                </div>
                <div className="text-[28px] font-extrabold text-primary">{item.num}</div>
                <div className="text-[12px] text-muted-foreground">{item.label}</div>
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
              <div className="text-[11px] font-bold tracking-[2px] uppercase text-primary mb-3">Notre histoire</div>
              <h2 className="text-[clamp(26px,3vw,38px)] font-extrabold tracking-[-0.5px] text-foreground leading-tight mb-[18px]">
                Pourquoi j'ai fondé Vision en 2021
              </h2>
              <p className="text-[15px] text-muted-foreground leading-[1.8] mb-3.5">
                J'ai vu trop souvent de bonnes entreprises perdre des clients — pas parce qu'elles manquaient de talent, mais parce qu'elles <strong className="text-foreground">ne donnaient pas l'image</strong> qu'elles méritaient.
              </p>
              <p className="text-[15px] text-muted-foreground leading-[1.8] mb-3.5">
                Une équipe mal habillée, c'est une occasion manquée à chaque rencontre. J'ai créé Vision pour que chaque entrepreneur puisse se présenter avec confiance, dès le premier regard.
              </p>
              <p className="text-[15px] text-muted-foreground leading-[1.8]">
                Aujourd'hui, on a habillé plus de 500 équipes. Et à chaque commande, c'est la même conviction : <strong className="text-foreground">l'image que tu projettes construit la réputation que tu mérites.</strong>
              </p>
              <div className="font-lora text-[22px] italic text-primary mt-6">— Samuel</div>
              <div className="text-[12px] text-muted-foreground mt-[3px]">Fondateur, Vision Affichage</div>
            </div>

            <div className="relative">
              <img
                src="https://visionaffichage.com/cdn/shop/files/c85663f5-e0c1-43ce-a427-00852120bc46.jpg?v=1763532442&width=800"
                alt="Vision Affichage"
                className="w-full rounded-[22px] aspect-[4/5] object-cover"
              />
              <div className="absolute bottom-[18px] left-[18px] right-[18px] bg-card/95 backdrop-blur-[10px] rounded-xl p-3.5 flex items-center gap-3">
                <div className="w-[38px] h-[38px] gradient-navy-dark rounded-[10px] flex items-center justify-center flex-shrink-0">
                  <svg className="w-[18px] h-[18px] stroke-primary-foreground fill-none" strokeWidth="1.5" strokeLinecap="round" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                </div>
                <div>
                  <div className="text-[12px] font-bold text-foreground">+33 000 produits livrés</div>
                  <div className="text-[11px] text-muted-foreground">Depuis 2021</div>
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
            <div className="text-[11px] font-bold tracking-[2px] uppercase text-primary mb-2.5">Témoignages</div>
            <h2 className="text-[clamp(24px,3vw,36px)] font-extrabold tracking-[-0.5px] text-foreground mb-8">
              Ils parlent mieux que nous.
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {[
                { name: 'Anthony Ouellet', co: 'Sous Pression', img: 'https://visionaffichage.com/cdn/shop/files/preview_images/f95a004374be46dba55baf59721ce807.thumbnail.0000000000.jpg?v=1770475023&width=600' },
                { name: 'Hubert Cazes', co: 'Perfocazes', img: 'https://visionaffichage.com/cdn/shop/files/preview_images/72a54f824d3d4139b646cc3e21e1371c.thumbnail.0000000000.jpg?v=1770474993&width=600' },
                { name: 'Luca Jalbert', co: "L'univers de Luca Jalbert", img: 'https://visionaffichage.com/cdn/shop/files/preview_images/40a1dafa21da49eaa892ab5ed9929163.thumbnail.0000000000.jpg?v=1770579609&width=600' },
              ].map((t, i) => (
                <div key={i} className="bg-card border border-border rounded-[18px] overflow-hidden cursor-pointer transition-all hover:-translate-y-[3px] hover:shadow-[0_16px_40px_rgba(0,0,0,0.09)] group">
                  <div className="aspect-[9/12] relative bg-foreground overflow-hidden">
                    <img src={t.img} alt={t.name} className="w-full h-full object-cover opacity-[0.85] transition-opacity group-hover:opacity-100" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-[52px] h-[52px] bg-card/[0.94] rounded-full flex items-center justify-center transition-transform group-hover:scale-110">
                        <svg className="w-[18px] h-[18px] fill-primary ml-[3px]" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                      </div>
                    </div>
                  </div>
                  <div className="p-3.5 px-4">
                    <div className="text-[13px] font-bold text-foreground">{t.name}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{t.co}</div>
                    <div className="flex gap-0.5 mt-[7px]">
                      {[...Array(5)].map((_, j) => <StarSvg key={j} />)}
                    </div>
                  </div>
                </div>
              ))}
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
                <div className="flex gap-[3px] justify-center my-1">
                  {[...Array(5)].map((_, i) => <StarSvg key={i} />)}
                </div>
                <div className="text-[11px] text-muted-foreground">41 avis</div>
              </div>
              <div className="w-px h-14 bg-border" />
              <div>
                <h3 className="text-xl font-extrabold text-foreground">Ce que nos clients disent</h3>
                <p className="text-[13px] text-muted-foreground mt-0.5">Entrepreneurs québécois · Avis réels</p>
                <div className="flex items-center gap-1.5 mt-[7px]">
                  <GoogleIcon />
                  <span className="text-[12px] font-bold text-primary">Avis Google vérifiés</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { init: 'SL', name: 'Samuel Lacroix', date: 'Il y a 2 mois', color: '#1B3A6B', txt: '"Super service! Très bonne qualité et super rapide! Je recommande fortement à toutes les entreprises qui veulent avoir l\'air professionnel."' },
                { init: 'WB', name: 'William Barry', date: 'Il y a 3 mois', color: '#1a3d2e', txt: '"Je recommande fortement Vision Affichage! Service très rapide, courtois. Un vrai professionnel qui comprend les besoins d\'une PME."' },
                { init: 'JP', name: 'Jean-Philippe N.-Langevin', date: 'Il y a 4 mois', color: '#5f1f1f', txt: '"Super bon service, équipe dynamique. Aussi bon pour les commandes custom que les grosses commandes entreprises. Je recommande!"' },
              ].map((r, i) => (
                <div key={i} className="bg-secondary border border-border rounded-2xl p-[18px] px-5">
                  <div className="flex items-center gap-2.5 mb-2.5">
                    <div className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-[12px] font-extrabold text-primary-foreground flex-shrink-0" style={{ background: r.color }}>{r.init}</div>
                    <div>
                      <div className="text-[13px] font-bold text-foreground">{r.name}</div>
                      <div className="text-[11px] text-muted-foreground mt-px">{r.date}</div>
                    </div>
                    <svg className="ml-auto flex-shrink-0" width="13" height="13" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                  </div>
                  <div className="flex gap-0.5 mb-2">
                    {[...Array(5)].map((_, j) => <StarSvg key={j} />)}
                  </div>
                  <p className="text-[13px] text-muted-foreground leading-relaxed">{r.txt}</p>
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
            <svg className="w-3.5 h-3.5 stroke-accent fill-none" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            Rabais 10% disponible — Joue le mini-jeu
          </div>
          <h2 className="text-[clamp(34px,5vw,58px)] font-extrabold tracking-[-2px] text-foreground mb-[13px] leading-none">
            L'image de ta marque<br />commence ici.
          </h2>
          <p className="text-[15px] text-muted-foreground mb-[34px]">
            Aucun minimum · Qualité garantie 1 an · 5 jours ouvrables
          </p>
          <Link
            to="/products"
            className="text-[17px] font-extrabold text-primary-foreground gradient-navy-dark border-none px-[52px] py-[18px] rounded-full cursor-pointer transition-all hover:-translate-y-0.5 inline-block"
            style={{ boxShadow: '0 10px 32px hsla(var(--navy), 0.38)' }}
          >
            Voir les produits
          </Link>
        </section>
      </FadeIn>

      {/* Footer */}
      <footer className="border-t border-border px-6 md:px-10 py-7 flex flex-col md:flex-row items-center justify-between gap-4">
        <img
          src="https://visionaffichage.com/cdn/shop/files/Asset_1_d5d82510-0b83-4657-91b7-3ac1992ee697.svg?height=90&v=1769614651"
          alt="Vision"
          className="h-5 opacity-35"
        />
        <div className="flex gap-6">
          <Link to="/products" className="text-[12px] text-muted-foreground hover:text-foreground transition-colors">Produits</Link>
          <a className="text-[12px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer">Contact</a>
          <a href="tel:+13673804808" className="text-[12px] text-muted-foreground hover:text-foreground transition-colors">367-380-4808</a>
        </div>
        <span className="text-[12px] text-muted-foreground">© {new Date().getFullYear()} Vision Affichage</span>
      </footer>

      <BottomNav />
    </div>
  );
}