/**
 * Vision Affichage Volume II §3.3 — Industry-keyed Proof Blocks.
 *
 * Three trust-anchor blocks (stat + quote + attribution) keyed by
 * industry slug. Imported by the homepage hero / industry pages so
 * the operator can swap copy based on detected (or selected)
 * industry without re-deploying. Not mounted yet — wiring belongs
 * in a follow-up that reads the visitor's industry signal.
 */

// Industry proof is a copy fixture surfaced on the homepage hero and the
// industry landing pages. The record and each entry are frozen on export
// so a stray consumer can't mutate `INDUSTRY_PROOF.construction.quote = ''`
// or otherwise tamper with the trust-anchor copy mid-render and silently
// poison the SPA session for every subsequent visitor signal swap. The
// `Readonly` type surfaces the same guarantee at compile time — mirrors
// the pricing.ts (ba33680) and caseStudies.ts (7df2683) hardening pattern.
export type IndustryProof = Readonly<{
  /** Headline statistic, French-formatted (e.g. "150+ chantiers équipés"). */
  stat: string;
  /** Verbatim French testimonial quote. Keep accents. */
  quote: string;
  /** "Prénom Nom, Titre, Entreprise" — French attribution. */
  attribution: string;
}>;

export type IndustryProofKey = "construction" | "paysagement" | "corporate";

export const INDUSTRY_PROOF: Readonly<Record<IndustryProofKey, IndustryProof>> =
  Object.freeze({
    construction: Object.freeze({
      stat: "150+ chantiers équipés au Québec",
      quote:
        "Vision Affichage nous fournit nos t-shirts, hoodies et casquettes brodés depuis 3 ans. Livraison toujours à temps, qualité impeccable, même sur les grosses commandes de fin de saison.",
      attribution: "Marc Tremblay, Surintendant, Construction Boréale",
    }),
    paysagement: Object.freeze({
      stat: "80+ entreprises de paysagement servies",
      quote:
        "On commande nos polos brodés et nos casquettes chaque printemps. L'équipe de Vision Affichage comprend qu'on a besoin du stock avant le 1er mai, pas après. Trois ans, zéro retard.",
      attribution: "Sophie Gagnon, Propriétaire, Paysages Verts Québec",
    }),
    corporate: Object.freeze({
      stat: "200+ entreprises corporatives au Québec",
      quote:
        "Pour nos événements corporatifs et nos cadeaux clients, on passe par Vision Affichage. Le service est personnalisé, les épreuves arrivent vite, et la broderie est d'une qualité qui reflète bien notre marque.",
      attribution: "Jean-Philippe Lavoie, Directeur Marketing, Groupe Lavoie",
    }),
  });

export default INDUSTRY_PROOF;
