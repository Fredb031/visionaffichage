import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';
// MoleGame and IntroAnimation are one-off, first-visit chrome that
// most returning visitors never see — keep them out of the initial
// home-page bundle and fetch on demand.
import { lazy, Suspense } from 'react';
const MoleGame = lazy(() => import('@/components/MoleGame').then(m => ({ default: m.MoleGame })));
const IntroAnimation = lazy(() => import('@/components/IntroAnimation').then(m => ({ default: m.IntroAnimation })));
// OP-9: CartDrawer pulls framer-motion (slide animation). It's only
// mounted when the user opens the cart from Navbar/BottomNav, so lazy-
// loading it keeps framer-motion out of the home-page eager graph
// while preserving the slide-in UX once the user actually engages.
const CartDrawer = lazy(() =>
  import('@/components/CartDrawer').then((m) => ({ default: m.CartDrawer }))
);
// Phase 8 perf — LoginModal is ~14 KB of auth UI that only mounts
// after the user clicks the navbar user-icon (or the "Connectez-vous"
// CTA in the QuickPriceCalculator). Eagerly importing it dragged
// LoginModal + its lucide icons + email-validation helpers into the
// home-page eager `index` chunk that every visitor pays for at first
// paint. Lazy import + a gated mount keeps the modal off the critical
// path entirely on cold visits.
const LoginModal = lazy(() =>
  import('@/components/LoginModal').then((m) => ({ default: m.LoginModal })),
);
import { AIChat } from '@/components/AIChat';
import { FeaturedProducts } from '@/components/FeaturedProducts';
import { SiteFooter } from '@/components/SiteFooter';
import { CountUp } from '@/components/CountUp';
import { QuickPriceCalculator } from '@/components/QuickPriceCalculator';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ChevronDown,
  Lock,
  Shirt,
  Upload,
  Printer,
  Package,
  Zap,
  Check,
  Star as StarIcon,
} from 'lucide-react';
import { useLang } from '@/lib/langContext';
import { useCartStore } from '@/stores/localCartStore';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useInView } from '@/hooks/useInView';
import { useMagnetic } from '@/hooks/useMagnetic';

// FAQ Q&A pairs — lifted out of the JSX render path so they can be
// reused by the FAQPage JSON-LD injection without duplicating the
// content. Editing one keeps the schema and the rendered accordion in
// sync — both read from the same module-level constants.
const FAQ_EN: { q: string; a: string }[] = [
  { q: 'Is there a minimum order quantity?', a: 'No minimum — order as little as 1 piece. Whether you need a single sample or 500 uniforms, the price per unit stays fair. Most clients start with one or two to test quality, then scale up.' },
  { q: 'How fast can I receive my order?', a: 'Standard turnaround is 5 business days from proof approval. Orders placed before 3 pm hit production the same day; after that they roll to the next business day. Ship date is confirmed at checkout.' },
  { q: 'What file formats do you accept for artwork?', a: 'Vector files (SVG, AI, PDF) are ideal for crisp results at any size. High-resolution PNG works too as long as it’s at least 300 DPI at final print size. We’ll tell you if we need a better version before charging you anything.' },
  { q: 'What’s the minimum logo resolution you need?', a: 'For raster files, 300 DPI at actual print size — typically 3000 px wide for a standard chest print. Vector files have no resolution limit since they scale cleanly. Not sure? Send what you have and we’ll check.' },
  { q: 'Can I order a single sample before committing?', a: 'Yes. Single-piece sample orders are welcome and ship at the same 5-day turnaround. It’s the best way to feel the fabric and confirm colors before ordering for a full team.' },
  { q: 'Can you match a specific Pantone color?', a: 'Yes, custom Pantone matches are available on screen-printed and embroidered orders. Give us the PMS code at quote time and we’ll ink-match it. A small color-setup fee may apply on very small runs.' },
  { q: 'How many colors can I use in one print?', a: 'Screen printing supports up to 8 spot colors per location; DTG and DTF handle unlimited colors including gradients. Embroidery runs up to 12 thread colors per logo. We’ll recommend the best method for your art.' },
  { q: 'Where can you place the print on a garment?', a: 'Front, back, left or right chest, sleeves, nape, bottom hem — pretty much anywhere. Most orders use 1 to 3 locations; each additional placement is priced per print. Let us know your ideal layout and we’ll mock it up.' },
  { q: 'What shipping methods and times do you offer?', a: 'Canada Post Expedited for most orders (2-5 business days in Quebec, 3-7 elsewhere in Canada) and Purolator Ground when speed matters. Express and overnight options show up at checkout if your postal code qualifies.' },
  { q: 'How is shipping cost calculated?', a: 'Live rates from Canada Post and Purolator based on weight and destination — no flat markup. Orders over $300 CAD ship free anywhere in Canada. You see the final shipping cost before you pay.' },
  { q: 'Do I pay GST and QST?', a: 'Yes. Canadian orders are charged GST (5%) and, for Quebec addresses, QST (9.975%). Taxes are calculated automatically at checkout based on your shipping address. Out-of-country orders ship tax-exempt.' },
  { q: 'What payment methods do you accept?', a: 'Visa, Mastercard, American Express, Apple Pay, Google Pay and Interac e-Transfer. Business accounts can request net-30 terms after the first order. Everything runs through Shopify’s PCI-compliant checkout.' },
  { q: 'Is there a bulk discount?', a: 'Yes. Pricing tiers kick in at 12, 25, 50, 100 and 250 pieces per design — the more you order, the lower the unit cost. You’ll see the tier pricing live in the quote builder as you adjust quantity.' },
  { q: 'What’s your return or remake policy?', a: 'If we misprint, miscolor or mis-size anything, we remake it free and cover shipping both ways. One-year guarantee on stitching, print and embroidery under normal use. Custom pieces can’t be returned for buyer’s remorse, but quality issues are always on us.' },
  { q: 'Can I get fabric or color swatches before ordering?', a: 'Yes. We mail fabric swatches and Pantone color chips free for orders over 25 pieces, or $15 CAD refundable on smaller runs. Most decisions happen faster once you see and feel the options in hand.' },
  { q: 'What happens if a product is out of stock?', a: 'We notify you within one business day with closest-match alternatives and an honest ETA on the original. No silent swaps — you always choose whether to wait, substitute or cancel for a full refund.' },
  { q: 'Do you offer rush orders?', a: 'Yes, 48-hour and 72-hour rush is available on most products for a 25-40% fee depending on quantity. Call or message before ordering so we can confirm capacity and lock in your slot in the production queue.' },
  { q: 'Can I mix different products in one order?', a: 'Absolutely. T-shirts, hoodies, caps, tote bags, mugs — mix and match freely with a single decoration setup. Combining products often unlocks the next bulk-discount tier on total units.' },
  { q: 'Should I choose embroidery or screen print?', a: 'Embroidery looks premium and lasts decades on caps, polos and jackets — best for logos up to 4 inches. Screen print is sharper, faster and cheaper on t-shirts and hoodies, especially for larger designs. We’ll recommend per piece when you quote.' },
  { q: 'Do you offer eco-friendly materials?', a: 'Yes. Organic cotton, recycled polyester (rPET), and blanks from B-Corp-certified suppliers like Stanley/Stella and Allmade are available across most product categories. Water-based inks are standard on all our screen prints.' },
  { q: 'Can I pick up my order instead of shipping?', a: 'Yes — free local pickup at our Quebec facility during business hours, usually ready the day production wraps. Select "Pickup" at checkout and we’ll text you when your order is boxed and ready.' },
];

