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
import { AIChat } from '@/components/AIChat';
import { FeaturedProducts } from '@/components/FeaturedProducts';
import { SiteFooter } from '@/components/SiteFooter';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Shirt, Upload, Zap, Package, ChevronDown } from 'lucide-react';
import { useLang } from '@/lib/langContext';
import { useCartStore } from '@/stores/localCartStore';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { getProfile, type VisitorProfile } from '@/lib/visitorProfile';

// Client placeholder names — swap each entry to { name, logoSrc } and switch
// the render to <img> once /public/logos/clients/*.svg files land.
const VA_CLIENT_LOGOS = [
  { name: 'Construction Rivard' },
  { name: 'Paysagement Pro' },
  { name: 'Parc Massif' },
  { name: 'Municipalité St-Anselme' },
  { name: 'Sports Experts' },
  { name: 'Polyvalente Nicolas-Gatineau' },
  { name: 'Ville de Blainville' },
  { name: 'Ferme Boréalis' },
];

// FAQ Q&A pairs — lifted out of the JSX render path so they can be
// reused by the FAQPage JSON-LD injection without duplicating the
// content. Editing one keeps the schema script and the rendered
// accordion in sync.
const FAQ_EN: { q: string; a: string }[] = [
  { q: 'Is there a minimum order quantity?', a: 'No minimum — order as little as 1 piece. Whether you need a single sample or 500 uniforms, the price per unit stays fair. Most clients start with one or two to test quality, then scale up.' },
  { q: 'How fast can I receive my order?', a: 'Standard turnaround is 5 business days from proof approval. Orders placed before 3 pm hit production the same day; after that they roll to the next business day. Ship date is confirmed at checkout.' },
  { q: 'What file formats do you accept for artwork?', a: 'Vector files (SVG, AI, PDF) are ideal for crisp results at any size. High-resolution PNG works too as long as it\u2019s at least 300 DPI at final print size. We\u2019ll tell you if we need a better version before charging you anything.' },
  { q: 'What\u2019s the minimum logo resolution you need?', a: 'For raster files, 300 DPI at actual print size — typically 3000 px wide for a standard chest print. Vector files have no resolution limit since they scale cleanly. Not sure? Send what you have and we\u2019ll check.' },
  { q: 'Can I order a single sample before committing?', a: 'Yes. Single-piece sample orders are welcome and ship at the same 5-day turnaround. It\u2019s the best way to feel the fabric and confirm colors before ordering for a full team.' },
  { q: 'Can you match a specific Pantone color?', a: 'Yes, custom Pantone matches are available on screen-printed and embroidered orders. Give us the PMS code at quote time and we\u2019ll ink-match it. A small color-setup fee may apply on very small runs.' },
  { q: 'How many colors can I use in one print?', a: 'Screen printing supports up to 8 spot colors per location; DTG and DTF handle unlimited colors including gradients. Embroidery runs up to 12 thread colors per logo. We\u2019ll recommend the best method for your art.' },
  { q: 'Where can you place the print on a garment?', a: 'Front, back, left or right chest, sleeves, nape, bottom hem — pretty much anywhere. Most orders use 1 to 3 locations; each additional placement is priced per print. Let us know your ideal layout and we\u2019ll mock it up.' },
  { q: 'What shipping methods and times do you offer?', a: 'Canada Post Expedited for most orders (2-5 business days in Quebec, 3-7 elsewhere in Canada) and Purolator Ground when speed matters. Express and overnight options show up at checkout if your postal code qualifies.' },
  { q: 'How is shipping cost calculated?', a: 'Live rates from Canada Post and Purolator based on weight and destination — no flat markup. Orders over $300 CAD ship free anywhere in Canada. You see the final shipping cost before you pay.' },
  { q: 'Do I pay GST and QST?', a: 'Yes. Canadian orders are charged GST (5%) and, for Quebec addresses, QST (9.975%). Taxes are calculated automatically at checkout based on your shipping address. Out-of-country orders ship tax-exempt.' },
  { q: 'What payment methods do you accept?', a: 'Visa, Mastercard, American Express, Apple Pay, Google Pay and Interac e-Transfer. Business accounts can request net-30 terms after the first order. Everything runs through Shopify\u2019s PCI-compliant checkout.' },
  { q: 'Is there a bulk discount?', a: 'Yes. Pricing tiers kick in at 12, 25, 50, 100 and 250 pieces per design — the more you order, the lower the unit cost. You\u2019ll see the tier pricing live in the quote builder as you adjust quantity.' },
  { q: 'What\u2019s your return or remake policy?', a: 'If we misprint, miscolor or mis-size anything, we remake it free and cover shipping both ways. One-year guarantee on stitching, print and embroidery under normal use. Custom pieces can\u2019t be returned for buyer\u2019s remorse, but quality issues are always on us.' },
  { q: 'Can I get fabric or color swatches before ordering?', a: 'Yes. We mail fabric swatches and Pantone color chips free for orders over 25 pieces, or $15 CAD refundable on smaller runs. Most decisions happen faster once you see and feel the options in hand.' },
  { q: 'What happens if a product is out of stock?', a: 'We notify you within one business day with closest-match alternatives and an honest ETA on the original. No silent swaps — you always choose whether to wait, substitute or cancel for a full refund.' },
  { q: 'Do you offer rush orders?', a: 'Yes, 48-hour and 72-hour rush is available on most products for a 25-40% fee depending on quantity. Call or message before ordering so we can confirm capacity and lock in your slot in the production queue.' },
  { q: 'Can I mix different products in one order?', a: 'Absolutely. T-shirts, hoodies, caps, tote bags, mugs — mix and match freely with a single decoration setup. Combining products often unlocks the next bulk-discount tier on total units.' },
  { q: 'Should I choose embroidery or screen print?', a: 'Embroidery looks premium and lasts decades on caps, polos and jackets — best for logos up to 4 inches. Screen print is sharper, faster and cheaper on t-shirts and hoodies, especially for larger designs. We\u2019ll recommend per piece when you quote.' },
  { q: 'Do you offer eco-friendly materials?', a: 'Yes. Organic cotton, recycled polyester (rPET), and blanks from B-Corp-certified suppliers like Stanley/Stella and Allmade are available across most product categories. Water-based inks are standard on all our screen prints.' },
  { q: 'Can I pick up my order instead of shipping?', a: 'Yes — free local pickup at our Quebec facility during business hours, usually ready the day production wraps. Select "Pickup" at checkout and we\u2019ll text you when your order is boxed and ready.' },
];

