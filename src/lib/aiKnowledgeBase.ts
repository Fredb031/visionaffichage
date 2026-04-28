/**
 * aiKnowledgeBase.ts — Vision Affichage Q&A bank used by the on-site
 * AI chat (src/components/AIChat.tsx).
 *
 * Structure
 * ---------
 *   KB_TOPICS : topics displayed in the FAQ browser, each with a list
 *               of questions + bilingual answers + keywords.
 *   answerQuestion(q, lang) : scores every Q&A against free-form
 *                             input, returns the highest-scoring
 *                             answer or a friendly fallback.
 *
 * Every answer is grounded in real Vision Affichage facts — prices,
 * timelines, products, policies — so the chat never invents info.
 * Update this file when a business fact changes.
 */

export type Lang = 'fr' | 'en';

export type KBEntry = {
  id: string;
  keywords: string[];       // single words (lowercase, no accents) that should trigger this entry
  qFr: string;
  qEn: string;
  aFr: string;
  aEn: string;
};

export type KBTopic = {
  id: string;
  icon: string;             // emoji shown on the topic chip
  titleFr: string;
  titleEn: string;
  entries: KBEntry[];
};

// ─── Knowledge base ────────────────────────────────────────────────────────
/**
 * Frozen at the table, per-topic, per-entry, and per-keyword-array level so
 * a stray consumer (or a future bug anywhere in the SPA) cannot do
 * `KB_TOPICS[0].entries.push(...)` or `entry.aFr = '...'` mid-session and
 * silently corrupt the chat answers for every subsequent render. `as const`
 * already enforces compile-time readonly, but a plain assignment with a
 * `// @ts-expect-error` would still succeed at runtime — freezing makes that
 * mutation throw in strict mode. Mirrors the freeze pattern in pricing.ts,
 * caseStudies, industryProof, experiments, deliveryOptions, tax, orderLogos,
 * shopifySnapshot, i18n, and productDescriptions. The `answerQuestion`
 * matcher only does read-only ops (iteration, `.includes`, `.has`, indexing)
 * so no consumer changes are required.
 */
