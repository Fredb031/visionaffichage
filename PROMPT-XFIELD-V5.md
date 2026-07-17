╔══════════════════════════════════════════════════════════════════════╗
║  VISION AFFICHAGE — MÉGA PROMPT DÉFINITIF v5.0                       ║
║  For: Xfield SuperComputer — build the best corporate merch site      ║
║        of all time.                                                   ║
║  Repo: github.com/Fredb031/visionaffichage                            ║
║  Branch: claude/corporate-merch-website-bbzRy                         ║
║  Live PR: #2 — feat(home): Industrial Precision rebrand               ║
║  Lis tout. Exécute tout. Reporte après chaque phase.                  ║
╚══════════════════════════════════════════════════════════════════════╝

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
0. CONTEXTE ET ÉTAT ACTUEL DU REPO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Vision Affichage est une entreprise québécoise de broderie / sérigraphie
B2B (atelier Blainville / Saint-Hyacinthe). Site actuel: React + Vite +
Tailwind + Fabric.js + GSAP + Framer Motion + Zustand + Supabase +
Shopify Storefront API + Shopify Admin API + Playwright + Lighthouse CI.

## Ce qui EST DÉJÀ FAIT sur la branche `claude/corporate-merch-website-bbzRy`:

✓ **tailwind.config.ts** — palette Industrial Precision installée.
  Gold #C4852A remplace le blue #0047CC. Legacy tokens (`va-blue`,
  `va-sand`, `va-stone`, `va-blue-tint`, `va-blue-h`, etc.) redirigent
  automatiquement vers les nouvelles valeurs (gold, paper, warm, dark,
  border, dim, muted, ghost) — zéro migration manuelle nécessaire dans
  les autres pages. DM Sans (display) + system-sans (body) + Courier New
  (mono) installés.

✓ **index.html** — Google Fonts import DM Sans axe optique 9..40
  (poids 300/400/500/700/800). Meta theme-color → #FAFAF8.

✓ **src/index.css** — body font-family → system-sans. Focus-visible
  outline → #C4852A.

✓ **src/pages/Index.tsx** — RÉÉCRITURE COMPLÈTE (510 lignes).
  Hero éditorial clair, headline "Habille ton équipe ce vendredi." avec
  "ce vendredi." en gold, image hero plein-largeur (Pack été Shopify
  CDN), stats bar avec CTA "VOIR LES PRODUITS →", marquee industries
  (CONSTRUCTION · PAYSAGEMENT · PLOMBERIE · ÉLECTRICITÉ · TOITURE ·
  SÉCURITÉ · TRANSPORT · EXCAVATION · MÉCANIQUE · PEINTURE), bento grid
  6 produits (ATC1000 + S445 grands avec bordure gold en bas; S445LS,
  L445, 6245CM, C100 petits), section process sombre 01/02/03 en
  Courier Black gold, bande garantie gold, social proof 5.0 en Courier
  mono, finale CTA "Chaque semaine sans uniforme, c'est de la pub
  perdue.", FAQ accordion, trust badges. GSAP wired inline: hero
  timeline, ScrollTrigger cascade bento + process, CountUp via
  gsap.to({v:0}), `.section-reveal` universel, `gsap.context()` cleanup,
  short-circuit sur `prefers-reduced-motion`.

✓ **Bento produits** = données Shopify RÉELLES:
  - ATC1000 (t-shirt)             $4.15   handle: atc1000
  - S445 (polo)                   $27.99  handle: s445-1
  - S445LS (polo manches longues) $33.59  handle: s445ls-1
  - L445 (polo femme)             $27.99  handle: l445-1
  - 6245CM (casquette dad)        $11.54  handle: 6245cm
  - C100 (tuque)                  $4.50   handle: c100-1
  Toutes les URLs d'images pointent sur `cdn.shopify.com/s/files/1/0578/1038/7059/files/…` — CDN réel.
  Les liens bento pointent sur `/product/:handle` (route existante).

✓ **Build vérifié** — `vite build` succeeds en ~19s. TypeScript clean.
  ESLint clean sur les fichiers modifiés.

✓ **PR #2 draft ouvert et mergeable**.
  CI: `verify` ✓, `Lighthouse CI` ✓, `claude` skipped, `smoke` ✗
  (échec pré-existant sur main — race condition entre `vite preview &`
  et Playwright dans smoke.yml. Pas causé par ce PR.)

