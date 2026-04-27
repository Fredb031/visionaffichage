// ── Internationalisation — FR/EN ────────────────────────────────────────────

/**
 * Supported UI languages for Vision Affichage.
 *
 * - `fr` — Canadian French (default, primary market)
 * - `en` — English (secondary)
 */
export type Lang = 'fr' | 'en';

/**
 * Frozen dictionary of translation strings for every supported {@link Lang}.
 *
 * The French entry is treated as the source of truth — its keys define the
 * {@link TranslationKey} union, and {@link t} falls back to French when an
 * English key is missing. Strings may contain `%d`/`%s` placeholders that are
 * substituted positionally by {@link t}.
 */
export const translations = {
  fr: {
    // Nav
    connexion: 'Connexion',
    panier: 'Panier',
    voirProduits: 'Voir les produits',
    boutique: 'Boutique',
    accueil: 'Accueil',
    creer: 'Créer',
    // Hero
    kicker: 'Tes clients te jugent avant que tu parles — habille ton équipe à la hauteur.',
    h1line1: 'Commande en',
    h1line2: '3 minutes.',
    h1accent: 'Reçue en 5 jours.',
    heroCta: 'Voir les produits',
    googleReviews: '50+ avis Google',
    // Steps
    step1: 'Choisis ton produit',
    step2: 'Téléverse ton logo',
    step3: 'Reçois en 5 jours',
    // Stats
    produitLivres: 'Produits livrés',
    delaiLivraison: 'Délai de livraison',
    entreprisesSatisfaites: 'Entreprises satisfaites',
    noteGoogle: 'Note Google',
    // Customizer
    personnaliserProduit: 'Personnaliser ce produit',
    personnaliseTonProduit: 'Personnalise ton produit',
    couleur: 'Couleur',
    tonLogo: 'Ton logo',
    zoneImpression: "Zone d'impression",
    taillesQuantites: 'Tailles & quantités',
    resume: 'Résumé',
    choisirCouleur: 'Choisis ta couleur',
    glisserLogo: 'Glisse ton logo ici',
    fondSupprimeAuto: 'PNG · JPG · SVG — Fond supprimé automatiquement',
    supprimerFond: 'Supprimer le fond',
    fondSupprime: 'Fond supprimé',
    zonePredef: 'Zones prédéfinies',
    placementManuel: 'Placement manuel',
    cliquerPlacer: "Clique sur l'image pour positionner ton logo",
    taille: 'Taille',
    retour: 'Retour',
    suivant: 'Suivant',
    ajouterPanier: 'Ajouter au panier',
    produit: 'Produit',
    couleurLabel: 'Couleur',
    quantiteTotale: 'Quantité totale',
    prixUnitaire: 'Prix unitaire',
    impression: 'Impression logo',
    rabaisQuantite: 'Rabais volume (12+)',
    totalEstime: 'Total estimé',
    taxesNote: "Les taxes s'ajoutent à la caisse · Livraison en 5 jours ouvrables",
    commanderPlus: 'Commande %d+ pour -%d%',
    rabaisApplique: '%d% de rabais appliqué !',
    chargementCouleurs: 'Chargement depuis Shopify...',
    couleursDisponibles: '%d couleurs · live sur le 3D',
    zonesRecommandees: 'Zones recommandées · ou place librement',
    rabaisVolume12: '15% de rabais dès 12 unités',
    // Cart
    monPanier: 'Mon panier',
    panierVide: "Ton panier attend ton équipe",
    explorerProduits: 'Explorer les produits',
    codeRabais: 'Code de rabais',
    appliquer: 'Appliquer',
    totalEstimeLabel: 'Total estimé',
    passerCaisse: 'Passer à la caisse',
    livraisonNote: 'Livraison en 5 jours · Paiement sécurisé Shopify',
    unitLabel: 'unité',
    unitPluralLabel: 'unités',
    // 3D Viewer
    glisserTourner: 'Glisse pour tourner',
    devant: 'Devant',
    dos: 'Dos',
    gauche: 'Gauche',
    droite: 'Droite',
    auto: 'Auto',
    logoPlace: 'Logo placé',
    // Product names (real)
    hoodieName: 'Hoodie à capuche unisexe',
    hoodieZipName: 'Hoodie avec fermeture éclair',
    tshirtName: 'T-Shirt',
    casquetteName: 'Casquette Trucker',
    tuqueName: 'Tuque sans rebords',
    // Cart recommendations
    produitsRecommandesAria: 'Produits recommandés',
    // MoleGame strings are inlined in MoleGame.tsx directly — no entries here
  },
  en: {
    connexion: 'Login',
    panier: 'Cart',
    voirProduits: 'See products',
    boutique: 'Shop',
    accueil: 'Home',
    creer: 'Create',
    kicker: 'Your clients judge you before you speak — dress your team to the level you deserve.',
    h1line1: 'Order in',
    h1line2: '3 minutes.',
    h1accent: 'Received in 5 days.',
    heroCta: 'See products',
    googleReviews: '50+ Google reviews',
    step1: 'Choose your product',
    step2: 'Upload your logo',
    step3: 'Receive in 5 days',
    produitLivres: 'Products delivered',
    delaiLivraison: 'Delivery time',
    entreprisesSatisfaites: 'Satisfied companies',
    noteGoogle: 'Google rating',
    personnaliserProduit: 'Customize this product',
    personnaliseTonProduit: 'Customize your product',
    couleur: 'Color',
    tonLogo: 'Your logo',
    zoneImpression: 'Print zone',
    taillesQuantites: 'Sizes & quantities',
    resume: 'Summary',
    choisirCouleur: 'Choose your color',
    glisserLogo: 'Drop your logo here',
    fondSupprimeAuto: 'PNG · JPG · SVG — Background removed automatically',
    supprimerFond: 'Remove background',
    fondSupprime: 'Background removed',
    zonePredef: 'Preset zones',
    placementManuel: 'Manual placement',
    cliquerPlacer: 'Click the image to position your logo',
    taille: 'Size',
    retour: 'Back',
    suivant: 'Next',
    ajouterPanier: 'Add to cart',
    produit: 'Product',
    couleurLabel: 'Color',
    quantiteTotale: 'Total quantity',
    prixUnitaire: 'Unit price',
    impression: 'Logo print',
    rabaisQuantite: 'Volume discount (12+)',
    totalEstime: 'Estimated total',
    taxesNote: 'Taxes added at checkout · Delivered in 5 business days',
    commanderPlus: 'Order %d+ for -%d% off',
    rabaisApplique: '%d% discount applied!',
    chargementCouleurs: 'Loading from Shopify...',
    couleursDisponibles: '%d colors · live 3D preview',
    zonesRecommandees: 'Preset zones · place freely',
    rabaisVolume12: '15% off on 12+ units',
    monPanier: 'My cart',
    panierVide: "Your cart's waiting on your team",
    explorerProduits: 'Explore products',
    codeRabais: 'Discount code',
    appliquer: 'Apply',
    totalEstimeLabel: 'Estimated total',
    passerCaisse: 'Checkout',
    livraisonNote: 'Delivered in 5 days · Secure Shopify payment',
    unitLabel: 'unit',
    unitPluralLabel: 'units',
    glisserTourner: 'Drag to rotate',
    devant: 'Front',
    dos: 'Back',
    gauche: 'Left',
    droite: 'Right',
    auto: 'Auto',
    logoPlace: 'Logo placed',
    hoodieName: 'Unisex Hoodie',
    hoodieZipName: 'Zip-Up Hoodie',
    tshirtName: 'T-Shirt',
    casquetteName: 'Trucker Cap',
    tuqueName: 'Cuffless Beanie',
    produitsRecommandesAria: 'Recommended products',
  },
} as const;