const KB_RAW: KBTopic[] = [
  {
    id: 'pricing',
    icon: '💰',
    titleFr: 'Prix & paiement',
    titleEn: 'Pricing & payment',
    entries: [
      {
        id: 'price-general',
        keywords: ['prix', 'cost', 'price', 'cout', 'combien', 'cher', 'expensive', 'how', 'much'],
        qFr: 'Combien ça coûte ?',
        qEn: 'How much does it cost?',
        aFr: 'Le prix dépend du produit, de la quantité et de l\u2019impression. Exemple : un T-shirt ATC1000 part de 4,15 $ l\u2019unité + 4,50 $ pour une impression devant. Rabais volume -10 % à partir de 12 unités. Pour un prix précis, utilise le personnalisateur sur la page produit ou appelle le 367-380-4808.',
        aEn: 'Price depends on the product, quantity and printing. Example: an ATC1000 t-shirt starts at $4.15/unit + $4.50 for front printing. Volume discount -10% from 12 units. For an exact price, use the customizer on the product page or call 367-380-4808.',
      },
      {
        id: 'price-tshirt',
        keywords: ['tshirt', 't-shirt', 'shirt', 'chandail'],
        qFr: 'Combien pour un T-shirt ?',
        qEn: 'How much for a t-shirt?',
        aFr: 'T-shirts unisexe à partir de 4,15 $ l\u2019unité (ATC1000). Femme ATC1000L et enfant ATCY2500 : ~5,25 $. Ajoute 4,50 $ pour impression devant, ou 6,50 $ devant + dos.',
        aEn: 'Unisex t-shirts from $4.15/unit (ATC1000). Women\u2019s ATC1000L and kids\u2019 ATCY2500: ~$5.25. Add $4.50 for front print, or $6.50 front + back.',
      },
      {
        id: 'price-hoodie',
        keywords: ['hoodie', 'kangourou', 'coton-ouate', 'sweat'],
        qFr: 'Combien pour un hoodie ?',
        qEn: 'How much for a hoodie?',
        aFr: 'Hoodies à partir de 18,95 $ (ATCF2500). Crewneck ATCF2400 à partir de 17,50 $. Impression 4,50 $ à 8 $ selon la zone.',
        aEn: 'Hoodies from $18.95 (ATCF2500). Crewneck ATCF2400 from $17.50. Printing $4.50 to $8 depending on the zone.',
      },
      {
        id: 'payment-methods',
        keywords: ['paiement', 'payer', 'payment', 'pay', 'carte', 'credit', 'visa', 'mastercard', 'amex', 'apple', 'google'],
        qFr: 'Quels modes de paiement acceptez-vous ?',
        qEn: 'What payment methods do you accept?',
        aFr: 'Carte de crédit via Shopify (PCI-compliant) : Visa, MasterCard, American Express, Apple Pay, Google Pay. Facturation entreprise (net 30) sur demande pour volumes récurrents — écris à info@visionaffichage.com.',
        aEn: 'Credit card via Shopify (PCI-compliant): Visa, MasterCard, American Express, Apple Pay, Google Pay. Net-30 corporate billing available for recurring volumes — email info@visionaffichage.com.',
      },
      {
        id: 'volume-discount',
        keywords: ['rabais', 'discount', 'volume', 'reduction', 'bulk', 'gros'],
        qFr: 'Y a-t-il un rabais de volume ?',
        qEn: 'Is there a volume discount?',
        aFr: 'Oui : -10 % automatique dès 12 unités (toutes couleurs confondues dans une même commande). Au-delà de 50 unités, on peut faire mieux — contacte-nous pour une soumission personnalisée.',
        aEn: 'Yes — automatic -10% at 12 units or more (counted across all colours in a single order). Above 50 units we can do even better — contact us for a custom quote.',
      },
      {
        id: 'tax',
        keywords: ['taxe', 'tax', 'tps', 'qst', 'gst', 'hst'],
        qFr: 'Les taxes sont-elles incluses ?',
        qEn: 'Are taxes included?',
        aFr: 'Non, les taxes sont ajoutées à la caisse. Québec : TPS 5 % + TVQ 9,975 % = 14,975 %. Les autres provinces sont calculées selon leur taux à la livraison.',
        aEn: 'No, taxes are added at checkout. Quebec: GST 5% + QST 9.975% = 14.975%. Other provinces are calculated at the shipping address\u2019s rate.',
      },
      {
        id: 'deposit',
        keywords: ['acompte', 'deposit', 'avance', 'upfront'],
        qFr: 'Avez-vous besoin d\u2019un acompte ?',
        qEn: 'Do you need a deposit?',
        aFr: 'Pour les commandes en ligne, paiement complet à la caisse. Pour les soumissions d\u2019entreprise > 2 000 $, on peut démarrer avec 50 % d\u2019acompte et 50 % à la livraison.',
        aEn: 'For online orders, full payment at checkout. For business quotes > $2,000 we can start with a 50% deposit and 50% on delivery.',
      },
    ],
  },
  {
    id: 'timing',
    icon: '⏱️',
    titleFr: 'Délais & production',
    titleEn: 'Timing & production',
    entries: [
      {
        id: 'turnaround',
        keywords: ['delai', 'delais', 'deadline', 'time', 'combien', 'long', 'days', 'jours', 'production', 'turnaround'],
        qFr: 'Quel est le délai de production ?',
        qEn: 'What is the turnaround time?',
        aFr: '5 jours ouvrables après confirmation de ton épreuve. Du jour 1-2 on valide et t\u2019envoie une épreuve numérique, jours 3-4 production à Québec, jour 5 livraison.',
        aEn: '5 business days after proof confirmation. Days 1-2 we validate and send a digital proof, days 3-4 production in Quebec, day 5 delivery.',
      },
      {
        id: 'rush',
        keywords: ['urgent', 'rush', 'fast', 'rapide', 'express', 'pressed', 'vite', 'emergency'],
        qFr: 'Est-ce possible d\u2019avoir un délai plus rapide ?',
        qEn: 'Can I get a faster turnaround?',
        aFr: 'Oui : production express en 2-3 jours ouvrables (+25 $). Contacte-nous directement au 367-380-4808 pour valider la capacité de la semaine.',
        aEn: 'Yes: express production in 2-3 business days (+$25). Call 367-380-4808 to confirm the week\u2019s capacity.',
      },
      {
        id: 'proof',
        keywords: ['epreuve', 'proof', 'preview', 'apercu', 'mockup', 'visualisation'],
        qFr: 'Vais-je voir une épreuve avant impression ?',
        qEn: 'Will I see a proof before printing?',
        aFr: 'Oui. On envoie une épreuve numérique (photomontage) par courriel dans les 24 heures. La production démarre seulement après ton approbation écrite.',
        aEn: 'Yes. We send a digital mockup by email within 24 hours. Production only starts after your written approval.',
      },
      {
        id: 'artwork-deadline',
        keywords: ['logo', 'artwork', 'file', 'fichier', 'upload', 'envoyer'],
        qFr: 'Jusqu\u2019à quand puis-je envoyer mon logo ?',
        qEn: 'Until when can I send my logo?',
        aFr: 'Idéalement au moment de la commande (via le personnalisateur). Sinon, dans les 24 heures suivant la commande en écrivant à info@visionaffichage.com avec ton numéro de commande.',
        aEn: 'Ideally at order time via the customizer. Otherwise, within 24 hours of ordering by emailing info@visionaffichage.com with your order number.',
      },
    ],
  },
  {
    id: 'products',
    icon: '👕',
    titleFr: 'Produits & tissus',
    titleEn: 'Products & fabrics',
    entries: [
      {
        id: 'product-catalog',
        keywords: ['produit', 'product', 'catalog', 'catalogue', 'vetement', 'garment', 'apparel'],
        qFr: 'Quels produits vendez-vous ?',
        qEn: 'What products do you sell?',
        aFr: 'T-shirts (unisexe, femme, enfant), hoodies, crewnecks, polos, chandails à manches longues, t-shirts sport (respirant), casquettes et tuques. Tous personnalisables avec ton logo ou ton texte.',
        aEn: 'T-shirts (unisex, women, kids), hoodies, crewnecks, polos, long sleeves, sport tees (moisture-wicking), caps and beanies. All customizable with your logo or text.',
      },
      {
        id: 'brand',
        keywords: ['marque', 'brand', 'manufacturer', 'fabricant', 'sanmar', 'atc'],
        qFr: 'De quelle marque sont vos produits ?',
        qEn: 'What brand are your products?',
        aFr: 'Majoritairement ATC (Apparel Technologies Corp), un fournisseur canadien via SanMar. Tissus 100 % coton, mélanges 50/50 coton-polyester, ou performance 100 % polyester selon le modèle.',
        aEn: 'Mostly ATC (Apparel Technologies Corp), a Canadian supplier via SanMar. 100% cotton, 50/50 cotton-polyester blends, or 100% polyester performance depending on the model.',
      },
      {
        id: 'material',
        keywords: ['matiere', 'material', 'fabric', 'tissu', 'coton', 'cotton', 'polyester'],
        qFr: 'Quelle est la composition des tissus ?',
        qEn: 'What\u2019s the fabric composition?',
        aFr: 'T-shirts ATC1000 : 100 % coton filé à l\u2019anneau, 180 g/m². Hoodies ATCF2500 : 80/20 coton-polyester, 320 g/m². Sport ATC6245CM : 100 % polyester anti-humidité.',
        aEn: 'ATC1000 t-shirts: 100% ring-spun cotton, 180 g/m². ATCF2500 hoodies: 80/20 cotton-poly, 320 g/m². ATC6245CM sport: 100% polyester moisture-wicking.',
      },
      {
        id: 'size-guide',
        keywords: ['taille', 'size', 'fit', 'coupe', 'mesure', 'guide'],
        qFr: 'Comment choisir la bonne taille ?',
        qEn: 'How do I pick the right size?',
        aFr: 'Clique sur « Guide des tailles » sur chaque page produit. XS à 5XL selon le modèle. Nos coupes suivent les standards canadiens — ni ajustées, ni oversized.',
        aEn: 'Click "Size guide" on every product page. XS to 5XL depending on model. Our cuts follow Canadian standards — neither slim-fit nor oversized.',
      },
    ],
  },
  {
    id: 'printing',
    icon: '🖨️',
    titleFr: 'Impression',
    titleEn: 'Printing',
    entries: [
      {
        id: 'technique',
        keywords: ['impression', 'print', 'technique', 'method', 'dtg', 'serigraph', 'silkscreen'],
        qFr: 'Quelles techniques d\u2019impression utilisez-vous ?',
        qEn: 'What printing techniques do you use?',
        aFr: 'DTG (direct-to-garment) pour les petites quantités et photos réalistes. Sérigraphie pour les grands volumes (couleurs éclatantes, plus économique à partir de 24 unités). Broderie sur polos, casquettes et tuques.',
        aEn: 'DTG (direct-to-garment) for small runs and realistic photos. Screen printing for large volumes (vivid colours, cheaper from 24 units). Embroidery on polos, caps and beanies.',
      },
      {
        id: 'file-format',
        keywords: ['fichier', 'file', 'format', 'png', 'jpg', 'svg', 'ai', 'eps', 'pdf', 'vector'],
        qFr: 'Dans quel format envoyer mon logo ?',
        qEn: 'What format should I send my logo in?',
        aFr: 'Idéalement un vecteur (SVG, AI, EPS, PDF) pour une impression parfaite à toutes les tailles. PNG ou JPG à au moins 300 DPI fonctionnent aussi. Le personnalisateur retire automatiquement le fond blanc.',
        aEn: 'Ideally a vector (SVG, AI, EPS, PDF) for a perfect print at any size. PNG or JPG at 300 DPI minimum also work. The customizer auto-removes white backgrounds.',
      },
      {
        id: 'zones',
        keywords: ['zone', 'place', 'emplacement', 'ou', 'where', 'coeur', 'chest', 'dos', 'back', 'sleeve', 'manche'],
        qFr: 'Où puis-je faire imprimer mon logo ?',
        qEn: 'Where can I print my logo?',
        aFr: 'Centre poitrine, cœur gauche, dos complet, haut du dos, manche gauche ou droite. Poitrine et cœur gauche sont inclus dans le prix de base. Les autres zones ajoutent 2 $/unité.',
        aEn: 'Center chest, left chest, full back, upper back, left or right sleeve. Center chest and left chest are included in the base print. Other zones add $2/unit.',
      },
      {
        id: 'max-colors',
        keywords: ['couleur', 'color', 'multi', 'pantone', 'cmyk'],
        qFr: 'Combien de couleurs puis-je avoir sur mon logo ?',
        qEn: 'How many colours can my logo have?',
        aFr: 'Illimitées en DTG — même un dégradé passe. En sérigraphie, jusqu\u2019à 6 couleurs sans surcharge ; au-delà on passe en DTG pour garder le prix bas.',
        aEn: 'Unlimited with DTG — even gradients work. With screen-printing, up to 6 colours with no surcharge; beyond that we switch to DTG to keep the price down.',
      },
      {
        id: 'both-sides',
        keywords: ['devant', 'dos', 'front', 'back', 'both', 'deux', 'cote'],
        qFr: 'Puis-je imprimer devant ET dos ?',
        qEn: 'Can I print front AND back?',
        aFr: 'Oui : option « Devant + Dos » dans le personnalisateur. Tu peux y mettre un logo différent (ou un texte) sur chaque côté. L\u2019impression dos ajoute 4 $/unité.',
        aEn: 'Yes: pick "Front + Back" in the customizer. You can add a different logo (or text) on each side. The back print adds $4/unit.',
      },
      {
        id: 'no-logo-design-help',
        keywords: ['pas', 'sans', 'no', 'without', 'design', 'designer', 'aide', 'help', 'creer', 'create', 'graphiste', 'idee', 'idea'],
        qFr: 'Je n\u2019ai pas encore de logo — pouvez-vous m\u2019aider ?',
        qEn: 'I don\u2019t have a logo yet — can you help?',
        aFr: 'Oui. Deux options : (1) texte seul — tu écris ton slogan ou le nom d\u2019équipe dans le personnalisateur et on choisit une typographie ensemble, c\u2019est inclus. (2) Design sur-mesure par notre graphiste — 75 $ pour un logo simple, 150 $ pour un concept complet avec 2 révisions. Écris à info@visionaffichage.com avec ton idée.',
        aEn: 'Yes. Two options: (1) text only — type your slogan or team name in the customizer and we pick a font together, included at no cost. (2) Custom design by our in-house designer — $75 for a simple logo, $150 for a full concept with 2 revisions. Email info@visionaffichage.com with your idea.',
      },
    ],
  },
  {
    id: 'colors-sizes',
    icon: '🎨',
    titleFr: 'Couleurs & tailles',
    titleEn: 'Colours & sizes',
    entries: [
      {
        id: 'colors-available',
        keywords: ['couleur', 'color', 'disponible', 'available', 'palette', 'swatch'],
        qFr: 'Quelles couleurs sont disponibles ?',
        qEn: 'Which colours are available?',
        aFr: 'Plus de 70 couleurs selon le produit : Noir, Blanc, Marine, Bleu royal, Rouge, Forêt, Charbon, Mauve, Or, Bourgogne, et beaucoup d\u2019autres. La palette complète s\u2019affiche sur chaque page produit.',
        aEn: 'Over 70 colours depending on the product: Black, White, Navy, Royal Blue, Red, Forest, Charcoal, Purple, Gold, Burgundy and many more. The full palette appears on every product page.',
      },
      {
        id: 'mix-colors',
        keywords: ['melanger', 'mix', 'combine', 'plusieurs', 'multiple'],
        qFr: 'Puis-je mélanger plusieurs couleurs dans une commande ?',
        qEn: 'Can I mix multiple colours in an order?',
        aFr: 'Oui : dans le personnalisateur, à l\u2019étape « Tailles », tu peux piquer plusieurs couleurs et donner une répartition de tailles pour chacune. Le rabais de 12+ unités s\u2019applique sur le total, toutes couleurs confondues.',
        aEn: 'Yes: at the "Sizes" step in the customizer, pick several colours and give a per-colour size breakdown. The 12+ unit discount applies to the total across all colours.',
      },
      {
        id: 'size-range',
        keywords: ['taille', 'size', 'xs', 'xxl', '5xl', 'small', 'medium', 'large'],
        qFr: 'Jusqu\u2019à quelle taille allez-vous ?',
        qEn: 'How large do your sizes go?',
        aFr: 'XS à 5XL selon le produit. Les t-shirts ATC1000 vont jusqu\u2019à 5XL. Les hoodies jusqu\u2019à 4XL. Tailles femme XS-2XL, enfant XS-XL (6-18 ans).',
        aEn: 'XS to 5XL depending on the product. ATC1000 t-shirts go up to 5XL. Hoodies up to 4XL. Women XS-2XL, kids XS-XL (6-18 yrs).',
      },
    ],
  },
  {
    id: 'shipping',
    icon: '📦',
    titleFr: 'Livraison',
    titleEn: 'Shipping',
    entries: [
      {
        id: 'shipping-cost',
        keywords: ['livraison', 'shipping', 'delivery', 'cout', 'fraisport', 'frais'],
        qFr: 'Combien coûte la livraison ?',
        qEn: 'How much is shipping?',
        aFr: 'Livraison standard : gratuite partout au Canada, 5 jours ouvrables. Express 2-3 jours : 25 $. Collecte en main propre gratuite au studio de Québec sur demande.',
        aEn: 'Standard shipping: free anywhere in Canada, 5 business days. Express 2-3 days: $25. Free in-person pickup at the Quebec City studio on request.',
      },
      {
        id: 'shipping-us',
        keywords: ['usa', 'etats-unis', 'united', 'states', 'international', 'abroad', 'etranger'],
        qFr: 'Livrez-vous aux États-Unis ?',
        qEn: 'Do you ship to the US?',
        aFr: 'Oui, avec un supplément basé sur le poids (généralement 15-40 $ USD). Les frais et délais douaniers s\u2019ajoutent. Contacte-nous pour une estimation précise avant de commander.',
        aEn: 'Yes, with a weight-based surcharge (usually $15-40 USD). Customs fees and delays apply. Contact us for an exact estimate before ordering.',
      },
      {
        id: 'tracking',
        keywords: ['suivre', 'track', 'tracking', 'where', 'ou', 'colis', 'parcel', 'numero', 'number'],
        qFr: 'Comment suivre ma commande ?',
        qEn: 'How do I track my order?',
        aFr: 'Va sur /track, entre ton numéro de commande (reçu par courriel) et ton courriel. Tu verras les étapes : validation, production, expédition, livraison — avec le numéro de suivi Postes Canada ou Purolator.',
        aEn: 'Go to /track, enter your order number (received by email) and your email. You\u2019ll see the stages: validation, production, shipping, delivery — with the Canada Post or Purolator tracking number.',
      },
      {
        id: 'carrier',
        keywords: ['postes', 'canada', 'purolator', 'ups', 'fedex', 'transporteur', 'carrier'],
        qFr: 'Quel transporteur utilisez-vous ?',
        qEn: 'Which carrier do you use?',
        aFr: 'Postes Canada pour la livraison standard. Purolator ou UPS pour express. Les deux incluent un suivi en temps réel et une signature optionnelle.',
        aEn: 'Canada Post for standard. Purolator or UPS for express. Both include live tracking and optional signature.',
      },
    ],
  },
  {
    id: 'order-edit',
    icon: '✏️',
    titleFr: 'Commande & modifications',
    titleEn: 'Orders & edits',
    entries: [
      {
        id: 'edit-order',
        keywords: ['modifier', 'change', 'edit', 'update', 'modif', 'annuler', 'cancel'],
        qFr: 'Puis-je modifier ma commande après l\u2019avoir passée ?',
        qEn: 'Can I modify my order after placing it?',
        aFr: 'Dans les 24 heures : oui, sans frais. Appelle au 367-380-4808 ou écris à info@visionaffichage.com avec ton numéro. Après 24h la production démarre et on ne peut plus changer sans reprendre l\u2019impression.',
        aEn: 'Within 24 hours: yes, at no charge. Call 367-380-4808 or email info@visionaffichage.com with your order number. After 24h production starts and changes require a reprint.',
      },
      {
        id: 'cancel',
        keywords: ['annuler', 'cancel', 'refund', 'rembourser'],
        qFr: 'Puis-je annuler ma commande ?',
        qEn: 'Can I cancel my order?',
        aFr: 'Dans les 24 heures suivant la commande : annulation complète avec remboursement. Après : on rembourse tout sauf le travail déjà réalisé (souvent 10-30 % selon l\u2019étape).',
        aEn: 'Within 24 hours of ordering: full cancellation with refund. After: we refund everything minus work already done (usually 10-30% depending on the stage).',
      },
      {
        id: 'minimum-order',
        keywords: ['minimum', 'min', 'petit', 'small'],
        qFr: 'Avez-vous un minimum de commande ?',
        qEn: 'Do you have a minimum order?',
        aFr: 'Aucun minimum. Tu peux commander 1 seule unité si tu veux (le prix à l\u2019unité sera un peu plus élevé sans le rabais volume).',
        aEn: 'No minimum. You can order a single unit if you want (the per-unit price is slightly higher without the volume discount).',
      },
      {
        id: 'reorder',
        keywords: ['commander', 'nouveau', 'again', 'repeat', 'reorder'],
        qFr: 'Comment recommander la même commande ?',
        qEn: 'How do I reorder the same thing?',
        aFr: 'Connecte-toi à ton compte (/account), ouvre la commande passée, clique « Recommander ». On garde ton logo en archive, donc pas besoin de le re-téléverser.',
        aEn: 'Log into your account (/account), open the previous order, click "Reorder". We archive your logo so no need to re-upload.',
      },
    ],
  },
  {
    id: 'returns',
    icon: '🔁',
    titleFr: 'Retours & garanties',
    titleEn: 'Returns & warranty',
    entries: [
      {
        id: 'return-policy',
        keywords: ['retour', 'return', 'refund', 'rembours', 'echange', 'exchange'],
        qFr: 'Quelle est votre politique de retour ?',
        qEn: 'What\u2019s your return policy?',
        aFr: 'Comme c\u2019est sur-mesure, on ne rembourse pas les erreurs du client (mauvaise taille, mauvais logo, etc.). Par contre, si l\u2019impression est défectueuse ou le tissu est endommagé, on reproduit gratuitement. Signale-nous tout problème dans les 7 jours de la livraison.',
        aEn: 'Since items are custom, we don\u2019t refund customer errors (wrong size, wrong logo, etc.). If the print is defective or the fabric damaged, we reprint for free. Report any issue within 7 days of delivery.',
      },
      {
        id: 'warranty',
        keywords: ['garantie', 'warranty', 'guarantee'],
        qFr: 'Offrez-vous une garantie ?',
        qEn: 'Do you offer a warranty?',
        aFr: 'Oui : 1 an sur l\u2019impression (décollement, craquelage) et 1 an sur le tissu (défaut de fabrication). Lavage à l\u2019envers, eau froide, séchage doux — ça dure des années.',
        aEn: 'Yes: 1 year on the print (peeling, cracking) and 1 year on the fabric (manufacturing defect). Wash inside out, cold water, tumble dry low — they last years.',
      },
      {
        id: 'wash-care',
        keywords: ['laver', 'lavage', 'wash', 'washing', 'care', 'entretien', 'lessive', 'secher', 'sechage', 'dry', 'repasser', 'iron', 'javel', 'bleach'],
        qFr: 'Comment laver et entretenir les vêtements imprimés ?',
        qEn: 'How do I wash and care for printed garments?',
        aFr: 'Lavage à l\u2019envers à l\u2019eau froide (30 °C max), cycle doux, sans javel. Séchage à basse température ou à l\u2019air libre. Repassage à l\u2019envers, fer tiède, jamais directement sur l\u2019impression. En suivant ces règles, l\u2019impression garde son éclat plus de 50 lavages.',
        aEn: 'Wash inside out in cold water (max 30 °C / 85 °F), gentle cycle, no bleach. Tumble dry low or air dry. Iron inside out on low heat — never directly on the print. Following these rules keeps the print sharp for 50+ washes.',
      },
      {
        id: 'quality',
        keywords: ['qualite', 'quality', 'inspection', 'defect', 'defaut'],
        qFr: 'Comment garantissez-vous la qualité ?',
        qEn: 'How do you ensure quality?',
        aFr: 'Chaque commande passe par une inspection visuelle avant expédition. On compare ton épreuve au produit imprimé et on rejette tout défaut. On produit tout à Québec pour garder le contrôle.',
        aEn: 'Every order goes through a visual inspection before shipping. We compare your proof to the printed product and reject any defects. Everything is made in Quebec so we stay in control.',
      },
    ],
  },
  {
    id: 'company',
    icon: '🏢',
    titleFr: 'Entreprise',
    titleEn: 'Company',
    entries: [
      {
        id: 'about',
        keywords: ['qui', 'who', 'about', 'propos', 'entreprise', 'company', 'team', 'equipe'],
        qFr: 'Qui est Vision Affichage ?',
        qEn: 'Who is Vision Affichage?',
        aFr: 'Vision Affichage est un studio québécois de merch corporatif personnalisé fondé par Samuel en 2021. Plus de 33 000 produits livrés à 500+ entreprises. Tout est produit au Québec avec du tissu canadien.',
        aEn: 'Vision Affichage is a Quebec custom corporate merch studio founded by Samuel in 2021. Over 33,000 products delivered to 500+ businesses. Everything made in Quebec with Canadian fabric.',
      },
      {
        id: 'location',
        keywords: ['adresse', 'address', 'ou', 'where', 'location', 'studio', 'shop'],
        qFr: 'Où êtes-vous situés ?',
        qEn: 'Where are you located?',
        aFr: 'Studio à Québec. Livraison partout au Canada et aux États-Unis. Collecte en personne possible sur rendez-vous.',
        aEn: 'Studio in Quebec City. Shipping everywhere in Canada and the US. In-person pickup available by appointment.',
      },
      {
        id: 'clients',
        keywords: ['client', 'customer', 'reference', 'exemple', 'example', 'portfolio'],
        qFr: 'Qui sont vos clients ?',
        qEn: 'Who are your clients?',
        aFr: 'Startups tech, restos-bars, équipes sportives, chantiers de construction, organismes municipaux, et plein d\u2019autres. De 5 unités pour une petite équipe à 2 000 unités pour un événement corporatif.',
        aEn: 'Tech startups, restaurant-bars, sports teams, construction crews, municipal organizations, and many more. From 5 units for a small team to 2,000 units for a corporate event.',
      },
    ],
  },
  {
    id: 'contact',
    icon: '📞',
    titleFr: 'Contact',
    titleEn: 'Contact',
    entries: [
      {
        id: 'contact-all',
        keywords: ['contact', 'tel', 'phone', 'email', 'courriel', 'joindre', 'reach', 'call', 'appel'],
        qFr: 'Comment vous joindre ?',
        qEn: 'How can I reach you?',
        aFr: 'Téléphone : 367-380-4808 (lun-ven 8h-17h heure de l\u2019Est). Courriel : info@visionaffichage.com (réponse sous 24h ouvrables). Ou directement via ce chat.',
        aEn: 'Phone: 367-380-4808 (Mon-Fri 8am-5pm ET). Email: info@visionaffichage.com (reply within 24 business hours). Or right here in this chat.',
      },
      {
        id: 'hours',
        keywords: ['heure', 'hour', 'ouvert', 'open', 'horaire', 'schedule', 'quand', 'when'],
        qFr: 'Quelles sont vos heures d\u2019ouverture ?',
        qEn: 'What are your hours?',
        aFr: 'Lundi au vendredi de 8h à 17h (heure de l\u2019Est). Commandes en ligne acceptées 24/7, elles entrent en production le jour ouvrable suivant.',
        aEn: 'Monday to Friday 8am to 5pm (Eastern). Online orders accepted 24/7 and enter production the next business day.',
      },
      {
        id: 'quote',
        keywords: ['soumission', 'quote', 'devis', 'estimation', 'estimate'],
        qFr: 'Comment obtenir une soumission ?',
        qEn: 'How do I get a quote?',
        aFr: 'Pour une soumission personnalisée : appelle 367-380-4808 avec ton logo, la quantité, et le produit voulu. Ou écris à info@visionaffichage.com en joignant ton logo. Réponse dans la journée.',
        aEn: 'For a custom quote: call 367-380-4808 with your logo, quantity and product. Or email info@visionaffichage.com with your logo attached. Reply the same day.',
      },
    ],
  },
];

