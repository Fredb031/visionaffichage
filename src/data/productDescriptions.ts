import type { Product } from './products';
import type { Lang } from '@/lib/i18n';

// Category copy fixture surfaced on every PDP via getDescription() —
// tagline, paragraphs, feature bullets, and useCase. The arrays and
// records are frozen on export so a stray consumer can't mutate
// `CATEGORY_DESCRIPTIONS.tshirt.features.fr.push('...')` (or similar)
// mid-render and silently corrupt every subsequent product page in the
// SPA session: the same `features` / `paragraphs` reference is reused
// across every PDP that shares a category, so a single mutation poisons
// the cache for the rest of the session. Promoting each LangMap, each
// inner string[], and the top-level Record to Readonly + readonly
// surfaces the same guarantee at compile time, so a "let me just patch
// this bullet" attempt fails the build instead of corrupting a live
// product page. Mirrors the pricing.ts (ba33680), caseStudies (7df2683),
// industryProof (d46762e), experiments (5492998), deliveryOptions
// (c48c04d), tax (20d0b05), orderLogos (cf26d4b), shopifySnapshot
// (ecc0fbf), and i18n (5948294) freezing pattern. Existing consumers
// only call `.map()` and `.join()` on these arrays, so they stay
// compatible with readonly arrays.

type Category = Product['category'];

type LangMap<T> = Readonly<Record<Lang, T>>;

type Description = Readonly<{
  tagline: LangMap<string>;
  paragraphs: LangMap<readonly string[]>;
  features: LangMap<readonly string[]>;
  useCase: LangMap<string>;
}>;

const freezeDescription = (d: Description): Description =>
  Object.freeze({
    tagline: Object.freeze({ ...d.tagline }),
    paragraphs: Object.freeze({
      fr: Object.freeze([...d.paragraphs.fr]) as readonly string[],
      en: Object.freeze([...d.paragraphs.en]) as readonly string[],
    }),
    features: Object.freeze({
      fr: Object.freeze([...d.features.fr]) as readonly string[],
      en: Object.freeze([...d.features.en]) as readonly string[],
    }),
    useCase: Object.freeze({ ...d.useCase }),
  });