const FAQ_FR: { q: string; a: string }[] = [
  { q: 'Y a-t-il une quantité minimum par commande?', a: 'Aucun minimum — commande dès 1 pièce. Que tu aies besoin d’un seul échantillon ou de 500 uniformes, le prix unitaire reste juste. La plupart des clients commencent avec un ou deux pour tester, puis augmentent.' },
  { q: 'En combien de temps vais-je recevoir ma commande?', a: 'Délai standard de 5 jours ouvrables après approbation de l’épreuve. Les commandes passées avant 15 h partent en production la journée même; après, elles roulent au prochain jour ouvrable. Date d’expédition confirmée au paiement.' },
  { q: 'Quels formats de fichier acceptez-vous pour les visuels?', a: 'Les fichiers vectoriels (SVG, AI, PDF) sont idéaux pour un rendu net à toute taille. Un PNG haute résolution fonctionne aussi s’il est d’au moins 300 DPI à la taille d’impression finale. On t’avise si on a besoin d’une meilleure version avant de facturer quoi que ce soit.' },
  { q: 'Quelle est la résolution minimum pour un logo?', a: 'Pour les fichiers matriciels, 300 DPI à la taille réelle d’impression — environ 3000 px de large pour une impression poitrine standard. Les vectoriels n’ont pas de limite de résolution. Pas certain? Envoie ce que tu as et on vérifie.' },
  { q: 'Puis-je commander un échantillon avant de m’engager?', a: 'Oui. Les commandes échantillons à une pièce sont les bienvenues, avec le même délai de 5 jours. C’est la meilleure façon de sentir le tissu et confirmer les couleurs avant de commander pour toute une équipe.' },
  { q: 'Pouvez-vous matcher une couleur Pantone précise?', a: 'Oui, les matchs Pantone sur mesure sont disponibles en sérigraphie et en broderie. Donne-nous le code PMS lors du devis et on le reproduit. Des frais de calibration peuvent s’appliquer sur les très petites quantités.' },
  { q: 'Combien de couleurs puis-je utiliser par impression?', a: 'La sérigraphie supporte jusqu’à 8 couleurs spot par emplacement; le DTG et le DTF gèrent un nombre illimité de couleurs incluant les dégradés. La broderie monte à 12 couleurs de fil par logo. On te recommandera la meilleure méthode pour ton visuel.' },
  { q: 'Où peut-on imprimer sur un vêtement?', a: 'Devant, dos, cœur gauche ou droit, manches, nuque, bas du vêtement — pratiquement partout. La plupart des commandes utilisent 1 à 3 emplacements; chaque emplacement additionnel est facturé à l’unité. Dis-nous ta disposition idéale et on te fait un visuel.' },
  { q: 'Quels modes et délais de livraison offrez-vous?', a: 'Postes Canada Expédié pour la plupart des commandes (2-5 jours ouvrables au Québec, 3-7 ailleurs au Canada) et Purolator Sol quand la vitesse compte. Les options Express et jour suivant apparaissent au paiement si ton code postal y donne droit.' },
  { q: 'Comment les frais de livraison sont-ils calculés?', a: 'Tarifs en direct de Postes Canada et Purolator selon le poids et la destination — sans majoration fixe. Livraison gratuite au Canada pour les commandes de plus de 300 $ CAD. Le coût final s’affiche avant le paiement.' },
  { q: 'Dois-je payer la TPS et la TVQ?', a: 'Oui. Les commandes canadiennes sont taxées TPS (5 %) et, pour les adresses au Québec, TVQ (9,975 %). Les taxes sont calculées automatiquement au paiement selon ton adresse de livraison. Les commandes hors Canada sont exonérées.' },
  { q: 'Quels modes de paiement acceptez-vous?', a: 'Visa, Mastercard, American Express, Apple Pay, Google Pay et Interac virement. Les comptes entreprise peuvent demander des termes net-30 après la première commande. Tout passe par la caisse sécurisée PCI de Shopify.' },
  { q: 'Y a-t-il un rabais de volume?', a: 'Oui. Les paliers de prix s’activent à 12, 25, 50, 100 et 250 pièces par design — plus tu commandes, plus le coût unitaire baisse. Tu vois les paliers en direct dans le calculateur de devis en ajustant la quantité.' },
  { q: 'Quelle est votre politique de retour ou refabrication?', a: 'Si on rate une impression, une couleur ou une taille, on refait gratuitement et on paie la livraison aller-retour. Garantie un an sur couture, impression et broderie à usage normal. Les pièces personnalisées ne sont pas retournables pour changement d’idée, mais les défauts sont toujours notre responsabilité.' },
  { q: 'Puis-je recevoir des échantillons de tissu ou de couleur?', a: 'Oui. On envoie des échantillons de tissu et des puces Pantone gratuitement pour les commandes de plus de 25 pièces, ou 15 $ CAD remboursable sur les plus petites. Les décisions se prennent plus vite quand tu vois et touches les options.' },
  { q: 'Que se passe-t-il si un produit est en rupture?', a: 'On t’avise en un jour ouvrable avec des alternatives les plus proches et une date réaliste pour le produit d’origine. Jamais de substitution silencieuse — c’est toi qui choisis d’attendre, de substituer ou d’annuler avec remboursement complet.' },
  { q: 'Offrez-vous des commandes urgentes?', a: 'Oui, des rush de 48 h et 72 h sont possibles sur la plupart des produits avec des frais de 25 à 40 % selon la quantité. Appelle ou écris avant de commander pour qu’on confirme la capacité et réserve ta place dans la file de production.' },
  { q: 'Puis-je mélanger différents produits dans une commande?', a: 'Absolument. T-shirts, hoodies, casquettes, sacs, tasses — mélange librement avec une seule configuration de décoration. Combiner les produits permet souvent d’atteindre le prochain palier de rabais sur le total des unités.' },
  { q: 'Broderie ou sérigraphie, que choisir?', a: 'La broderie a un look premium et dure des décennies sur casquettes, polos et vestes — idéale pour les logos jusqu’à 4 pouces. La sérigraphie est plus nette, rapide et économique sur t-shirts et hoodies, surtout pour les grands designs. On te recommande selon la pièce lors du devis.' },
  { q: 'Offrez-vous des matières écoresponsables?', a: 'Oui. Coton bio, polyester recyclé (rPET) et blanks de fournisseurs certifiés B-Corp comme Stanley/Stella et Allmade sont disponibles sur la plupart des catégories. Les encres à base d’eau sont standard sur toutes nos sérigraphies.' },
  { q: 'Puis-je ramasser ma commande au lieu de me faire livrer?', a: 'Oui — cueillette locale gratuite à notre atelier au Québec durant les heures d’ouverture, habituellement prête la journée où la production se termine. Choisis "Cueillette" au paiement et on t’écrit dès que ta commande est emballée et prête.' },
];