/** Deep-freeze the topic table: each topic, each entry, each keyword array.
 *  Mirrors the pattern in src/data/orderLogos.ts (parent freeze + per-row
 *  freeze + per-attachment freeze) and src/data/experiments.ts (per-key
 *  freeze + nested array freeze). Cast through `Readonly<KBTopic[]>` so the
 *  exported type still exposes the original shape to consumers. */
export const KB_TOPICS: ReadonlyArray<Readonly<KBTopic>> = Object.freeze(
  KB_RAW.map(topic =>
    Object.freeze({
      ...topic,
      entries: Object.freeze(
        topic.entries.map(entry =>
          Object.freeze({ ...entry, keywords: Object.freeze([...entry.keywords]) })
        )
      ) as readonly KBEntry[],
    })
  )
) as ReadonlyArray<Readonly<KBTopic>>;

// ─── Answer matcher ────────────────────────────────────────────────────────

/** Strip accents + lowercase so "déLAi" matches "delai". */
function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Tokenize a query into meaningful terms (≥3 chars, no stopwords). */
const STOPWORDS = new Set([
  // FR
  'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'au', 'aux', 'et', 'ou', 'est', 'pour', 'par', 'avec',
  'sur', 'dans', 'que', 'qui', 'quoi', 'quel', 'comment', 'quand', 'est-ce',
  // EN
  'the', 'a', 'an', 'of', 'and', 'or', 'is', 'for', 'with', 'on', 'in', 'to', 'at', 'by',
  'what', 'who', 'how', 'when', 'where', 'why', 'do', 'does', 'can', 'could', 'should',
]);

