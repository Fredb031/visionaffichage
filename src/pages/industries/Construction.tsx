import { IndustryPageShell } from '@/components/industries/IndustryPageShell';

/**
 * Mega Blueprint §08.3 — Construction industry SEO landing page.
 * Targets the Quebec keyword cluster "uniformes construction Québec",
 * "vêtements de travail entrepreneurs", "t-shirt chantier personnalisé".
 * The catalogue lacks an explicit hi-vis/ASTM tag, so the recommended
 * cards fall back to the brief's secondary picks (t-shirt, hoodie,
 * crewneck, cap) which are the daily-driver garments construction
 * crews already buy in volume.
 */
// Hoisted to module scope so the array reference is stable across
// re-renders. The shell memoizes resolved products on `productSkus`
// (d57851d); passing an inline literal would mint a new array each
// render and defeat that memo. Module-scope const = same identity for
// the lifetime of the page.
const CONSTRUCTION_PRODUCT_SKUS: string[] = ['ATC1000', 'ATCF2500', 'ATCF2400', 'ATC6606'];

export default function Construction() {
  return (
    <IndustryPageShell
      title="Uniformes personnalisés pour équipes de construction au Québec"
      metaDescription="Vêtements de travail brodés et imprimés pour entrepreneurs et compagnies de construction au Québec. T-shirts, hoodies, casquettes — soumissions gratuites sous 24h."
      eyebrow="Construction · Québec"
      heroLede="Vision Affichage habille les équipes de construction québécoises avec des vêtements robustes, brodés ou imprimés au logo de votre entreprise. Production locale à Saint-Hyacinthe, livraison partout au Québec sous 5 jours ouvrables après l'approbation de la preuve."
      heroBullets={[
        'Tissus durables choisis pour le chantier (coton épais, polycoton renforcé)',
        'Broderie haute densité et impression sérigraphique résistante au lavage',
        'Aucune commande minimum — du sample unique à 500 pièces uniformes',
        'Tailles de S à 4XL disponibles pour la plupart des modèles',
        'Soumissions par équipe avec rabais volume dès 24 unités',
      ]}
      ctaLabel="Personnaliser pour mon équipe construction"
      productsHeading="Vêtements recommandés pour le chantier"
      productsSubcopy="Notre sélection pour les entrepreneurs québécois — modèles éprouvés en chantier, faciles à broder ou imprimer en grande quantité."
      productSkus={CONSTRUCTION_PRODUCT_SKUS}
      faqHeading="Questions fréquentes — Construction"
      faq={[
        {
          q: "Pouvez-vous broder le logo de mon entreprise sur des vêtements de travail ?",
          a: "Oui. La broderie est notre méthode recommandée pour les vêtements de chantier — elle résiste mieux aux lavages industriels et aux frottements que l'impression. Nous brodons jusqu'à 12 couleurs de fil par logo, sur t-shirts, hoodies, polos et casquettes. Envoyez-nous votre logo (vectoriel idéal) et nous le numérisons sans frais à partir de 24 pièces.",
        },
        {
          q: "Quels sont les délais de production pour une commande d'équipe ?",
          a: "Notre délai standard est de 5 jours ouvrables après approbation de la preuve numérique. Pour les gros chantiers nécessitant plus de 100 pièces, comptez 7 à 10 jours. Pour une commande urgente avant un événement (lancement de chantier, salon de la construction), contactez-nous — nous pouvons accommoder en 48h selon la disponibilité.",
        },
        {
          q: "Avez-vous des vêtements haute visibilité ou conformes CSA ?",
          a: "Notre catalogue se concentre actuellement sur les vêtements de marque (t-shirts, hoodies, polos, casquettes) plutôt que sur l'EPI certifié CSA Z96. Pour des dossards haute visibilité conformes, nous pouvons vous orienter vers nos partenaires spécialisés et imprimer votre logo dessus. Demandez-nous une soumission combinée.",
        },
        {
          q: "Offrez-vous des rabais volume pour les compagnies de construction ?",
          a: "Oui. À partir de 24 pièces identiques, le prix par unité baisse automatiquement de 10 %. Pour des commandes récurrentes (renouvellement annuel d'uniformes, nouveau personnel), nous proposons des comptes corporatifs avec tarifs préférentiels. Indiquez-nous votre volume annuel estimé dans la soumission.",
        },
      ]}
      serviceType="Uniformes personnalisés pour entreprises de construction"
      faqLdMarker="data-faq-construction-ld"
      serviceLdMarker="data-service-construction-ld"
    />
  );
}