## Ce qui RESTE À FAIRE (ton job, Xfield SuperComputer):

Phases 6 → 10 de ce document. Ne touche PAS Phase 1-5 sauf pour
raffiner. Concentre-toi sur ce qui apporte le plus d'impact visuel et
business.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. IDENTITÉ VISUELLE — INDUSTRIAL PRECISION (déjà installée)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Inspiré de: Carhartt (authority) + COS (restraint) + Kith (premium).
Interdit: Apple style, Stripe blue, SaaS pill badges, frosted glass,
Inter font, rounded-xl corners, blue CTAs, dark hero glow.

## Tokens Tailwind (déjà dans tailwind.config.ts)

va-white       #FFFFFF      ← fond dominant
va-paper       #FAFAF8      ← fond tiède (pas clinique)
va-warm        #F0EDE8      ← cartes, sections alt
va-border      #EBEBEB      ← bordures (tiède)
va-ink         #111111      ← texte primaire
va-dim         #666660      ← texte secondaire
va-muted       #AAAAAA      ← labels, metadata
va-ghost       #DDDDDD      ← placeholders, disabled
va-gold        #C4852A      ← SEUL accent
va-gold-h      #B07520      ← hover
va-gold-tint   #FAF3E5      ← fond doré très clair
va-dark        #111111      ← sections sombres
va-ok          #4A7C59      ← succès (vert naturel)
va-warn        #C4852A      ← warning (= gold)
va-err         #B84040      ← erreur

Legacy aliases → gold (auto-migration):
va-blue, va-blue-hover, va-blue-tint, va-blue-h, va-blue-l →
tous redirigés vers gold / gold-h / gold-tint.

## Typographie

Import HTML head (déjà installé):
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,700;9..40,800&display=swap" media="print" onload="this.media='all'">

font-display: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif
font-sans:    -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif
font-mono:    'Courier New', Courier, monospace

Échelle:
  Hero H1:       DM Sans 800, 44-52px, tracking -.04em, lh .98
  Section H2:    DM Sans 800, 22-26px, tracking -.025em
  Card H3:       DM Sans 700, 13-14px, tracking -.01em
  Body:          system-sans, 12-13px, lh 1.55
  Label:         system-sans, 9-10px, 700, UPPERCASE, tracking .16em
  Price:         Courier New mono, 11-13px, 700
  Stats:         DM Sans 800, 20-44px, tracking -.03em
  Ghost num:     DM Sans 900, 44-52px, color rgba(0,0,0,.06)

## Espacement et proportions

px-24 (desktop) → px-16 (mobile) sections
py-20 à py-28 padding vertical sections
p-10 à p-12 cards
6-8px gap grids (dense, pro)
2-4px border-radius MAX (pas de rounded-xl jamais)
1px solid #EBEBEB borders (toujours tiède)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. COPY PSYCHOLOGIQUE (règles à respecter partout)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Headlines actives sur le site

Homepage hero:  "Habille ton équipe ce vendredi." → "ce vendredi." en gold
Finale CTA:     "Chaque semaine sans uniforme, c'est de la pub perdue." → "perdue." en gold
Final button:   "COMMANDER CE VENDREDI →"
Sub:            "AUCUN MINIMUM · 5 JOURS GARANTIS · REMBOURSÉ SI RETARD · SSL SÉCURISÉ"

## Voice rules (à respecter sur toutes les nouvelles pages)

Tutoiement uniquement: "tu / tes / ton / toi" (jamais "vous / votre")
Chiffres spécifiques: "33 000+" > "des milliers"; "5 jours" > "rapide"
Ultra-spécifique temporel: "ce vendredi" > "cette semaine"
Loss framing: "de la pub perdue" > "gagne de la visibilité"

## Interdits (grep et supprime partout dans nouvelles sections)

"soumission", "cliquez ici", "en savoir plus", "obtenez"
Tout "vous" → remplace par "tu"

## 8 mécanismes psychologiques déjà présents sur la homepage

1. PRIMING VISUEL (Bernays) — palette #FAFAF8 + DM Sans + borders 1px
   programment le cerveau: "compagnie sérieuse comme Carhartt" en 50ms