function tokens(q: string): string[] {
  return normalize(q)
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 3 && !STOPWORDS.has(t));
}

/** Minimum prefix length required for a fuzzy keyword match. Without
 *  this floor, a 2-char keyword like 'no' (in the no-logo-design-help
 *  entry) would match any token that starts with 'no' — 'noir' (black),
 *  'noter', 'nord', etc. — and pull the user toward the wrong answer.
 *  Tokens are already ≥3 chars (see `tokens`), so requiring the shorter
 *  side of the overlap to be ≥3 keeps "fast"/"faster" style fuzz while
 *  rejecting accidental 2-char prefixes. */
const MIN_PREFIX_OVERLAP = 3;

/** Score an entry against a tokenized question. Higher = better match. */
function scoreEntry(entry: KBEntry, qTokens: string[], lang: Lang): number {
  if (qTokens.length === 0) return 0;
  const keywordsNorm = entry.keywords.map(normalize);
  const questionNorm = normalize(lang === 'fr' ? entry.qFr : entry.qEn);
  const questionTokens = new Set(tokens(lang === 'fr' ? entry.qFr : entry.qEn));

  let score = 0;
  for (const t of qTokens) {
    if (keywordsNorm.includes(t))       score += 3;            // exact keyword match
    else if (keywordsNorm.some(k =>
      k.length >= MIN_PREFIX_OVERLAP &&
      (k.startsWith(t) || t.startsWith(k))
    )) score += 2;                                              // prefix overlap (both sides ≥3)
    if (questionTokens.has(t))          score += 1;            // word appears in the reference question
    if (questionNorm.includes(t))       score += 0.5;          // substring match (looser)
  }
  return score;
}