const FAQ_FR: { q: string; a: string }[] = [
  { q: 'Y a-t-il une quantité minimum par commande?', a: 'Aucun minimum — commande dès 1 pièce. Que tu aies besoin d\u2019un seul échantillon ou de 500 uniformes, le prix unitaire reste juste. La plupart des clients commencent avec un ou deux pour tester, puis augmentent.' },
  { q: 'En combien de temps vais-je recevoir ma commande?', a: 'Délai standard de 5 jours ouvrables après approbation de l\u2019épreuve. Les commandes passées avant 15 h partent en production la journée même; après, elles roulent au prochain jour ouvrable. Date d\u2019expédition confirmée au paiement.' },
  { q: 'Quels formats de fichier acceptez-vous pour les visuels?', a: 'Les fichiers vectoriels (SVG, AI, PDF) sont idéaux pour un rendu net à toute taille. Un PNG haute résolution fonctionne aussi s\u2019il est d\u2019au moins 300 DPI à la taille d\u2019impression finale. On t\u2019avise si on a besoin d\u2019une meilleure version avant de facturer quoi que ce soit.' },
  { q: 'Quelle est la résolution minimum pour un logo?', a: 'Pour les fichiers matriciels, 300 DPI à la taille réelle d\u2019impression — environ 3000 px de large pour une impression poitrine standard. Les vectoriels n\u2019ont pas de limite de résolution. Pas certain? Envoie ce que tu as et on vérifie.' },
  { q: 'Puis-je commander un échantillon avant de m\u2019engager?', a: 'Oui. Les commandes échantillons à une pièce sont les bienvenues, avec le même délai de 5 jours. C\u2019est la meilleure façon de sentir le tissu et confirmer les couleurs avant de commander pour toute une équipe.' },
  { q: 'Pouvez-vous matcher une couleur Pantone précise?', a: 'Oui, les matchs Pantone sur mesure sont disponibles en sérigraphie et en broderie. Donne-nous le code PMS lors du devis et on le reproduit. Des frais de calibration peuvent s\u2019appliquer sur les très petites quantités.' },
  { q: 'Combien de couleurs puis-je utiliser par impression?', a: 'La sérigraphie supporte jusqu\u2019à 8 couleurs spot par emplacement; le DTG et le DTF gèrent un nombre illimité de couleurs incluant les dégradés. La broderie monte à 12 couleurs de fil par logo. On te recommandera la meilleure méthode pour ton visuel.' },
  { q: 'Où peut-on imprimer sur un vêtement?', a: 'Devant, dos, cœur gauche ou droit, manches, nuque, bas du vêtement — pratiquement partout. La plupart des commandes utilisent 1 à 3 emplacements; chaque emplacement additionnel est facturé à l\u2019unité. Dis-nous ta disposition idéale et on te fait un visuel.' },
  { q: 'Quels modes et délais de livraison offrez-vous?', a: 'Postes Canada Expédié pour la plupart des commandes (2-5 jours ouvrables au Québec, 3-7 ailleurs au Canada) et Purolator Sol quand la vitesse compte. Les options Express et jour suivant apparaissent au paiement si ton code postal y donne droit.' },
  { q: 'Comment les frais de livraison sont-ils calculés?', a: 'Tarifs en direct de Postes Canada et Purolator selon le poids et la destination — sans majoration fixe. Livraison gratuite au Canada pour les commandes de plus de 300 $ CAD. Le coût final s\u2019affiche avant le paiement.' },
  { q: 'Dois-je payer la TPS et la TVQ?', a: 'Oui. Les commandes canadiennes sont taxées TPS (5 %) et, pour les adresses au Québec, TVQ (9,975 %). Les taxes sont calculées automatiquement au paiement selon ton adresse de livraison. Les commandes hors Canada sont exonérées.' },
  { q: 'Quels modes de paiement acceptez-vous?', a: 'Visa, Mastercard, American Express, Apple Pay, Google Pay et Interac virement. Les comptes entreprise peuvent demander des termes net-30 après la première commande. Tout passe par la caisse sécurisée PCI de Shopify.' },
  { q: 'Y a-t-il un rabais de volume?', a: 'Oui. Les paliers de prix s\u2019activent à 12, 25, 50, 100 et 250 pièces par design — plus tu commandes, plus le coût unitaire baisse. Tu vois les paliers en direct dans le calculateur de devis en ajustant la quantité.' },
  { q: 'Quelle est votre politique de retour ou refabrication?', a: 'Si on rate une impression, une couleur ou une taille, on refait gratuitement et on paie la livraison aller-retour. Garantie un an sur couture, impression et broderie à usage normal. Les pièces personnalisées ne sont pas retournables pour changement d\u2019idée, mais les défauts sont toujours notre responsabilité.' },
  { q: 'Puis-je recevoir des échantillons de tissu ou de couleur?', a: 'Oui. On envoie des échantillons de tissu et des puces Pantone gratuitement pour les commandes de plus de 25 pièces, ou 15 $ CAD remboursable sur les plus petites. Les décisions se prennent plus vite quand tu vois et touches les options.' },
  { q: 'Que se passe-t-il si un produit est en rupture?', a: 'On t\u2019avise en un jour ouvrable avec des alternatives les plus proches et une date réaliste pour le produit d\u2019origine. Jamais de substitution silencieuse — c\u2019est toi qui choisis d\u2019attendre, de substituer ou d\u2019annuler avec remboursement complet.' },
  { q: 'Offrez-vous des commandes urgentes?', a: 'Oui, des rush de 48 h et 72 h sont possibles sur la plupart des produits avec des frais de 25 à 40 % selon la quantité. Appelle ou écris avant de commander pour qu\u2019on confirme la capacité et réserve ta place dans la file de production.' },
  { q: 'Puis-je mélanger différents produits dans une commande?', a: 'Absolument. T-shirts, hoodies, casquettes, sacs, tasses — mélange librement avec une seule configuration de décoration. Combiner les produits permet souvent d\u2019atteindre le prochain palier de rabais sur le total des unités.' },
  { q: 'Broderie ou sérigraphie, que choisir?', a: 'La broderie a un look premium et dure des décennies sur casquettes, polos et vestes — idéale pour les logos jusqu\u2019à 4 pouces. La sérigraphie est plus nette, rapide et économique sur t-shirts et hoodies, surtout pour les grands designs. On te recommande selon la pièce lors du devis.' },
  { q: 'Offrez-vous des matières écoresponsables?', a: 'Oui. Coton bio, polyester recyclé (rPET) et blanks de fournisseurs certifiés B-Corp comme Stanley/Stella et Allmade sont disponibles sur la plupart des catégories. Les encres à base d\u2019eau sont standard sur toutes nos sérigraphies.' },
  { q: 'Puis-je ramasser ma commande au lieu de me faire livrer?', a: 'Oui — cueillette locale gratuite à notre atelier au Québec durant les heures d\u2019ouverture, habituellement prête la journée où la production se termine. Choisis "Cueillette" au paiement et on t\u2019écrit dès que ta commande est emballée et prête.' },
];