// Marquee logos — rendered as text pills rather than fetched brand
// images so the homepage doesn't burn a bunch of CDN bytes for what is
// fundamentally a "social proof rail" treatment. Names match the Vol.
// III brief: a mix of public-sector (Boscoville, Ville de Laval),
// industrial trades (Construction Frères, Plomberie Pro), and outdoor
// services (Paysages Verts, Garda) so the rail reads as broad B2B
// trust rather than a single niche.
const MARQUEE_CLIENTS = [
  'Boscoville',
  'Garda',
  'Ville de Laval',
  'Construction Frères',
  'Plomberie Pro',
  'Paysages Verts',
  'Ferme Lacasse',
  'Sports Experts',
];

// Reviews — six bilingual testimonials shown in the snap-rail under the
// "5.0 · 50+ avis Google" header. Quotes are kept short so each card
// reads in a single glance on the horizontal scroll.
const REVIEWS = [
  {
    fr: { quote: 'Reçu en 4 jours pile. Mes gars ont adoré le hoodie. On va recommander pour le reste de l’équipe.', name: 'Marc Lévesque', company: 'Construction Frères' },
    en: { quote: 'Got it in 4 days flat. My crew loved the hoodie. We’ll re-order for the rest of the team.', name: 'Marc Lévesque', company: 'Construction Frères' },
  },
  {
    fr: { quote: 'Aucun minimum, vraiment. J’ai commencé avec 3 polos pour tester. Qualité impeccable.', name: 'Sophie Tremblay', company: 'Paysages Verts' },
    en: { quote: 'No minimum, for real. I started with 3 polos to test. Quality was spot-on.', name: 'Sophie Tremblay', company: 'Paysages Verts' },
  },
  {
    fr: { quote: 'Le logo brodé sur les casquettes est incroyable. Mes clients me demandent où je les ai eues.', name: 'Karim Benoît', company: 'Plomberie Pro' },
    en: { quote: 'The embroidered logo on the caps is incredible. Clients ask me where I got them.', name: 'Karim Benoît', company: 'Plomberie Pro' },
  },
  {
    fr: { quote: 'Service rapide, prix juste, communication claire. Je recommande à tous mes confrères.', name: 'Annie Roy', company: 'Boscoville' },
    en: { quote: 'Fast service, fair price, clear comms. I recommend them to every colleague.', name: 'Annie Roy', company: 'Boscoville' },
  },
  {
    fr: { quote: 'On a habillé toute l’équipe pour le tournoi. 5 jours, livré, sans accroc. Bravo.', name: 'David Pelletier', company: 'Sports Experts' },
    en: { quote: 'Kitted out the whole team for the tournament. 5 days, delivered, no hiccups. Solid.', name: 'David Pelletier', company: 'Sports Experts' },
  },
  {
    fr: { quote: 'Premier essai à 1 pièce, puis on a passé à 80. Aucun minimum c’est pas une promesse vide.', name: 'Julie Côté', company: 'Ferme Lacasse' },
    en: { quote: 'First try at 1 piece, then ramped to 80. No-minimum is not an empty promise here.', name: 'Julie Côté', company: 'Ferme Lacasse' },
  },
];

/**
 * SectionReveal — wraps a section with the standard fade-up gate keyed
 * to the existing single-fire `useInView` hook. The Vol. III brief
 * specifies every section after the hero gets the same treatment
 * (`opacity-0 translate-y-8` → `opacity-100 translate-y-0` over 700ms),
 * so this thin wrapper keeps the JSX readable instead of repeating the
 * ref/visible boilerplate at every section call site.
 */