/**
 * Union of every valid translation key, derived from the French dictionary
 * (the source of truth). Use this to constrain props/parameters that accept
 * a copy reference — TypeScript will refuse keys missing from {@link translations.fr}.
 */
export type TranslationKey = keyof typeof translations.fr;

/**
 * Resolve a localised string for the current language with positional
 * interpolation.
 *
 * Lookup order:
 * 1. `translations[lang][key]` — exact match for the requested locale
 * 2. `translations.fr[key]` — French fallback (source of truth)
 * 3. The raw `key` itself — last-resort label so the UI never throws or
 *    renders `undefined` for an unmapped key
 *
 * Each `%d` / `%s` placeholder is replaced once, in order, by the next entry
 * from `args`. Extra args are ignored; missing args leave placeholders intact.
 *
 * @param lang  Active UI language.
 * @param key   Translation key (must exist in the French dictionary).
 * @param args  Values substituted into `%d` / `%s` placeholders, in order.
 * @returns The resolved, interpolated string — never `undefined`.
 *
 * @example
 * t('fr', 'commanderPlus', 12, 15); // "Commande 12+ pour -15%"
 */
export function t(lang: Lang, key: TranslationKey, ...args: (string | number)[]): string {
  const str = (translations[lang][key] as string) ?? (translations.fr[key] as string) ?? key;
  // Walk placeholders left-to-right and consume one `arg` per match. Using a
  // global regex with a function callback ensures every `%d` / `%s` is filled
  // (not just the first of each kind, as a literal `String.replace` would do)
  // and preserves positional order even when the two placeholder kinds are
  // mixed in a single string. Out-of-range args leave the placeholder intact
  // so missing values are visible rather than silently dropped.
  let i = 0;
  return str.replace(/%[ds]/g, (match) => (i < args.length ? String(args[i++]) : match));
}