export const CATEGORY_DESCRIPTIONS: Readonly<Record<Category, Description>> = Object.freeze({
  tshirt: freezeDescription({
    tagline: {
      fr: "Le classique qui porte ta marque sans la cacher.",
      en: "The classic that carries your brand without hiding it.",
    },
    paragraphs: {
      fr: [
        "Coton ringspun 9,1 oz : un tissu épais qui ne transpire pas ton logo au dos. Le coton est filé serré pour que l'impression reste nette au 50e lavage, pas juste au premier.",
        "Coutures double aiguille sur l'ourlet et les manches : c'est ce qui empêche un t-shirt corporatif de se déformer après un mois de lessive en salle d'employés. Étiquette détachable — retire-la, ton tag de marque prend le relais.",
        "Imprimé au Québec en 5 jours ouvrables. Certifié OEKO-TEX® : pas de résidus chimiques sur la peau de ton équipe.",
      ],
      en: [
        "9.1 oz ringspun cotton: a thick fabric that doesn't telegraph your back print through the front. Tight spin means the print stays sharp at wash 50, not just wash 1.",
        "Double-needle stitching on hem and sleeves — that's what keeps a corporate tee from curling after a month of break-room laundry. Tear-away tag: pull it, your brand label takes over.",
        "Printed in Québec in 5 business days. OEKO-TEX® certified: no chemical residue against your team's skin.",
      ],
    },
    features: {
      fr: [
        "Coton ringspun 9,1 oz — impression nette, pas de transparence",
        "Col côtelé 1×1 — garde sa forme après des centaines d'enfilages",
        "Coutures double aiguille — l'ourlet ne roule pas",
        "Étiquette détachable — remplace-la par la tienne",
        "OEKO-TEX® Standard 100 — sûr au contact peau",
      ],
      en: [
        "9.1 oz ringspun cotton — crisp prints, no see-through",
        "1×1 ribbed collar — holds shape after hundreds of wears",
        "Double-needle seams — hem doesn't curl",
        "Tear-away label — swap in your own brand tag",
        "OEKO-TEX® Standard 100 — skin-safe",
      ],
    },
    useCase: {
      fr: "Parfait pour événements corporatifs, uniformes d'équipe, merch d'entreprise ou cadeaux clients.",
      en: "Perfect for corporate events, team uniforms, company merch or client gifts.",
    },
  }),

  hoodie: freezeDescription({
    tagline: {
      fr: "Le hoodie qu'on garde pour les bonnes raisons.",
      en: "The hoodie people actually keep.",
    },
    paragraphs: {
      fr: [
        "French Terry 13 oz, molleton 3 épaisseurs : le poids qui tient chaud dehors à -15, pas la couche mince qui laisse passer le vent dès que ton équipe sort de l'auto. C'est fait pour durer des hivers, pas des mois.",
        "Traitement anti-boulochage : après 30 lavages, il a encore l'air neuf sur une photo corporative. Œillets en métal argenté au lieu de plastique — les cordons ne se démaillent pas quand quelqu'un tire trop fort. Capuchon doublé pour le confort quand il faut vraiment le remonter.",
        "Certifié OEKO-TEX® et imprimé au Québec en 5 jours ouvrables. Ton logo peut aller devant, dos, manche — l'endroit qui te sert le mieux.",
      ],
      en: [
        "13 oz French Terry, 3-end fleece: the weight that keeps heat in at -15, not the thin shell that lets wind through the second your team steps out of the car. Built for years of winters, not months.",
        "Anti-pilling finish: after 30 washes it still looks clean in a corporate photo. Silver metal grommets instead of plastic — drawstrings don't fray when someone pulls hard. Lined hood for real comfort when the hood actually has to go up.",
        "OEKO-TEX® certified, printed in Québec in 5 business days. Logo goes front, back, or sleeve — wherever works hardest for you.",
      ],
    },
    features: {
      fr: [
        "French Terry 13 oz, 3 épaisseurs — chaleur tient à -15",
        "Anti-boulochage — garde l'air neuf après 30 lavages",
        "Œillets métal argenté — cordons qui ne lâchent pas",
        "Capuchon doublé — confortable quand on le remonte vraiment",
        "Poche kangourou — assez grande pour des gants d'hiver",
      ],
      en: [
        "13 oz 3-end French Terry — holds warmth down to -15",
        "Anti-pilling — still looks new after 30 washes",
        "Silver metal grommets — drawstrings won't tear out",
        "Lined hood — actually comfortable when you pull it up",
        "Kangaroo pocket — fits winter gloves",
      ],
    },
    useCase: {
      fr: "Idéal pour équipes en télétravail, événements d'hiver, programmes de fidélité client ou kits d'accueil employés.",
      en: "Ideal for remote teams, winter events, client loyalty programs or employee onboarding kits.",
    },
  }),

  crewneck: freezeDescription({
    tagline: {
      fr: "Le sweat intemporel, coupe nette, logo qui brille.",
      en: "The timeless sweat, clean cut, logo that stands out.",
    },
    paragraphs: {
      fr: [
        "Même French Terry 3 épaisseurs que le hoodie ATC F2500, sans la capuche : la silhouette reste propre sous un veston ou une veste de chantier. Le molleton intérieur retient la chaleur sans faire chauffer pendant un meeting de 2h.",
        "Col rond côtelé, poignets et taille en côte : c'est la structure qui empêche le sweat de pendre après six mois. Il reste ajusté au corps au lieu de s'étirer aux épaules.",
        "Imprimé dans nos ateliers au Québec en 5 jours ouvrables. Ton logo reste net même après 50 lavages.",
      ],
      en: [
        "Same 3-end French Terry as the ATC F2500 hoodie, minus the hood: the silhouette stays clean under a blazer or a work shell. Interior fleece holds heat without cooking anyone through a 2-hour meeting.",
        "Ribbed crew collar, ribbed cuffs and waistband: that's the structure that keeps the sweat from sagging at six months. It stays fitted to the body instead of stretching out at the shoulders.",
        "Printed in our Québec workshop in 5 business days. Your logo stays sharp even after 50 washes.",
      ],
    },
    features: {
      fr: [
        "French Terry 3 épaisseurs — chaleur sans surchauffe",
        "Col rond côtelé — ne se déforme pas après 6 mois",
        "Poignets et taille en côte — reste ajusté au corps",
        "Pas de capuche — silhouette propre sous un veston",
      ],
      en: [
        "3-end French Terry — warm without overheating",
        "Ribbed crew collar — no stretching at six months",
        "Ribbed cuffs and hem — stays fitted to the body",
        "No hood — clean silhouette under a blazer",
      ],
    },
    useCase: {
      fr: "Pour les équipes qui veulent du merch porté toute l'année, pas juste au party de Noël.",
      en: "For teams that want merch worn year-round, not just at the holiday party.",
    },
  }),

  polo: freezeDescription({
    tagline: {
      fr: "Le polo sobre qui fait bien paraître ta marque.",
      en: "The understated polo that makes your brand look sharp.",
    },
    paragraphs: {
      fr: [
        "Tissu respirant avec coupe droite : c'est le polo qui ne colle pas au dos d'un représentant à la fin d'un salon de 8h. L'air passe, le vêtement reste sec, ton équipe a l'air pro sur la photo de fin de journée.",
        "Placket 3 boutons et col polo classique : la structure qui fait la différence entre un polo qui tient et un qui pend de travers après le dîner. Lavable en machine — pas de facture de nettoyage à sec à refiler à ton équipe.",
        "Ton logo brodé ou imprimé, fabriqué au Québec, livré en 5 jours ouvrables.",
      ],
      en: [
        "Breathable fabric with a straight cut: this is the polo that doesn't cling to a rep's back at the end of an 8-hour trade show. Air moves, the garment stays dry, your team still looks pro in the end-of-day photo.",
        "3-button placket and classic polo collar: the structure that separates a polo that holds from one that sags off-kilter after lunch. Machine-washable — no dry-cleaning bill to expense.",
        "Your logo embroidered or printed, made in Québec, delivered in 5 business days.",
      ],
    },
    features: {
      fr: [
        "Tissu respirant — ne colle pas au dos après 8h",
        "Col polo classique — tient droit toute la journée",
        "Placket 3 boutons — finition propre, pas de bâillement",
        "Lavable en machine — pas de nettoyage à sec",
      ],
      en: [
        "Breathable fabric — doesn't cling at the 8-hour mark",
        "Classic polo collar — holds all day",
        "3-button placket — clean finish, no gapping",
        "Machine-washable — no dry cleaner required",
      ],
    },
    useCase: {
      fr: "Uniformes de service, événements corporatifs, tournois de golf, équipes de direction.",
      en: "Service uniforms, corporate events, golf tournaments, leadership teams.",
    },
  }),

  longsleeve: freezeDescription({
    tagline: {
      fr: "Manches longues, logo affiché, couverture 3 saisons.",
      en: "Long sleeves, logo on display, 3-season coverage.",
    },
    paragraphs: {
      fr: [
        "La polyvalence d'un t-shirt avec la couverture d'une couche intermédiaire. Les manches longues donnent de l'espace pour faire passer ton branding sans surcharger le devant.",
        "Fabriqué au Québec, imprimé en 5 jours ouvrables, porté du printemps à l'automne.",
      ],
      en: [
        "The versatility of a t-shirt with the coverage of a mid-layer. Long sleeves give room to spread your branding without crowding the front.",
        "Made in Québec, printed in 5 business days, worn spring through fall.",
      ],
    },
    features: {
      fr: [
        "Coton-mélange qui respire",
        "Manchettes côtelées anti-remontée",
        "Impression manche possible (prix avantageux)",
        "Coupe unisexe balancée",
      ],
      en: [
        "Cotton-blend that breathes",
        "Ribbed cuffs, no ride-up",
        "Sleeve print option (favorable pricing)",
        "Balanced unisex fit",
      ],
    },
    useCase: {
      fr: "Équipes extérieures, événements en demi-saison, uniformes légers, couche de base polyvalente.",
      en: "Outdoor teams, shoulder-season events, light uniforms, versatile base layer.",
    },
  }),

  sport: freezeDescription({
    tagline: {
      fr: "Performance-grade. Fait pour bouger avec ta marque.",
      en: "Performance-grade. Made to move with your brand.",
    },
    paragraphs: {
      fr: [
        "Tissu technique qui évacue l'humidité, coupe athlétique, coutures plates pour zéro irritation. C'est le vêtement pour les événements sportifs, les équipes actives, les courses de charité.",
        "Ton logo imprimé en transfert sublimation — la couleur devient partie du tissu, ne craque jamais.",
      ],
      en: [
        "Technical fabric that wicks moisture, athletic cut, flat-lock seams for zero chafing. The garment for sports events, active teams, charity runs.",
        "Your logo printed by sublimation transfer — the color becomes part of the fabric, never cracks.",
      ],
    },
    features: {
      fr: [
        "Polyester recyclé technique, anti-humidité",
        "Coutures plates, confort haute intensité",
        "Sublimation couleur pleine",
        "Coupe athlétique ajustée",
      ],
      en: [
        "Technical recycled polyester, moisture-wicking",
        "Flat-lock seams, high-intensity comfort",
        "Full-color sublimation",
        "Athletic fitted cut",
      ],
    },
    useCase: {
      fr: "Courses, tournois, équipes sportives corporatives, événements actifs.",
      en: "Races, tournaments, corporate sports teams, active events.",
    },
  }),

  cap: freezeDescription({
    tagline: {
      fr: "La casquette qui devient le geste de ton équipe.",
      en: "The cap that becomes your team's signature.",
    },
    paragraphs: {
      fr: [
        "Panneau avant structuré en coton : la surface plane et rigide qui donne à la broderie un rendu propre, sans vagues. La maille filet derrière (5 panneaux) laisse passer l'air — on peut la porter sur un chantier en juillet sans avoir le front trempé.",
        "Snapback réglable : une seule taille pour toute ton équipe, du stagiaire au VP. Pas de casse-tête XL/L/M à gérer à la commande.",
        "Brodée ou imprimée, fabriquée au Québec, 5 jours ouvrables.",
      ],
      en: [
        "Structured cotton front panel: the flat, rigid surface that gives embroidery a clean read, no ripples. Mesh back (5 panels) lets air through — wearable on a July job site without a soaked forehead.",
        "Adjustable snapback: one size fits the whole team, from the intern to the VP. No XL/L/M sizing puzzle on the order form.",
        "Embroidered or printed, made in Québec, 5 business days.",
      ],
    },
    features: {
      fr: [
        "Panneau avant coton structuré — broderie nette, pas de vagues",
        "5 panneaux en maille filet — front ne trempe pas en été",
        "Snapback réglable — une taille pour toute l'équipe",
        "Zone broderie avant optimisée pour logos d'entreprise",
      ],
      en: [
        "Structured cotton front — crisp embroidery, no ripples",
        "5 mesh panels — no soaked forehead in summer",
        "Adjustable snapback — one size fits the whole team",
        "Front embroidery zone sized for corporate logos",
      ],
    },
    useCase: {
      fr: "Événements plein air, équipes terrain, cadeaux clients, goodies de conférence.",
      en: "Outdoor events, field teams, client gifts, conference goodies.",
    },
  }),

  toque: freezeDescription({
    tagline: {
      fr: "La tuque qui vit bien au Québec — et fait voyager ta marque.",
      en: "The beanie that handles Québec winters — and carries your brand anywhere.",
    },
    paragraphs: {
      fr: [
        "Acrylique 100% double épaisseur : deux couches au lieu d'une, c'est ce qui fait la différence entre une tuque qui tient chaud à -20 et une qui passe juste le vent. Séchage rapide quand la neige fond sur le tissu.",
        "Rebord retroussé : la zone de broderie la plus visible de l'hiver — au niveau des yeux de la personne qui te croise. Ton logo voyage partout où ton équipe va.",
        "Fabriquée au Québec, 5 jours ouvrables. À 4,50$ unité, c'est le cadeau client qui ne fait pas mal au budget et qui reste dans la garde-robe.",
      ],
      en: [
        "100% acrylic, double-knit: two layers instead of one — the difference between a beanie that holds heat at -20 and one that just breaks wind. Dries fast when snow melts on it.",
        "Folded cuff: the most-seen branding surface of winter, right at eye-level of anyone walking past. Your logo travels wherever your team goes.",
        "Made in Québec, 5 business days. At $4.50 a unit, it's the client gift that doesn't blow the budget and still lives in the wardrobe.",
      ],
    },
    features: {
      fr: [
        "Acrylique 100% double épaisseur — chaleur à -20",
        "Rebord retroussé — broderie visible à hauteur des yeux",
        "Séchage rapide — gère la neige fondue",
        "Taille unique — pas de gestion XS/M/L à la commande",
      ],
      en: [
        "100% acrylic double-knit — warm down to -20",
        "Folded cuff — embroidery at eye-level",
        "Fast-drying — handles wet snow",
        "One size — no XS/M/L headache on the order",
      ],
    },
    useCase: {
      fr: "Événements hivernaux, staff extérieur, cadeaux clients pour le temps des fêtes.",
      en: "Winter events, outdoor staff, holiday client gifts.",
    },
  }),
});

export function getDescription(category: Category, lang: Lang = 'fr') {
  // Defensive lookup: if a future Category value (or a stringly-typed
  // caller from JSX) bypasses TS, fall back to 'tshirt' so we never
  // surface "Cannot read properties of undefined" on a product page.
  const d = CATEGORY_DESCRIPTIONS[category] ?? CATEGORY_DESCRIPTIONS.tshirt;
  return {
    tagline: d.tagline[lang],
    paragraphs: d.paragraphs[lang],
    features: d.features[lang],
    useCase: d.useCase[lang],
  };
}