function SectionReveal({
  children,
  className = '',
  as: Tag = 'section',
}: {
  children: React.ReactNode;
  className?: string;
  as?: 'section' | 'div';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref, { threshold: 0.12 });
  return (
    <Tag
      ref={ref as React.RefObject<HTMLDivElement>}
      className={`${className} transition-all duration-700 ease-out ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
    >
      {children}
    </Tag>
  );
}

export default function Index() {
  const { lang } = useLang();
  // Homepage SEO snippet. Bilingual title + description so Google's
  // en-CA index gets English copy when the visitor toggles EN.
  useDocumentTitle(
    lang === 'en' ? 'Vision Affichage — Custom merch' : 'Vision Affichage — Merch d’entreprise personnalisé',
    lang === 'en'
      ? 'Vision Affichage — Custom merch for Québec businesses. Free quote, 5-day turnaround, 100% local.'
      : 'Vision Affichage — Merch personnalisée pour entreprises du Québec. Soumission gratuite, 5 jours ouvrables, 100 % local.',
    {},
  );
  const cart = useCartStore();
  const [cartOpen, setCartOpen] = useState(false);
  const [showGame, setShowGame] = useState(false);
  // Intro animation disabled by default per owner feedback. The
  // IntroAnimation module + audio engine are still on disk and lazy-
  // loaded only if `showLoader` is flipped back on, so re-enabling is a
  // one-line change without dragging the chunk into the eager bundle.
  const [showLoader, setShowLoader] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  // Sticky bottom CTA (mobile only). The sentinel sits at the bottom of
  // the hero; once it leaves the viewport we know the visitor has
  // scrolled past the hero and should see the always-visible "Free
  // quote" CTA. Re-entering hides it. Desktop never shows the bar — the
  // top-nav CTA handles desktop conversion.
  const heroSentinelRef = useRef<HTMLDivElement>(null);
  // Vol III §07 — magnetic primary CTA. The hook owns the inline
  // transform on the anchor while the cursor is within 80px of the
  // button's center, drifting it ~6px towards the pointer. No-ops on
  // touch devices and when prefers-reduced-motion is set, so the only
  // observable cost on phones is the ref attach itself.
  const heroPrimaryCtaRef = useMagnetic<HTMLAnchorElement>();
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
      ([entry]) => setShowStickyCta(!entry.isIntersecting),
      { threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // FAQ accordion — one-at-a-time open behaviour. Native <details> gives
  // us keyboard/SR semantics + no-JS progressive enhancement for free;
  // this handler enforces mutual exclusion so opening one auto-closes
  // the rest in the same group.
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

  // Track timers kicked off by the loader so a route change before the
  // game popup appears doesn't fire state updates on an unmounted page.
  const loaderTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  useEffect(() => {
    return () => {
      loaderTimersRef.current.forEach(t => clearTimeout(t));
      loaderTimersRef.current = [];
    };
  }, []);

  // Organization JSON-LD schema. Feeds Google the canonical name /
  // address / phone / social graph so the homepage can attach to a
  // knowledge panel or render a rich SERP card. Dataset marker
  // prevents duplicates if Index remounts before cleanup runs.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (document.head.querySelector('script[data-vision-org-ld]')) return;
    const orgSchema = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Vision Affichage',
      alternateName: 'Vision Affichage Inc.',
      url: 'https://visionaffichage.com',
      logo: 'https://visionaffichage.com/logo.svg',
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

  // FAQPage JSON-LD schema. Feeds Google the 21 Q&A pairs already
  // rendered in the visual FAQ so the SERP can surface them as a rich-
  // results card directly under the homepage listing. Effect re-runs
  // when `lang` flips, swapping the graph in place.
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

  // LocalBusiness JSON-LD schema. Gives Google the Maps-style business-
  // card fields (hours, geo, phone, priceRange) needed to render the
  // local-pack treatment in SERP. Runs alongside the Organization graph
  // — Google accepts both and merges signals.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (document.head.querySelector('script[data-local-business-ld]')) return;
    const localBusinessSchema = {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: 'Vision Affichage',
      image: 'https://visionaffichage.com/logo.svg',
      priceRange: '$$',
      address: {
        '@type': 'PostalAddress',
        streetAddress: '<owner fills in>',
        addressLocality: 'Saint-Hyacinthe',
        addressRegion: 'QC',
        postalCode: '<owner fills in>',
        addressCountry: 'CA',
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: 45.62,
        longitude: -72.95,
      },
      telephone: '+1-367-380-4808',
      email: 'info@visionaffichage.com',
      openingHours: 'Mo-Fr 08:00-17:00',
      url: 'https://visionaffichage.com',
      sameAs: [
        'https://instagram.com/visionaffichage',
        'https://facebook.com/visionaffichage',
      ],
    };
    const el = document.createElement('script');
    el.type = 'application/ld+json';
    el.dataset.localBusinessLd = 'true';
    el.text = JSON.stringify(localBusinessSchema);
    document.head.appendChild(el);
    return () => {
      if (el.parentNode) document.head.removeChild(el);
    };
  }, []);

  const handleLoaderComplete = useCallback(() => {
    setShowLoader(false);
    // Auto-open the mini-game on first site visit only (once per
    // browser). Wrap localStorage in try/catch — Safari private
    // browsing throws on getItem and that uncaught error would break
    // the loader teardown.
    let alreadyPlayed = true;
    try {
      alreadyPlayed = typeof window !== 'undefined' && localStorage.getItem('moleGamePlayed') === 'true';
    } catch { /* private mode — treat as already seen */ }
    if (!alreadyPlayed) {
      loaderTimersRef.current.push(setTimeout(() => setShowGame(true), 650));
    }
  }, []);

  const handleGameClose = (won: boolean) => {
    setShowGame(false);
    try {
      localStorage.setItem('moleGamePlayed', 'true');
    } catch {
      // Private browsing or quota — one-time game, not worth blocking on.
    }
    if (won) {
      cart.applyDiscount('VISION10');
    }
  };

  // Trust pill avatar config — initials + colored circles for the four
  // "team" dots. Real photos can swap in later by replacing the
  // initials with <img> tags; the layout already accounts for w-7 h-7.
  const trustAvatars = ['ML', 'PB', 'SR', 'AT'];

  return (
    <div id="main-content" tabIndex={-1} className="min-h-screen bg-background pb-20 focus:outline-none">
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

      {/* ================================================================
          HERO — Vol. III PDF spec. Dark va-ink canvas, blue glow on the
          left, faded team image on the right (luminosity-blended), 64×64
          grid texture overlay. Headline / sub / CTA / trust bar /
          QuickPriceCalculator stagger in via fadeSlideUp keyframes
          authored in src/index.css.
          ============================================================== */}
      <section className="relative min-h-screen bg-va-ink overflow-hidden flex items-center">
        {/* 1. 64×64 grid texture (very low opacity — reads as paper, not pattern) */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.025]"
          aria-hidden="true"
          style={{
            backgroundImage:
              'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
            backgroundSize: '64px 64px',
          }}
        />

        {/* 2. Blue glow on the left */}
        <div
          className="absolute left-8 top-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-va-blue/6 blur-[100px] pointer-events-none"
          aria-hidden="true"
        />

        {/* 3. Right team image (lg+ only). Spread {...{ fetchpriority }}
             to dodge React 18's camelCase warning on the lowercase
             attribute the spec requires. onError hides the node if the
             asset 404s rather than leaving a broken-image rectangle. */}
        <div className="absolute right-0 inset-y-0 w-[45%] hidden lg:block pointer-events-none" aria-hidden="true">
          <img
            src="/hero-team.webp"
            alt=""
            loading="eager"
            decoding="async"
            {...{ fetchpriority: 'high' }}
            className="w-full h-full object-cover opacity-55 mix-blend-luminosity"
            onError={(e) => {
              const img = e.currentTarget as HTMLImageElement;
              img.style.display = 'none';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-va-ink via-va-ink/70 to-va-ink/20" />
        </div>

        {/* 4. Content column */}
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 md:px-12 lg:px-16 py-24">
          <div className="grid lg:grid-cols-[600px_1fr] gap-10 lg:gap-16 items-center">
            <div className="max-w-[600px]">
              {/* Trust pill — frosted glass, animates from above */}
              <div
                className="inline-flex items-center h-10 bg-white/6 backdrop-blur-md border border-white/12 rounded-full px-5 py-2 gap-3 mb-7"
                style={{ animation: 'fadeSlideDown 0.4s 0ms forwards', opacity: 0 }}
              >
                <div className="flex -space-x-1.5">
                  {trustAvatars.map((init, i) => (
                    <div
                      key={i}
                      className="w-7 h-7 rounded-full border-2 border-va-ink bg-va-blue/50 flex items-center justify-center text-white text-[10px] font-bold"
                      aria-hidden="true"
                    >
                      {init}
                    </div>
                  ))}
                </div>
                <span className="text-yellow-400 text-xs tracking-wide" aria-hidden="true">★★★★★</span>
                <span className="text-white/80 text-xs font-medium">
                  {lang === 'en' ? '500+ companies in Quebec' : '500+ entreprises au Québec'}
                </span>
              </div>

              {/* H1 — three lines, blue accent on line 2 */}
              <h1
                className="font-display font-black text-white text-5xl md:text-6xl xl:text-[76px] leading-[1.0] tracking-[-0.04em] mb-7"
                style={{ animation: 'fadeSlideUp 0.5s 80ms forwards', opacity: 0 }}
              >
                {lang === 'en' ? (
                  <>
                    Your team.<br />
                    <span className="text-va-blue">Your image.</span><br />
                    5 days.
                  </>
                ) : (
                  <>
                    Ton équipe.<br />
                    <span className="text-va-blue">Ton image.</span><br />
                    5 jours.
                  </>
                )}
              </h1>

              {/* Sub */}
              <p
                className="text-white/55 text-lg md:text-xl leading-relaxed mb-10 max-w-[520px]"
                style={{ animation: 'fadeSlideUp 0.5s 180ms forwards', opacity: 0 }}
              >
                {lang === 'en'
                  ? 'Logo printed on your t-shirts, hoodies, polos and caps. Delivery guaranteed in 5 business days — starting from a single piece.'
                  : 'Logo imprimé sur tes t-shirts, hoodies, polos et casquettes. Livraison garantie en 5 jours ouvrables — à partir d’une seule pièce.'}
              </p>

              {/* CTAs */}
              <div
                className="flex flex-wrap items-center gap-3 mb-10"
                style={{ animation: 'fadeSlideUp 0.5s 300ms forwards', opacity: 0 }}
              >
                {/* Magnetic primary CTA — Vol III §07. The outer <Link>'s
                    inline transform is owned by useMagnetic; the inner
                    span keeps the hover/active scale feedback so click
                    feedback still reads when the cursor is in-radius
                    (otherwise the inline translate3d would clobber the
                    Tailwind scale utility on the same element). */}
                <Link
                  ref={heroPrimaryCtaRef}
                  to="/boutique"
                  className="group inline-block rounded-xl shadow-[0_0_36px_rgba(0,71,204,0.32)] hover:shadow-[0_0_52px_rgba(0,71,204,0.55)] transition-shadow duration-200 will-change-transform"
                >
                  <span className="inline-flex items-center gap-2 bg-va-blue text-white font-semibold px-8 py-4 rounded-xl text-[15px] tracking-[0.02em] hover:bg-va-blue-hover group-hover:scale-[1.02] group-active:scale-[0.97] transition-[transform,background-color] duration-200">
                    {lang === 'en' ? 'Order now' : 'Commander maintenant'}
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
                  </span>
                </Link>
                <Link
                  to="/customizer"
                  className="inline-flex items-center bg-transparent text-white/80 font-medium px-8 py-4 rounded-xl text-[15px] border border-white/22 hover:bg-white/6 hover:text-white hover:border-white/40 hover:scale-[1.02] active:scale-[0.97] transition-all duration-200"
                >
                  {lang === 'en' ? 'Customize my product' : 'Personnaliser mon produit'}
                </Link>
              </div>

              {/* Trust bar — 4 micro-claims, va-blue glyphs */}
              <div
                className="flex flex-wrap gap-x-7 gap-y-2"
                style={{ animation: 'fadeIn 0.4s 450ms forwards', opacity: 0 }}
              >
                <div className="flex items-center gap-2 text-white/30 text-sm">
                  <Zap className="w-4 h-4 text-va-blue" aria-hidden="true" />
                  <span>{lang === 'en' ? '5 business days' : '5 jours ouvrables'}</span>
                </div>
                <div className="flex items-center gap-2 text-white/30 text-sm">
                  <Check className="w-4 h-4 text-va-blue" aria-hidden="true" />
                  <span>{lang === 'en' ? 'From 1 piece' : 'À partir d’1 pièce'}</span>
                </div>
                <div className="flex items-center gap-2 text-white/30 text-sm">
                  <StarIcon className="w-4 h-4 text-va-blue" aria-hidden="true" />
                  <span>{lang === 'en' ? '1-year warranty' : 'Garantie 1 an'}</span>
                </div>
                <div className="flex items-center gap-2 text-white/30 text-sm">
                  <Package className="w-4 h-4 text-va-blue" aria-hidden="true" />
                  <span>{lang === 'en' ? 'Free shipping over $300' : 'Livraison gratuite dès 300$'}</span>
                </div>
              </div>
            </div>

            {/* QuickPriceCalculator — frosted glass card, right column on
                lg+, full-width below trust bar on mobile. Animation
                stagger continues at 560ms (after the trust bar's 450ms
                fadeIn) so the eye lands on it last. */}
            <div className="lg:justify-self-end w-full">
              <QuickPriceCalculator />
            </div>
          </div>
        </div>

        {/* Sentinel for mobile sticky CTA — placed at the bottom of the
            hero. Once it leaves the viewport, the sticky bar reveals. */}
        <div
          ref={heroSentinelRef}
          aria-hidden="true"
          className="absolute bottom-0 left-0 h-px w-full pointer-events-none"
        />
      </section>

      {/* ================================================================
          1. LOGO MARQUEE — warm sand band beneath the dark hero. Eyebrow
          + infinite-scroll text pills. Two copies of the list rendered
          back-to-back so the `marquee` keyframe (-50% translate) loops
          seamlessly without a gap.
          ============================================================== */}
      <SectionReveal className="border-y border-va-line/50 py-10 bg-va-sand/50">
        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16">
          <p className="text-va-muted text-[11px] font-semibold uppercase tracking-[0.15em] mb-8 text-center">
            {lang === 'en'
              ? 'Quebec pros choose Vision Affichage'
              : 'Les pros du Québec choisissent Vision Affichage'}
          </p>
          <div
            className="overflow-hidden relative"
            style={{
              maskImage: 'linear-gradient(to right, transparent, black 80px, black calc(100% - 80px), transparent)',
              WebkitMaskImage: 'linear-gradient(to right, transparent, black 80px, black calc(100% - 80px), transparent)',
            }}
          >
            <div className="flex w-max animate-[marquee_25s_linear_infinite]">
              {[...MARQUEE_CLIENTS, ...MARQUEE_CLIENTS].map((name, i) => (
                <div
                  key={i}
                  className="px-8 flex items-center justify-center text-va-ink/70 font-display font-bold text-xl whitespace-nowrap opacity-35 hover:opacity-70 grayscale hover:grayscale-0 transition-all duration-300"
                >
                  {name}
                </div>
              ))}
            </div>
          </div>
        </div>
      </SectionReveal>

      {/* ================================================================
          2. STATS — three CountUp tiles on dark va-ink. Tiles are
          separated by hairline gaps drawn via gap-px on a white/8 bg.
          ============================================================== */}
      <SectionReveal className="bg-va-ink py-24">
        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/8 rounded-3xl overflow-hidden">
            {/* Tile 1 — pieces shipped */}
            <div className="bg-va-ink px-10 md:px-14 py-12 text-center">
              <div className="font-mono font-black text-5xl md:text-6xl text-va-blue tracking-tight mb-2">
                <CountUp to={33000} suffix="+" />
              </div>
              <div className="text-white text-base font-semibold mb-1">
                {lang === 'en' ? 'pieces delivered' : 'pièces livrées'}
              </div>
              <div className="text-white/45 text-sm">
                {lang === 'en' ? 'since 2021' : 'depuis 2021'}
              </div>
            </div>
            {/* Tile 2 — companies */}
            <div className="bg-va-ink px-10 md:px-14 py-12 text-center">
              <div className="font-mono font-black text-5xl md:text-6xl text-va-blue tracking-tight mb-2">
                <CountUp to={500} suffix="+" />
              </div>
              <div className="text-white text-base font-semibold mb-1">
                {lang === 'en' ? 'companies' : 'entreprises'}
              </div>
              <div className="text-white/45 text-sm">
                {lang === 'en'
                  ? 'construction · landscaping · corporate'
                  : 'construction · paysagement · corporate'}
              </div>
            </div>
            {/* Tile 3 — turnaround */}
            <div className="bg-va-ink px-10 md:px-14 py-12 text-center">
              <div className="font-mono font-black text-5xl md:text-6xl text-va-blue tracking-tight mb-2">
                <CountUp to={5} />
              </div>
              <div className="text-white text-base font-semibold mb-1">
                {lang === 'en' ? 'days' : 'jours'}
              </div>
              <div className="text-white/45 text-sm">
                {lang === 'en' ? 'or refunded — no conditions' : 'ou remboursé — sans condition'}
              </div>
            </div>
          </div>
        </div>
      </SectionReveal>

      {/* ================================================================
          3. HOW IT WORKS — white canvas, three steps with ghost numerals
          (01/02/03), va-blue-tint icon tiles, and a CTA arrow on step 3.
          ============================================================== */}
      <SectionReveal className="bg-va-white py-24 md:py-36">
        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16">
          <div className="mb-14">
            <p className="text-va-muted text-[11px] font-semibold uppercase tracking-[0.15em] mb-4">
              {lang === 'en' ? 'The process' : 'Le processus'}
            </p>
            <h2 className="font-display font-black text-va-ink text-4xl md:text-5xl tracking-tight leading-[1.1]">
              {lang === 'en' ? 'Three actions. One uniform.' : 'Trois actions. Un uniforme.'}
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
            {[
              {
                n: '01',
                Icon: Upload,
                fr: { title: 'Tu envoies ton logo.', body: 'PNG, SVG ou JPEG. On accepte tout. Pas de brief, pas de call. Juste ton fichier.' },
                en: { title: 'You send your logo.', body: 'PNG, SVG or JPEG. We accept everything. No brief, no call. Just your file.' },
              },
              {
                n: '02',
                Icon: Printer,
                fr: { title: 'On imprime. Tu approuves rien.', body: 'Notre équipe valide la qualité. Si on n’aime pas, on refait. Tu reçois du parfait.' },
                en: { title: 'We print. You approve nothing.', body: 'Our team checks quality. If we don’t love it, we redo it. You only get perfect.' },
              },
              {
                n: '03',
                Icon: Package,
                fr: { title: 'Tu reçois en 5 jours.', body: 'Livraison garantie 5 jours ouvrables. Au-delà ? On rembourse. Sans condition.' },
                en: { title: 'You get it in 5 days.', body: 'Delivery guaranteed 5 business days. Past that? Full refund. No conditions.' },
              },
            ].map((step) => {
              const copy = lang === 'en' ? step.en : step.fr;
              const isLast = step.n === '03';
              return (
                <div key={step.n} className="relative">
                  {/* Ghost numeral */}
                  <div
                    className="font-mono font-black text-[140px] leading-none text-va-line/40 absolute -top-6 -left-3 select-none pointer-events-none"
                    aria-hidden="true"
                  >
                    {step.n}
                  </div>
                  <div className="relative pt-8">
                    <div className="w-12 h-12 bg-va-blue-tint rounded-xl flex items-center justify-center mb-5">
                      <step.Icon className="w-5 h-5 text-va-blue" aria-hidden="true" />
                    </div>
                    <h3 className="font-display font-bold text-va-ink text-xl mb-3 tracking-tight">
                      {copy.title}
                    </h3>
                    <p className="text-va-dim text-base leading-relaxed mb-5">
                      {copy.body}
                    </p>
                    {isLast && (
                      <Link
                        to="/boutique"
                        className="inline-flex items-center gap-2 text-va-blue font-semibold hover:gap-3 hover:scale-[1.02] active:scale-[0.97] transition-all duration-200"
                      >
                        {lang === 'en' ? 'Order now' : 'Commander maintenant'}
                        <ArrowRight className="w-4 h-4" aria-hidden="true" />
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </SectionReveal>

      {/* ================================================================
          4. FEATURED PRODUCTS — kept as-is from the previous build.
          ============================================================== */}
      <FeaturedProducts />

      {/* ================================================================
          5. LOSS AVERSION — final dark push before reviews. The
          headline frames the cost of inaction; the glowing CTA reads as
          the relief.
          ============================================================== */}
      <SectionReveal className="bg-va-ink py-24 md:py-36">
        <div className="max-w-5xl mx-auto px-6 md:px-12 lg:px-16">
          <p className="text-va-muted text-[11px] font-semibold uppercase tracking-[0.15em] mb-5">
            {lang === 'en' ? 'The invisible cost' : 'Le coût invisible'}
          </p>
          <h2 className="font-display font-black text-white text-4xl md:text-6xl tracking-tight leading-[1.0] mb-8">
            {lang === 'en' ? (
              <>Every week without a uniform,<br /><span className="text-va-blue">that’s lost advertising.</span></>
            ) : (
              <>Chaque semaine sans uniforme,<br /><span className="text-va-blue">c’est de la publicité perdue.</span></>
            )}
          </h2>
          <p className="text-white/45 text-xl leading-relaxed max-w-2xl mb-14">
            {lang === 'en'
              ? 'Your crew drives past 100 homes a week. If nobody knows who they work for — you don’t exist. 500+ Quebec contractors fixed that. Most started with 5 t-shirts.'
              : 'Tes gars passent devant 100 maisons par semaine. Si personne sait c’est qui — tu n’existes pas. 500+ entrepreneurs québécois ont réglé ça. La plupart ont commencé avec 5 t-shirts.'}
          </p>
          <Link
            to="/boutique"
            className="inline-flex items-center gap-2 bg-va-blue text-white px-10 py-5 rounded-xl text-lg font-semibold shadow-[0_0_48px_rgba(0,71,204,0.40)] hover:shadow-[0_0_64px_rgba(0,71,204,0.60)] hover:bg-va-blue-hover hover:scale-[1.02] active:scale-[0.97] transition-all duration-200"
          >
            {lang === 'en' ? 'Order now' : 'Commander maintenant'}
            <ArrowRight className="w-5 h-5" aria-hidden="true" />
          </Link>
          <p className="text-white/20 text-sm mt-5">
            {lang === 'en'
              ? 'Delivery guaranteed in 5 days · No minimum · Refunded if late'
              : 'Livraison garantie en 5 jours · Aucun minimum · Remboursé si retard'}
          </p>
        </div>
      </SectionReveal>

      {/* ================================================================
          6. REVIEWS — sand band, big "5.0" rating + 6 testimonials in a
          horizontal snap-scroll rail.
          ============================================================== */}
      <SectionReveal className="bg-va-sand py-24">
        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8 mb-12">
            <div>
              <div className="font-mono font-black text-7xl md:text-8xl text-va-ink leading-none">
                5.0
              </div>
              <div className="text-yellow-400 text-2xl mt-1" aria-hidden="true">★★★★★</div>
              <div className="text-va-muted text-sm mt-2">
                {lang === 'en' ? '50+ verified Google reviews' : '50+ avis Google vérifiés'}
              </div>
            </div>
            <div className="md:max-w-md">
              <h2 className="font-display font-bold text-3xl text-va-ink leading-tight">
                {lang === 'en'
                  ? 'What entrepreneurs are saying'
                  : 'Ce que les entrepreneurs disent'}
              </h2>
              <p className="text-va-muted mt-2">
                {lang === 'en'
                  ? 'Landscapers, contractors, plumbers, corporate firms.'
                  : 'Paysagistes, contracteurs, plombiers, firmes corporate.'}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto snap-x snap-mandatory -mx-6 md:-mx-12 lg:-mx-16 px-6 md:px-12 lg:px-16 pb-4">
            <div className="flex gap-5 min-w-max">
              {REVIEWS.map((r, i) => {
                const c = lang === 'en' ? r.en : r.fr;
                return (
                  <article
                    key={i}
                    className="bg-white rounded-2xl border border-va-line p-6 w-[320px] flex-shrink-0 snap-start"
                  >
                    <div className="text-yellow-400 text-base mb-3" aria-hidden="true">★★★★★</div>
                    <p className="text-va-dim text-sm italic leading-relaxed mb-5">
                      &ldquo;{c.quote}&rdquo;
                    </p>
                    <div className="font-semibold text-va-ink text-sm">{c.name}</div>
                    <div className="text-va-muted text-xs">{c.company}</div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </SectionReveal>

      {/* ================================================================
          7. FAQ — native <details> accordion, one-at-a-time open. The
          inline <style> tag handles the two CSS rules that can't be
          expressed as Tailwind utilities (::-webkit-details-marker,
          details[open] selector for chevron rotation).
          ============================================================== */}
      <SectionReveal className="scroll-mt-20 py-20 px-6 md:px-10 border-t border-va-line bg-va-white">
        <div className="max-w-[780px] mx-auto">
          <div className="text-center mb-10">
            <div className="text-[11px] font-semibold tracking-[0.15em] uppercase text-va-muted mb-2.5">
              {lang === 'en' ? 'FAQ' : 'Questions fréquentes'}
            </div>
            <h2 className="font-display font-black text-va-ink text-3xl md:text-4xl tracking-tight leading-tight">
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
                className="group rounded-lg bg-white border border-va-line transition-colors hover:bg-va-stone/40"
              >
                <summary className="flex items-center justify-between gap-4 cursor-pointer list-none px-5 py-4 rounded-lg text-[15px] md:text-[16px] font-medium text-va-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-va-blue focus-visible:ring-offset-1">
                  <span>{item.q}</span>
                  <ChevronDown
                    size={18}
                    strokeWidth={2}
                    aria-hidden="true"
                    className="faq-chevron flex-shrink-0 text-va-blue transition-transform duration-200"
                  />
                </summary>
                <div className="px-5 pb-4 pt-0 text-[14px] text-va-dim leading-[1.7]">
                  {item.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </SectionReveal>

      {/* ================================================================
          8. TRUST BADGES — sits just above the footer so the final pre-
          footer impression is the payment-safety promise.
          ============================================================== */}
      <SectionReveal className="border-t border-va-line py-8 px-6 md:px-10 bg-va-white">
        <div className="max-w-[1060px] mx-auto">
          <div className="flex items-center justify-center gap-2 mb-3 text-va-muted">
            <Lock size={12} strokeWidth={2} aria-hidden="true" />
            <span className="text-[11px] font-bold tracking-[2px] uppercase">
              {lang === 'en' ? 'Secure payment' : 'Paiement sécurisé'}
            </span>
          </div>
          <ul className="flex flex-wrap items-center justify-center gap-3">
            <li className="inline-flex items-center h-[28px] px-3 rounded-md border border-va-line bg-va-stone/40 text-[11px] font-black italic tracking-[1px] text-va-muted">
              VISA
            </li>
            <li className="inline-flex items-center gap-1.5 h-[28px] px-3 rounded-md border border-va-line bg-va-stone/40 text-[10px] font-semibold tracking-[0.3px] text-va-muted">
              <svg width="22" height="14" viewBox="0 0 22 14" aria-hidden="true">
                <circle cx="8" cy="7" r="6" fill="currentColor" opacity="0.45" />
                <circle cx="14" cy="7" r="6" fill="currentColor" opacity="0.25" />
              </svg>
              <span>Mastercard</span>
            </li>
            <li className="inline-flex items-center h-[28px] px-3 rounded-md border border-va-line bg-va-stone/40 text-[11px] font-black tracking-[1px] text-va-muted">
              AMEX
            </li>
            <li className="inline-flex items-center gap-1.5 h-[28px] px-3 rounded-md border border-va-line bg-va-stone/40 text-[11px] font-semibold tracking-[0.2px] text-va-muted">
              <svg width="10" height="12" viewBox="0 0 10 12" aria-hidden="true">
                <rect x="1" y="1" width="8" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.3" />
              </svg>
              <span>Apple&nbsp;Pay</span>
            </li>
            <li className="inline-flex items-center gap-1.5 h-[28px] px-3 rounded-md border border-va-line bg-va-stone/40 text-[11px] font-semibold tracking-[0.2px] text-va-muted">
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                <circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" strokeWidth="1.2" />
                <text x="6" y="8.2" textAnchor="middle" fontSize="6.4" fontWeight="700" fill="currentColor" fontFamily="system-ui, sans-serif">G</text>
              </svg>
              <span>Google&nbsp;Pay</span>
            </li>
            <li className="inline-flex items-center gap-1.5 h-[28px] px-3 rounded-md border border-va-line bg-va-stone/40 text-[11px] font-semibold tracking-[0.2px] text-va-muted">
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                <path d="M3 4 V3.2 A2.8 2.8 0 0 1 8.6 3.2 V4 H10 L9.2 10.5 H2.8 L2 4 Z" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
              </svg>
              <span>Shopify</span>
            </li>
          </ul>
        </div>
      </SectionReveal>

      <SiteFooter />

      {/* Sticky mobile CTA bar — appears once the hero sentinel exits
          the viewport. md:hidden keeps it off desktop. z-[445] sits
          below the toast/modal stack (z-50+) so dialogs can still
          cover it. safe-area-inset-bottom protects against the iOS
          home indicator. */}
      <div
        aria-hidden={!showStickyCta}
        className={`md:hidden fixed left-0 right-0 z-[445] bg-va-blue text-white shadow-[0_-6px_24px_rgba(0,0,0,0.18)] ${
          reducedMotion ? '' : 'transition-transform duration-300 ease-out'
        } ${showStickyCta ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ bottom: 'calc(60px + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex items-center justify-between gap-3 h-16 px-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-white/12 flex items-center justify-center flex-shrink-0">
              <Shirt className="text-white" size={20} strokeWidth={1.75} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="text-[12px] font-bold leading-tight text-white truncate">
                {lang === 'en' ? 'Need quality merch?' : 'Du merch de qualité?'}
              </div>
              <div className="text-[10px] text-white/70 leading-tight truncate">
                {lang === 'en' ? 'No minimum · 5-day delivery' : 'Aucun minimum · 5 jours'}
              </div>
            </div>
          </div>
          <Link
            to="/boutique"
            tabIndex={showStickyCta ? 0 : -1}
            className="flex-shrink-0 inline-flex items-center justify-center px-5 h-10 rounded-full bg-white text-va-blue text-[13px] font-extrabold tracking-[-0.2px] shadow-[0_4px_14px_rgba(255,255,255,0.4)] hover:scale-[1.02] active:scale-[0.97] transition-all duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-va-blue"
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