/** Return the best-matching Q&A answer for a free-form question.
 * Falls back to a friendly "call us" message if nothing scores above
 * MIN_SCORE so the chat never invents facts. */
export function answerQuestion(question: string, lang: Lang): { answer: string; entry: KBEntry | null } {
  // Defensive: callers occasionally pass null/undefined/non-string (e.g. an
  // empty form field, an aborted speech-to-text result). Coerce safely so
  // `normalize` never throws on `.toLowerCase()` of a non-string.
  const safeQuestion = typeof question === 'string' ? question : '';
  const qTokens = tokens(safeQuestion);
  if (qTokens.length === 0) {
    return {
      answer: lang === 'fr'
        ? 'Dis-moi ce que tu cherches en quelques mots et je fais de mon mieux.'
        : 'Tell me what you\u2019re looking for in a few words and I\u2019ll do my best.',
      entry: null,
    };
  }

  let best: { entry: KBEntry; score: number } | null = null;
  for (const topic of KB_TOPICS) {
    for (const entry of topic.entries) {
      const s = scoreEntry(entry, qTokens, lang);
      if (s > (best?.score ?? 0)) best = { entry, score: s };
    }
  }

  const MIN_SCORE = 2;
  if (best && best.score >= MIN_SCORE) {
    return { answer: lang === 'fr' ? best.entry.aFr : best.entry.aEn, entry: best.entry };
  }
  return {
    answer: lang === 'fr'
      ? 'Bonne question ! Je ne veux pas inventer de réponse. Le mieux c\u2019est d\u2019appeler au 367-380-4808 (lun-ven 8h-17h) ou d\u2019écrire à info@visionaffichage.com — on répond en moins de 24 h.'
      : 'Good question! I\u2019d rather not make up an answer. Best to call 367-380-4808 (Mon-Fri 8am-5pm ET) or email info@visionaffichage.com — we reply within 24h.',
    entry: null,
  };
}