2. ULTRA-SPÉCIFICITÉ (Cialdini) — "33 000+", "50+", "5 jours"
3. HERD INSTINCT — marquee industries + "500+ ENTREPRISES"
4. LOSS AVERSION (Kahneman) — "pub perdue" > "gain de visibilité"
5. BENTO ASYMÉTRIQUE — 2 grandes cartes attirent 3x l'oeil (eye-tracking)
6. PRIX EN COURIER MONO — signal "chiffre exact, pas marketing"
7. PROCESS EN CHIFFRES 44px — "c'est simple" avant même de lire
8. HEADLINE 4 U's — Useful, Urgent, Unique, Ultra-specific

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. CATALOGUE SHOPIFY LIVE (21 produits actifs — utilise ces données)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CDN base: https://cdn.shopify.com/s/files/1/0578/1038/7059/files

## T-shirts
ATC1000    $4.15   unisexe   handle: atc1000     img: ATC1000-Devant.jpg
ATC1000L   $6.65   femme     handle: atc1000l    img: ATC1000L-Devant.jpg
ATC1000Y   $4.76   enfant    handle: atc1000y-1  img: ATCY1000-Devant.jpg
ATC1015    $11.42  unisexe   handle: atc1015     img: ATC1015-Devant.jpg
L350       $13.99  femme     handle: l350-1      img: L350-Devant.jpg
S350       $13.99  homme     handle: s350-1      img: S350-Devant.jpg
Y350       $13.98  enfant    handle: y350-1      img: Y350-Devant.jpg
WERK250    $16.09  unisexe   handle: werk250-1   img: Werk250-Devant.jpg

## Polos
S445       $27.99  homme     handle: s445-1      img: S445-Devant.jpg
S445LS     $33.59  homme     handle: s445ls-1    img: S445LS-Devant.jpg
L445       $27.99  femme     handle: l445-1      img: L445-Devant.jpg

## Hoodies / Sweats
ATCF2500   $28.90  unisexe   handle: atcf2500    img: ATCF2500-Devant.jpg
ATCF2400   $16.81  unisexe   handle: atcf2400-1  img: ATCF2400-Devant.jpg
ATCF2600   $32.49  unisexe   handle: atcf2600-1  img: ATCF2600-Devant.jpg
ATCY2500   $21.39  enfant    handle: atcy2500-1  img: ATCFY2500-Devant.jpg

## Casquettes
ATC6606    $15.39  accessoire handle: atc6606     img: 6sgh1j.jpg
ATC6277    $20.99  accessoire handle: atc6277-1   img: IMG_5333.jpg
6245CM     $11.54  accessoire handle: 6245cm      img: IMG_5337.jpg

## Tuques
C100       $4.50   accessoire handle: c100-1      img: IMG_5332.jpg
C105       $7.13   accessoire handle: c105-1      img: IMG_5352.jpg

## Bundle
Pack été   $200    handle: pack-ete    img: hf_20260130_190909_bf75301e-d22b-41a1-93d2-5bb932ac4df5_1.png

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. TON JOB — PHASES 6 À 10 (impact business max)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## PHASE 6 — /boutique (Products.tsx) rebrand vers Industrial Precision