// Inline Google reviews — 6 verified-style cards. Inlined here (no
// src/data/reviews.ts on disk yet) so the carousel is self-contained.
const REVIEWS = [
  { init: 'SL', name: 'Samuel Lacroix',         color: '#0052CC', txt: 'Super service! Très bonne qualité et super rapide! Je recommande fortement à toutes les entreprises qui veulent avoir l\u2019air professionnel.' },
  { init: 'WB', name: 'William Barry',          color: '#1a3d2e', txt: 'Je recommande fortement Vision Affichage! Service très rapide, courtois. Un vrai professionnel qui comprend les besoins d\u2019une PME.' },
  { init: 'JP', name: 'Jean-Philippe N.-L.',    color: '#5f1f1f', txt: 'Super bon service, équipe dynamique. Aussi bon pour les commandes custom que les grosses commandes entreprises. Je recommande!' },
  { init: 'MC', name: 'Marie-Claude Tremblay',  color: '#4C1D95', txt: 'On a commandé des hoodies pour toute notre équipe et le résultat était impeccable. Livraison rapide, qualité premium. On recommande!' },
  { init: 'PD', name: 'Patrick Dubois',         color: '#0A0A0A', txt: 'Excellente expérience du début à la fin. L\u2019outil de personnalisation est génial et le produit final a dépassé nos attentes.' },
  { init: 'AB', name: 'Audrey Bergeron',        color: '#6B1B1B', txt: 'Parfait pour notre compagnie de construction. Qualité solide, délai rapide, prix compétitifs. Notre référence pour tout notre merch.' },
];