// ── Pluralisation helper ────────────────────────────────────────────────────
// Uses Intl.PluralRules to resolve the correct plural form for a given count
// and language. FR and EN both map cleanly to `one`/`other` for our UI copy
// (FR groups 0 and 1 under `one`; EN reserves `one` strictly for 1). Callers
// pass explicit strings to keep translations colocated and type-safe.

/**
 * Two-form plural shape used by {@link plural}. FR and EN only ever resolve
 * to `one` or `other` for integer counts in our UI copy, so we do not model
 * `zero` / `two` / `few` / `many` — {@link plural} folds those into `other`.
 */
export interface PluralForms {
  /** Singular form (FR: 0–1, EN: exactly 1). */
  one: string;
  /** Plural form — also the catch-all for any unhandled CLDR category. */
  other: string;
}

// Cache Intl.PluralRules instances — constructing them is not free and we hit
// this helper on every render of list-count strings.
const pluralRulesCache = new Map<Lang, Intl.PluralRules>();

function getPluralRules(lang: Lang): Intl.PluralRules {
  let rules = pluralRulesCache.get(lang);
  if (!rules) {
    rules = new Intl.PluralRules(lang);
    pluralRulesCache.set(lang, rules);
  }
  return rules;
}

/**
 * Pick the correct plural form for `count` in the active language.
 *
 * Backed by `Intl.PluralRules` (cached per-language). Any CLDR category other
 * than `one` falls through to `forms.other`, so callers never need to enumerate
 * `zero` / `two` / `few` / `many` themselves.
 *
 * Defensive guard: a non-finite count (NaN / ±Infinity — e.g. from a divide-
 * by-zero in a derived metric, or an `array.length` read on a value that
 * coerced to a malformed number) would otherwise be handed straight to
 * `Intl.PluralRules.select`, which engines disagree about (some throw, others
 * bucket NaN under `other` silently). Coerce to 0 so the `other` form fires
 * deterministically and the UI never surfaces an engine-specific anomaly.
 * Mirrors the matching guard in {@link "@/lib/plural"}'s helper.
 *
 * @param lang   Active UI language.
 * @param count  Integer-ish count being described.
 * @param forms  Singular / plural copy. See {@link PluralForms}.
 *
 * @example
 * plural('en', items.length, { one: 'item', other: 'items' });
 */
export function plural(lang: Lang, count: number, forms: PluralForms): string {
  const safeCount = Number.isFinite(count) ? count : 0;
  const category = getPluralRules(lang).select(safeCount);
  // FR/EN only emit `one` or `other` for integers, but guard defensively for
  // `zero`/`two`/`few`/`many` by falling back to `other`.
  return category === 'one' ? forms.one : forms.other;
}