Actuellement `/boutique` utilise l'ancienne identité bleu/Syne/Inter.
Rewrite pour:
- Fond va-paper avec cards va-warm
- Filtres en labels 9px uppercase tracking .16em
- Grid produits: 4 colonnes desktop, 2 mobile, gap-2
- Chaque card: image object-contain (JAMAIS cover), height 240px,
  bg-va-paper. Info zone padding 12px avec:
    Label type: 8px 700 uppercase tracking .14em va-muted
    Nom: DM Sans 700 13px va-ink
    Prix: Courier New 700 12px va-ink
    Hover: bg-va-warm → bg-[#e8e3dc], scale 1.04 sur image
- CTA "Personnaliser →" en va-gold sur hover
- Pagination discrète en 10px uppercase
- Zéro badge coloré (pas de "Nouveau!", "Best-seller!" — trop retail)
- Utilise les vraies données Shopify via l'existant Storefront hook

## PHASE 7 — /product/:handle (ProductDetail.tsx) rebrand

- Gallery gauche (60% largeur desktop): image principale square avec
  border va-border. Thumbs sous en grid-cols-4 gap-2.
- Info droite (40%): 
    Type label 9px uppercase va-muted
    Nom DM Sans 800 32px tracking -.025em va-ink
    Prix Courier New 700 20px va-ink
    Description body 13px lh 1.55 va-dim (max 3 lignes puis "Lire plus")
    Sélecteurs couleur: swatches 32x32px rounded-full border va-border
      → gold border on active
    Sélecteurs taille: pills h-10 border va-border rounded-[2px]
      → bg-va-ink text-white on active
    CTA principal: bg-va-gold text-va-ink font-extrabold uppercase 
      tracking .06em "PERSONNALISER MON LOGO →"
    CTA secondaire: outline "Ajouter au panier" (garment nu, pas de logo)
- Trust bar sous CTAs:
    "5 jours livraison · Remboursé si retard · À partir d'1 pièce"
    en 9px uppercase tracking .16em va-muted
- Section "Détails techniques" en dropdowns Courier mono 11px
- Section "Produits similaires" — 4 cards bento style

## PHASE 8 — Customizer (ProductCustomizer.tsx) — le crown jewel

Le customizer Fabric.js est où la vente se fait. Rebrand + fix bugs:

Layout:
- Header dark: bg-va-ink h-14, logo gauche, nav étapes centre 
  (01 Produit · 02 Logo · 03 Placement · 04 Vérification), CTA droite
- Canvas centre: bg-va-warm large area, Fabric canvas centré avec 
  drop shadow subtile
- Sidebar droite 320px: bg-va-paper border-l va-border, sections:
    Placement (zones checkboxes)
    Taille logo (slider Courier valeurs)
    Position (X/Y numériques Courier)
    Rotation (slider degrés)
    Couleurs (swatches va-gold on hover)
- Footer sticky bg-va-white border-t va-border:
    Prix live Courier 700 20px va-ink (updates onChange)
    CTA "AJOUTER AU PANIER →" bg-va-gold text-va-ink

Bugs à fix absolument:
1. Canvas useEffects split (fondamental):
   useEffect A: init canvas UNE FOIS (deps: []) — JAMAIS re-run
   useEffect B: swap garment image (deps: [garmentImageUrl])
   useEffect B ne DOIT PAS toucher au logoRef ni recréer le canvas
2. Center button — fabric.animate() duration 250ms ease easeOutQuart
3. Logo scale preserve aspect ratio automatiquement
4. Logo boundary check contre print zones (feedback toast si sort)
5. Prix live update — debounce 100ms sur onModified

## PHASE 9 — /panier + /commande (Cart.tsx + Checkout.tsx) rebrand

Cart:
- Liste items avec thumb 80x80 va-warm, nom + variant + prix mono
- Boutons +/- couleur va-gold, disabled si stock épuisé
- Total footer sticky Courier 700 24px va-ink
- CTA "COMMANDER →" bg-va-gold text-va-ink
- Cart → Shopify checkout:
    Poll checkoutUrl jusqu'à 8x à 300ms interval
    Erreur si timeout: "Erreur — appelle-nous: 367-380-4808"

Checkout confirmation:
- Design minimal noir/blanc/gold
- Confirmation "Ta commande arrive vendredi." avec date exacte calculée
- Numéro de suivi Courier 700
- CTA "Suivre ma commande" bg-va-gold

## PHASE 10 — Autres pages secondaires

Rebrand rapide pour:
- /about → histoire compagnie, timeline milestone en Courier
- /contact → form épuré, va-warm fields, va-gold submit
- /industries → grid 8 industries (construction, plomberie, etc.)
  chaque avec 1 photo + 1 quote client réel
- /vendor → landing pour B2B partnerships

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. ANIMATIONS GSAP (patterns déjà utilisés — respecte-les)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

npm install gsap (déjà présent — v3.12.5)

import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
if (typeof window !== 'undefined') gsap.registerPlugin(ScrollTrigger)

## Patterns canoniques (utilisés dans Index.tsx — copie tel quel)

// Load timeline hero
const tl = gsap.timeline({ defaults: { ease: 'power3.out', duration: 0.6 } })
tl.from('.hero-headline', { y: 24, opacity: 0 })
  .from('.hero-meta', { y: 16, opacity: 0, duration: 0.5 }, '-=0.4')

// ScrollTrigger cascade
gsap.from('.bento-card', {
  scrollTrigger: { trigger: bentoRef.current, start: 'top 85%' },
  y: 18, opacity: 0, stagger: 0.07, duration: 0.5, ease: 'power2.out'
})

// CountUp via gsap.to({v:0})
const obj = { v: 0 }
gsap.to(obj, {
  v: target,
  scrollTrigger: { trigger: el, start: 'top 90%' },
  duration: 1.4, ease: 'power2.inOut',
  onUpdate() { el.textContent = Math.round(obj.v).toLocaleString('fr-CA') }
})

// Universal section reveal
gsap.utils.toArray('.section-reveal').forEach((s) => {
  gsap.from(s, {
    scrollTrigger: { trigger: s, start: 'top 88%' },
    y: 14, opacity: 0, duration: 0.55, ease: 'power2.out'
  })
})

// Cleanup avec gsap.context() — TOUJOURS
const ctx = gsap.context(() => { ... })
return () => ctx.revert()

// Reduced motion — TOUJOURS short-circuit
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
if (reduced) return

## Micro-interactions attendues partout

Product cards hover:  translateY(-3px), 150ms ease
CTA buttons hover:    scale(1.02) 120ms; active scale(0.97) 80ms
Nav links hover:      color → va-ink 120ms
Product image hover:  scale(1.04) 300ms ease

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6. HIGGSFIELD IMAGES (à générer et upload dans /public/)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Utilise le MCP Higgsfield (déjà connecté). Modèle: soul_2.
Après génération, download vers /public/ et update HERO_IMG dans
src/pages/Index.tsx.

## /public/hero.webp (16:9)

"Cinematic editorial photo. 3 Quebec construction workers standing
confidently on a residential jobsite, golden hour afternoon light.
All wearing identical charcoal black t-shirts with a small clean
white geometric angular logo on the left chest. Shot from street
level, slightly low angle, bokeh suburban Quebec background with
mature trees. Leica-style, desaturated warm color grade, film look.
Natural, authentic — not posed or stock-photo."

## /public/detail.webp (1:1)

"Extreme close-up macro of custom embroidered white logo on left
chest of a premium black polo shirt. White geometric angular lines
forming initials. Visible thread texture, slight depth of field,
dark studio lighting from upper left. Commercial photography.
Very sharp center, soft edges."

## /public/team.webp (4:5)

"Wide editorial photo of 5 Quebec landscaping crew members in a
residential backyard. All wearing matching forest green polo shirts
with small white company logo left chest. Candid, mid-action,
professional. Summer Quebec neighborhood, blue sky, natural light.
Photojournalistic style."

## Post-génération

1. Attends `status: completed` sur les 3 jobs
2. Download les 3 fichiers `.webp` vers `/public/`
3. Optimize (max 150KB hero, 80KB others)
4. Update `HERO_IMG` const dans src/pages/Index.tsx vers `/hero.webp`
5. Ajoute preload dans index.html:
   <link rel="preload" as="image" href="/hero.webp">

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
7. PERFORMANCE + ACCESSIBILITÉ (obligatoire)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Images
- Toutes en WebP (max 150KB hero, 80KB produits)
- loading="lazy" sauf hero (loading="eager" + fetchpriority="high")
- Explicit width + height sur tous les <img>
- alt text pertinent sur chaque (jamais vide, jamais "image")
- onError → fallback background (jamais broken icon)

## Preloads index.html
<link rel="preload" as="image" href="/hero.webp">
<link rel="preload" as="font" href="/dm-sans.woff2" crossorigin>

## vite.config.ts manualChunks (déjà en place, extends si besoin)
vendor-react:    ['react', 'react-dom', 'react-router-dom']
vendor-gsap:     ['gsap']
vendor-fabric:   ['fabric']
vendor-shopify:  ['@shopify/hydrogen-react']
vendor-supabase: ['@supabase/supabase-js']

## Accessibilité obligatoire
input, select, textarea { font-size: 16px !important }  // no iOS zoom (déjà en index.css)
button, a { min-height: 44px }  // WCAG tap targets (déjà en index.css)
focus-visible: outline 2px solid va-gold offset 2px  // (déjà en index.css)
Contrast ratio texte sur fond > 4.5:1 minimum

## Targets Lighthouse mobile
Performance: > 85
LCP: < 2.5s
CLS: < 0.05
FCP: < 1.5s
TBT: < 200ms

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
8. DÉFINITION DE DONE — 30 CHECKPOINTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

☐ /boutique fond va-paper, cards va-warm, image object-contain
☐ /product/:handle gallery gauche + info droite avec Courier prix
☐ Customizer bugs fix: canvas init split, center anim, prix debounce
☐ Customizer rebrand: header sombre, sidebar paper, footer sticky
☐ /panier rebrand avec Courier totals + gold CTA
☐ /commande confirmation "Ta commande arrive vendredi. [date]"
☐ /about timeline avec dates Courier
☐ /contact form épuré va-warm fields
☐ /industries grid 8 industries avec quote client
☐ Higgsfield hero.webp downloaded et wired
☐ Higgsfield detail.webp + team.webp downloaded
☐ Tous <img> ont width/height explicites + alt pertinent
☐ Cart → Shopify checkout poll (8x @ 300ms) avec fallback tel
☐ Login modal render inconditionnel dans Navbar
☐ Zero console errors sur session propre (6 pages principales)
☐ Zero blue #0047CC sur le site (grep vérification)
☐ DM Sans 800 sur tous les headlines (grep vérification)
☐ Courier New sur tous les prix et stats (grep vérification)
☐ Border-radius MAX 4px partout (grep rounded-xl doit être 0)
☐ Tutoiement partout (grep "vous" doit être 0 dans src/)
☐ prefers-reduced-motion respecté partout (short-circuit GSAP)
☐ Focus-visible ring gold visible sur tab
☐ Contrast ratio > 4.5:1 vérifié sur textes principaux
☐ Lighthouse mobile Performance > 85
☐ Lighthouse mobile LCP < 2.5s
☐ Lighthouse mobile CLS < 0.05
☐ Playwright smoke passe (fix le race condition dans smoke.yml si besoin)
☐ vite build succeeds en < 30s
☐ TypeScript strict — 0 errors
☐ ESLint clean sur tous les fichiers modifiés

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
9. RÈGLE D'EXÉCUTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Clone le repo: `git clone https://github.com/Fredb031/visionaffichage`
2. Checkout la branche: `git checkout claude/corporate-merch-website-bbzRy`
3. Install deps: `npm install`
4. Run dev: `npm run dev`
5. Ouvre http://localhost:5173 et vérifie que la homepage rend
   correctement avec le gold + DM Sans + bento (ce qui EST déjà fait)
6. Attaque Phase 6 (/boutique) en premier — plus haut impact business
7. Test en browser après chaque phase (pas juste build vert)
8. Commit après chaque phase avec conventional commit format
9. Push chaque commit et vérifie le CI passe
10. Ne merge PAS le PR #2 — ajoute tes commits dessus, le review humain
    va se faire à la fin

Rapporte après CHAQUE phase:
  ✓ Ce qui a été complété
  ✗ Ce qui a été trouvé (bugs, erreurs, blockers)
  → Ce que tu vas faire ensuite

NE COMMENCE PAS la phase suivante sans confirmation.
NE DÉVIE PAS du design system défini ici.
UTILISE les vraies images Shopify CDN — jamais de placeholder.
UTILISE les vraies données produits ci-dessus.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
10. MCPs CONNECTÉS (utilise-les)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Shopify MCP (production storefront)
- search_products (récupérer catalogue live)
- get-product (détails variant)
- get-inventory-levels (stock temps réel)
- graphql_query (accès complet Admin API)

## Higgsfield MCP (image + video gen)
- generate_image (soul_2 model, aspect_ratio 16:9 | 1:1 | 4:5)
- job_display (poll job status)
- balance (vérifie credits avant gen)

## GitHub MCP (déploiement)
- push_files (multi-file commit atomique)
- create_pull_request (draft)
- pull_request_read (CI status, review comments)
- delete_file (cleanup)

## Adobe MCP (assets create)
- generate_indd_mapping_prompt (design InDesign si besoin)
- image_remove_background (nettoyer photos produits)
- image_apply_preset (color grading uniforme)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FIN — GO BUILD THE BEST CORPORATE MERCH SITE OF ALL TIME
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Contact humain si blocage: 367-380-4808 · info@visionaffichage.com
Owner: Fred Bouchard — fredmalou12@gmail.com
Session Claude Code d'origine: https://claude.ai/code/session_01XBoAdgDBkSdnoVgy9hd4c4