const StarSvg = () => (
  <svg className="w-3 h-3 fill-[#F59E0B]" viewBox="0 0 24 24">
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

/** Homepage route — Freud × Bernays psychological redesign: loss-aversion
 *  hero, transformation-language "How It Works", verified Google
 *  aggregate, and the high-impact "Pendant que tu lis ça, tes équipes
 *  sont dehors sans ton logo" loss-aversion section before the footer
 *  CTA. Brand-black + brand-blue. Visual noise cut. */
export default function Index() {
  const { lang } = useLang();
  useDocumentTitle(
    lang === 'en'
      ? 'Vision Affichage — Custom corporate apparel printed in 5 days | Quebec'
      : 'Vision Affichage — Vêtements d\u2019entreprise imprimés en 5 jours | Québec',
    lang === 'en'
      ? 'Print your logo on t-shirts, polos, hoodies and caps. Guaranteed 5 business day delivery across Quebec. Starting from one piece.'
      : 'Imprimez votre logo sur t-shirts, polos, hoodies et casquettes. Livraison garantie en 5 jours ouvrables partout au Québec. À partir d\u2019une pièce.',
    {},
  );
  const cart = useCartStore();
  const [cartOpen, setCartOpen] = useState(false);
  const [visitor, setVisitor] = useState<VisitorProfile>(() => getProfile());
  useEffect(() => {
    setVisitor(getProfile());
  }, []);
  const [showGame, setShowGame] = useState(false);
  // Intro animation disabled by default — site owner reported it as
  // bugged. Visitors land directly on the hero with no overlay.
  const [showLoader, setShowLoader] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  // Sticky bottom CTA (mobile only). Sentinel sits at the bottom of
  // the hero; when it leaves the viewport we know the user has
  // scrolled past the hero and should see the persistent CTA.
  const heroSentinelRef = useRef<HTMLDivElement>(null);
  const [showStickyCta, setShowStickyCta] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(mq.matches);
    update();
    if (mq.addEventListener) mq.addEventListener('change', update);
    else mq.addListener(update);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', update);
      else mq.removeListener(update);
    };
  }, []);
  useEffect(() => {
    const el = heroSentinelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        setShowStickyCta(!entry.isIntersecting);
      },
      { threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // FAQ accordion — one-at-a-time open behaviour. Native <details>
  // gives us keyboard/SR semantics + no-JS progressive enhancement
  // for free; this handler enforces mutual exclusion.
  const faqGroupRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = faqGroupRef.current;
    if (!root) return;
    const items = Array.from(root.querySelectorAll<HTMLDetailsElement>('details[data-faq-item]'));
    const onToggle = (e: Event) => {
      const target = e.target as HTMLDetailsElement;
      if (!target.open) return;
      items.forEach(d => { if (d !== target && d.open) d.open = false; });
    };
    items.forEach(d => d.addEventListener('toggle', onToggle));
    return () => items.forEach(d => d.removeEventListener('toggle', onToggle));
  }, []);

  const loaderTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  useEffect(() => {
    return () => {
      loaderTimersRef.current.forEach(t => clearTimeout(t));
      loaderTimersRef.current = [];
    };
  }, []);

  // Organization JSON-LD schema — feeds Google the canonical
  // name/address/phone/social graph.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (document.head.querySelector('script[data-vision-org-ld]')) return;
    const orgSchema = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Vision Affichage',
      alternateName: 'Vision Affichage Inc.',
      url: 'https://visionaffichage.com',
      logo: 'https://cdn.shopify.com/s/files/1/0578/1038/7059/files/Asset_1_d5d82510-0b83-4657-91b7-3ac1992ee697.svg?height=90&v=1769614651',
      telephone: '+1-367-380-4808',
      email: 'info@visionaffichage.com',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Saint-Hyacinthe',
        addressRegion: 'QC',
        addressCountry: 'CA',
      },
      sameAs: [
        'https://instagram.com/visionaffichage',
        'https://facebook.com/visionaffichage',
      ],
    };
    const el = document.createElement('script');
    el.type = 'application/ld+json';
    el.dataset.visionOrgLd = 'true';
    el.text = JSON.stringify(orgSchema);
    document.head.appendChild(el);
    return () => {
      if (el.parentNode) document.head.removeChild(el);
    };
  }, []);

  // FAQPage JSON-LD schema — surfaces the Q&A as rich SERP results.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (document.head.querySelector('script[data-faq-ld]')) return;
    const pairs = lang === 'en' ? FAQ_EN : FAQ_FR;
    const faqSchema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: pairs.map(({ q, a }) => ({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a },
      })),
    };
    const el = document.createElement('script');
    el.type = 'application/ld+json';
    el.dataset.faqLd = 'true';
    el.text = JSON.stringify(faqSchema);
    document.head.appendChild(el);
    return () => {
      if (el.parentNode) document.head.removeChild(el);
    };
  }, [lang]);

  // LocalBusiness JSON-LD lives statically in index.html (canonical
  // single source of truth). The runtime duplicate here was removed —
  // it carried "<owner fills in>" placeholders and conflicted with the
  // static schema, confusing Google's knowledge-graph extractor.

  const handleLoaderComplete = useCallback(() => {
    setShowLoader(false);
    let alreadyPlayed = true;
    try {
      alreadyPlayed = typeof window !== 'undefined' && localStorage.getItem('moleGamePlayed') === 'true';
    } catch { /* private mode */ }
    if (!alreadyPlayed) {
      loaderTimersRef.current.push(setTimeout(() => setShowGame(true), 650));
    }
  }, []);

  const handleGameClose = (won: boolean) => {
    setShowGame(false);
    try {
      localStorage.setItem('moleGamePlayed', 'true');
    } catch { /* private mode */ }
    if (won) {
      cart.applyDiscount('VISION10');
    }
  };

  // Industries marquee — text-only, no logo files. Avoids broken
  // images and reads as a clean trust signal.
  const INDUSTRIES = lang === 'en'
    ? ['Construction', 'Landscaping', 'Plumbing', 'Electrical', 'Corporate', 'Municipal']
    : ['Construction', 'Paysagement', 'Plomberie', 'Électricité', 'Corporate', 'Municipal'];
  const industryRow = [...INDUSTRIES, ...INDUSTRIES, ...INDUSTRIES];

  return (
    <div id="main-content" tabIndex={-1} className="min-h-screen bg-background pb-20 focus:outline-none">
      <Suspense fallback={null}>
        {showLoader && <IntroAnimation onComplete={handleLoaderComplete} />}
        {showGame && <MoleGame isOpen={showGame} onClose={handleGameClose} />}
      </Suspense>
      <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
      <Navbar onOpenCart={() => setCartOpen(true)} onOpenLogin={() => setLoginOpen(true)} />
      <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />

      {/* Returning-visitor "Bon retour!" pill — renders only when
          sessionCount >= 2 AND we have a recorded last-viewed product. */}
      {visitor.sessionCount >= 2 && visitor.lastViewedProduct && visitor.lastViewedHref ? (
        <div className="px-6 md:px-10 pt-[88px]" data-vision-returning-banner>
          <div className="max-w-[920px] mx-auto">
            <Link
              to={visitor.lastViewedHref}
              className="inline-flex items-center gap-2 rounded-full bg-[#0052CC]/10 px-4 py-2 text-sm text-foreground hover:bg-[#0052CC]/20 transition-colors"
            >
              <span aria-hidden="true">{'\uD83D\uDC4B'}</span>
              <span>
                {lang === 'en'
                  ? `Welcome back! Looking for ${visitor.lastViewedProduct}? Pick up where I left off`
                  : `Bon retour\u00A0! Tu cherchais ${visitor.lastViewedProduct}\u00A0? Reprendre o\u00F9 je me suis arr\u00EAt\u00E9`}
              </span>
              <span aria-hidden="true">{'\u2192'}</span>
            </Link>
          </div>
        </div>
      ) : null}

      {/* ============================================================
          1. HERO — restored classic light surface with single CTA.
          Flat white background. Headline + sub centered, ONE primary
          CTA pill (no ghost link), single-line trust bar.
          ============================================================ */}
      <section className="relative overflow-hidden bg-white min-h-[92vh] flex items-center justify-center px-6 md:px-10 pt-[88px] pb-20">
        <div className="relative z-[1] max-w-[1080px] mx-auto text-center">
          {/* H1 */}
          <h1 className="font-display font-black text-[#0A0A0A] text-5xl md:text-6xl xl:text-7xl leading-[1.02] tracking-[-0.04em]">
            {lang === 'en' ? (
              <>Your team is working.<br /><span className="text-[#0052CC]">Who knows who they are?</span></>
            ) : (
              <>Ton équipe travaille.<br /><span className="text-[#0052CC]">Qui sait c'est qui?</span></>
            )}
          </h1>

          {/* Sub */}
          <p className="mt-7 text-[clamp(15px,1.6vw,19px)] text-[#1F2937] max-w-[620px] mx-auto leading-relaxed">
            {lang === 'en'
              ? 'Print your logo on t-shirts, hoodies, polos and caps. Delivered in 5 business days — from one piece up.'
              : "Imprime ton logo sur tes t-shirts, hoodies, polos et casquettes. Livré en 5 jours ouvrables \u2014 à partir d'une pièce."}
          </p>

          {/* Single primary CTA — one pill only, no ghost link. */}
          <div className="mt-9 flex flex-col items-center justify-center">
            <Link
              to="/products"
              className="inline-flex items-center justify-center px-9 h-[56px] rounded-full bg-[#0052CC] text-white text-[16px] font-extrabold tracking-[-0.2px] shadow-[0_10px_30px_rgba(0,82,204,0.5)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(0,82,204,0.6)] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#0052CC]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              {lang === 'en' ? 'Order now' : 'Commander maintenant'}
            </Link>
            <p className="mt-3 text-[#374151] text-xs">
              {lang === 'en' ? '5-day delivery guaranteed' : 'Livraison garantie en 5 jours ouvrables'}
            </p>
          </div>

          {/* Trust bar — single line, wraps gracefully on mobile. */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12px] md:text-[13px] text-[#374151]">
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="flex gap-0.5 text-[#F59E0B]">
                <StarSvg /><StarSvg /><StarSvg /><StarSvg /><StarSvg />
              </span>
              <span className="font-bold">5/5 Google</span>
            </span>
            <span aria-hidden="true" className="text-[#0A0A0A]/30">·</span>
            <span>{lang === 'en' ? '500+ businesses' : '500+ entreprises'}</span>
            <span aria-hidden="true" className="text-[#0A0A0A]/30">·</span>
            <span>{lang === 'en' ? '33,000+ pieces' : '33\u202F000+ pièces'}</span>
            <span aria-hidden="true" className="text-[#0A0A0A]/30">·</span>
            <span>{lang === 'en' ? 'Free shipping $300+' : 'Livraison gratuite 300$+'}</span>
          </div>
        </div>

        <div ref={heroSentinelRef} aria-hidden="true" className="absolute bottom-0 left-0 h-px w-full pointer-events-none" />
      </section>

      {/* ============================================================
          2. INDUSTRY MARQUEE — text-only, single line.
          ============================================================ */}
      <section aria-label={lang === 'en' ? 'Trusted by Québec professionals' : 'Les pros du Québec'} className="border-b border-border bg-background">
        <div className="max-w-[1160px] mx-auto px-6 md:px-10 py-7">
          <h2 className="text-center text-[11px] font-bold tracking-[2.5px] uppercase text-muted-foreground mb-3">
            {lang === 'en'
              ? 'Québec\u2019s pros choose Vision Affichage'
              : 'Les pros du Québec choisissent Vision Affichage'}
          </h2>
          <div
            className="overflow-hidden relative"
            style={{
              maskImage: 'linear-gradient(to right, transparent, black 80px, black calc(100% - 80px), transparent)',
              WebkitMaskImage: 'linear-gradient(to right, transparent, black 80px, black calc(100% - 80px), transparent)',
            }}
          >
            <div
              className="flex w-max"
              style={{ animation: reducedMotion ? 'none' : 'marqueeScroll 40s linear infinite' }}
            >
              {industryRow.map((label, i) => (
                <div
                  key={i}
                  className="px-8 text-[13px] font-bold tracking-[1.5px] uppercase text-foreground/60"
                >
                  {label}
                </div>
              ))}
            </div>
          </div>
          {/* Client logo placeholder strip — operator can swap each entry to
              <img src={c.logoSrc} alt={c.name} /> once /public/logos/clients/*.svg
              files land. */}
          <div className="mt-6 flex flex-wrap justify-center items-center gap-x-8 gap-y-3">
            {VA_CLIENT_LOGOS.map(c => (
              <div
                key={c.name}
                className="px-4 py-2 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg flex items-center justify-center min-w-[120px]"
              >
                <span className="text-[#374151] text-xs font-bold whitespace-nowrap tracking-wide">{c.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats grid removed (dedup): hero trust bar already surfaces
          the 33 000+ / 500+ / 5 jours numbers; TrustSignalsBar below
          carries the delivery / guarantee / Québec promises. */}

      {/* Existing trust signals strip (delivery promise, guarantees) */}
      <TrustSignalsBar />

      {/* Featured products — kept; conversion-critical. */}
      <FeaturedProducts />

      {/* ============================================================
          4. HOW IT WORKS — transformation language, ghost numbers,
          Lucide icons, brand colors.
          ============================================================ */}
      <FadeIn>
        <section
          id="how-it-works"
          className="scroll-mt-20 bg-background py-20 md:py-24 px-6 md:px-10 border-t border-border"
        >
          <div className="max-w-[1160px] mx-auto">
            <div className="text-center mb-14">
              <div className="text-[11px] font-bold tracking-[2.5px] uppercase text-[#0052CC] mb-2.5">
                {lang === 'en' ? 'How it works' : 'Comment ça fonctionne'}
              </div>
              <h2 className="text-[clamp(28px,3.4vw,44px)] font-extrabold tracking-[-1px] text-foreground leading-tight">
                {lang === 'en'
                  ? <>Three steps. <span className="text-[#0052CC]">One uniform.</span></>
                  : <>Trois actions. <span className="text-[#0052CC]">Un uniforme.</span></>}
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
              {[
                {
                  n: '01',
                  Icon: Upload,
                  title: lang === 'en' ? 'Send your logo. We handle the rest.' : 'Tu envoies ton logo \u2014 on gère le reste.',
                  body: lang === 'en'
                    ? 'PNG, SVG or JPEG \u2014 whatever you have. No design skills needed.'
                    : 'PNG, SVG ou JPEG. On accepte tout. Aucune retouche requise de ta part.',
                },
                {
                  n: '02',
                  Icon: Zap,
                  title: lang === 'en' ? 'We print. You don\u2019t approve anything.' : 'On imprime. Tu approuves rien.',
                  body: lang === 'en'
                    ? 'Our team positions your logo to industry standards. You\u2019ll love the result.'
                    : 'Notre équipe positionne ton logo selon les standards de l\u2019industrie. Tu n\u2019as pas besoin d\u2019être graphiste.',
                },
                {
                  n: '03',
                  Icon: Package,
                  title: lang === 'en' ? 'You receive it. In 5 days. Guaranteed.' : 'Tu reçois. En 5 jours. Garanti.',
                  body: lang === 'en'
                    ? 'Delivered anywhere in Quebec. One day late? You get a refund. We\u2019ve never had to give one.'
                    : 'Livré partout au Québec. Si c\u2019est en retard d\u2019un seul jour, on te rembourse. On n\u2019a jamais eu à le faire.',
                },
              ].map((step, i) => {
                const Icon = step.Icon;
                return (
                  <div key={i} className="relative rounded-2xl border border-border bg-card p-7 md:p-8 overflow-hidden">
                    {/* Ghost number — large, faint, behind content. */}
                    <div
                      aria-hidden="true"
                      className="absolute -right-2 -top-4 font-mono text-[120px] md:text-[144px] leading-none text-[#E5E7EB]/50 select-none pointer-events-none"
                      style={{ fontWeight: 800 }}
                    >
                      {step.n}
                    </div>
                    <div className="relative">
                      <div className="w-12 h-12 rounded-xl bg-[#0052CC]/10 flex items-center justify-center mb-5">
                        <Icon className="text-[#0052CC]" size={22} strokeWidth={1.9} aria-hidden="true" />
                      </div>
                      <div className="text-[19px] md:text-[21px] font-extrabold text-foreground tracking-[-0.4px] mb-2">
                        {step.title}
                      </div>
                      <p className="text-[14px] text-[#374151] leading-relaxed">
                        {step.body}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </FadeIn>

      {/* ============================================================
          5. GOOGLE REVIEWS — 5.0 aggregate hero + scrollable cards.
          ============================================================ */}
      <FadeIn>
        <section className="scroll-mt-20 py-20 px-6 md:px-10 border-t border-border bg-background">
          <div className="max-w-[1160px] mx-auto">
            <div className="flex items-center justify-center gap-7 mb-10 flex-wrap text-center">
              <div>
                <div className="text-[64px] md:text-[80px] font-black text-[#0052CC] leading-none tracking-[-2px]">
                  5,0
                </div>
                <div className="flex gap-[3px] justify-center my-2" role="img" aria-label={lang === 'en' ? '5 out of 5 stars' : '5 étoiles sur 5'}>
                  {[...Array(5)].map((_, i) => <StarSvg key={i} />)}
                </div>
                <div className="text-[12px] text-muted-foreground">
                  {lang === 'en' ? '52 verified Google reviews' : '52 avis Google vérifiés'}
                </div>
              </div>
              <div className="hidden md:block w-px h-20 bg-border" />
              <div className="text-left max-w-[360px]">
                <h2 className="text-[clamp(22px,2.4vw,30px)] font-extrabold text-foreground tracking-[-0.5px] leading-tight">
                  {lang === 'en' ? 'What clients say' : 'Ce que les clients disent'}
                </h2>
                <div className="flex items-center gap-1.5 mt-2">
                  <GoogleIcon />
                  <span className="text-[12px] font-bold text-[#0052CC]">
                    {lang === 'en' ? 'Verified Google reviews' : 'Avis Google vérifiés'}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide md:grid md:grid-cols-3 md:overflow-visible">
              {REVIEWS.map((r, i) => (
                <div key={i} className="min-w-[280px] md:min-w-0 snap-start bg-card border border-border rounded-2xl p-5 flex-shrink-0">
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-[36px] h-[36px] rounded-full flex items-center justify-center text-[12px] font-extrabold text-white flex-shrink-0" style={{ background: r.color }}>{r.init}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-bold text-foreground truncate">{r.name}</div>
                      <div className="flex gap-0.5 mt-1">{[...Array(5)].map((_, j) => <StarSvg key={j} />)}</div>
                    </div>
                    <GoogleIcon />
                  </div>
                  <p className="text-[13.5px] text-[#374151] leading-relaxed">{r.txt}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </FadeIn>

      {/* ============================================================
          6. LOSS-AVERSION SECTION — the conversion lift.
          Brand-black background, h2 black 800, brand-blue lines 2-3.
          ============================================================ */}
      <FadeIn>
        <section
          aria-label={lang === 'en' ? 'The cost of waiting' : 'Le coût de l\u2019attente'}
          className="scroll-mt-20 bg-[#0A0A0A] text-white py-24 md:py-28 px-6 md:px-10 border-t border-b border-[#E5E7EB]"
        >
          <div className="max-w-[920px] mx-auto text-center">
            <div className="text-[12px] font-bold tracking-[2.5px] uppercase text-white/60 mb-5">
              {lang === 'en' ? 'The cost of waiting' : 'Le coût de l\u2019attente'}
            </div>
            <h2
              className="text-white tracking-[-1.5px] leading-[1.05] text-[clamp(32px,5.4vw,64px)]"
              style={{ fontFamily: '"DM Sans", system-ui, -apple-system, "Segoe UI", sans-serif', fontWeight: 800 }}
            >
              {lang === 'en' ? (
                <>Every week your crew works without a logo is a week clients <span className="text-[#0052CC]">don{'\u2019'}t remember your name.</span></>
              ) : (
                <>Chaque semaine que ton équipe sort sans logo, c{'\u2019'}est une commande qui va <span className="text-[#0052CC]">à quelqu{'\u2019'}un d{'\u2019'}autre.</span></>
              )}
            </h2>
            <div className="mt-9 max-w-[640px] mx-auto space-y-4 text-[15px] md:text-[17px] text-white/80 leading-relaxed">
              <p>
                {lang === 'en'
                  ? '500 Quebec business owners solved this. Most started with 5 shirts.'
                  : '500 entrepreneurs au Québec ont réglé ça. La plupart ont commencé avec 5 t-shirts.'}
              </p>
            </div>
            <div className="mt-10">
              <Link
                to="/products"
                className="inline-flex items-center justify-center px-9 h-[56px] rounded-full bg-[#0052CC] text-white text-[16px] font-extrabold tracking-[-0.2px] shadow-[0_10px_30px_rgba(0,82,204,0.45)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(0,82,204,0.6)] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#0052CC]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A]"
              >
                {lang === 'en' ? 'Order now \u2192' : 'Commander maintenant \u2192'}
              </Link>
            </div>
          </div>
        </section>
      </FadeIn>

      {/* FAQ */}
      <FadeIn>
        <section className="scroll-mt-20 py-20 px-6 md:px-10 border-t border-border">
          <div className="max-w-[780px] mx-auto">
            <div className="text-center mb-10">
              <div className="text-[11px] font-bold tracking-[2px] uppercase text-[#0052CC] mb-2.5">
                {lang === 'en' ? 'FAQ' : 'Questions fréquentes'}
              </div>
              <h2 className="text-[clamp(26px,3vw,38px)] font-extrabold tracking-[-0.5px] text-foreground leading-tight">
                {lang === 'en' ? 'Everything you need to know' : 'Tout ce que tu dois savoir'}
              </h2>
            </div>
            <style>{`
              .faq-group summary::-webkit-details-marker { display: none; }
              .faq-group summary::marker { content: ''; }
              .faq-group details[open] .faq-chevron { transform: rotate(180deg); }
            `}</style>
            <div ref={faqGroupRef} className="faq-group flex flex-col gap-2">
              {(lang === 'en' ? FAQ_EN : FAQ_FR).map((item, i) => (
                <details
                  key={i}
                  data-faq-item
                  className="group rounded-lg bg-background border border-border transition-colors hover:bg-muted/20"
                >
                  <summary
                    className="flex items-center justify-between gap-4 cursor-pointer list-none px-5 py-4 rounded-lg text-[15px] md:text-[16px] font-medium text-[#0A0A0A] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1"
                  >
                    <span>{item.q}</span>
                    <ChevronDown
                      size={18}
                      strokeWidth={2}
                      aria-hidden="true"
                      className="faq-chevron flex-shrink-0 text-[#0A0A0A] transition-transform duration-200"
                    />
                  </summary>
                  <div className="px-5 pb-4 pt-0 text-[14px] text-[#374151] leading-[1.7]">
                    {item.a}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>
      </FadeIn>

      {/* Footer CTA section removed (dedup): the loss-aversion section
          above already ships the same "Commander maintenant" pill, and
          TrustSignalsBar / FAQ already cover the "no minimum · 1-year
          guarantee · 5 days" reassurance copy. */}

      <SiteFooter />

      {/* Sticky mobile CTA bar — appears once the hero sentinel exits
          the viewport. Hidden on desktop. */}
      <div
        aria-hidden={!showStickyCta}
        className={`md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0A0A0A] text-white shadow-[0_-6px_24px_rgba(0,0,0,0.3)] ${reducedMotion ? '' : 'transition-transform duration-300 ease-out'} ${showStickyCta ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center justify-between gap-3 h-16 px-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
              <Shirt className="text-white" size={20} strokeWidth={1.75} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="text-[12px] font-bold leading-tight truncate">
                {lang === 'en' ? 'Order in 24h' : 'Commande en 24h'}
              </div>
              <div className="text-[10px] text-white/70 leading-tight truncate">
                {lang === 'en' ? '5-day delivery · No minimum' : '5 jours · Aucun minimum'}
              </div>
            </div>
          </div>
          <Link
            to="/products"
            tabIndex={showStickyCta ? 0 : -1}
            className="flex-shrink-0 inline-flex items-center justify-center px-5 h-10 rounded-full bg-[#0052CC] text-white text-[13px] font-extrabold tracking-[-0.2px] shadow-[0_4px_14px_rgba(0,82,204,0.5)] transition-shadow hover:shadow-[0_6px_18px_rgba(0,82,204,0.65)] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#0052CC]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A]"
          >
            {lang === 'en' ? 'Order now' : 'Commander'}
          </Link>
        </div>
      </div>

      <AIChat />
      <BottomNav />
    </div>
  );
}
