import { IndustryPageShell } from '@/components/industries/IndustryPageShell';

/**
 * Mega Blueprint §08.3 — Plomberie & Électricité landing page.
 * Targets "uniformes plombier électricien Québec", "t-shirt entreprise
 * plomberie", "vêtements travailleurs spécialisés". Recommended pieces
 * favour durable cotton tees + work hoodies + polos for client visits.
 */
const PLOMBERIE_ELEC_PRODUCT_SKUS: string[] = ['ATC1000', 'S445', 'ATCF2500', 'ATC1015'];

export default function PlomberieElectricite() {
  return (
    <IndustryPageShell
      title="Uniformes professionnels pour plombiers et électriciens | Québec"
      metaDescription="Vêtements de travail brodés pour entreprises de plomberie et d'électricité au Québec. T-shirts robustes, polos professionnels, hoodies — soumissions par équipe sous 24h."
      eyebrow="Plomberie & Électricité · Québec"
      heroLede="Vision Affichage habille les plombiers, électriciens et techniciens du Québec avec des uniformes au logo qui rassurent vos clients dès la première poignée de main. T-shirts résistants pour le terrain, polos professionnels pour les soumissions, hoodies pour les saisons froides — tous brodés ou imprimés à votre identité."
      heroBullets={[
        'Coton épais et polycoton pour résister aux frottements et aux outils',
        'Polos pour visites clients — paraît plus professionnel qu\u2019un t-shirt',
        'Hoodies brodés pour le travail extérieur en saison froide',
        'Logos en broderie — résiste à plus de 50 lavages industriels',
        'Numéro de RBQ ou licence affiché en plus du logo si désiré',
      ]}
      ctaLabel="Personnaliser pour mon équipe plomberie-électricité"
      productsHeading="Vêtements recommandés pour les métiers spécialisés"
      productsSubcopy="Notre sélection pour les plombiers, électriciens et techniciens — durables, faciles à entretenir, et professionnels en visite client."
      productSkus={PLOMBERIE_ELEC_PRODUCT_SKUS}
      faqHeading="Questions fréquentes — Plomberie & Électricité"
      faq={[
        {
          q: "Pouvez-vous broder mon numéro de licence RBQ ou ma certification ?",
          a: "Oui. En plus de votre logo principal, nous brodons votre numéro de licence RBQ, votre certification CMEQ ou CMMTQ, ou tout autre identifiant réglementaire — généralement sur la manche ou la poitrine droite. Précisez-le au moment de la soumission et nous l'incluons dans la preuve numérique avant production.",
        },
        {
          q: "Quel modèle recommandez-vous pour les visites résidentielles chez les clients ?",
          a: "Nos polos S445 (homme) et L445 (femme) sont notre recommandation no.1 pour le service à domicile. Le polocol structuré et le tissu polycoton donnent un look professionnel qui rassure les clients résidentiels, tout en restant confortable pour porter sous une ceinture à outils. Pour les chantiers commerciaux ou industriels, le t-shirt ATC1000 reste la référence.",
        },
        {
          q: "Mes vêtements vont être tachés de graisse, de mastic ou d'huile — vont-ils tenir ?",
          a: "Nos t-shirts en coton et polycoton supportent les lavages industriels à haute température (60-90°C) sans rétrécir significativement. Pour les taches tenaces (graisse, joint, huile de coupe), nous recommandons un cycle prélavage avec un dégraissant. Le logo brodé n'est pas affecté par les détergents industriels — c'est précisément pourquoi nous le préférons à l'impression pour les métiers spécialisés.",
        },
        {
          q: "Combien d'unités dois-je commander minimum pour démarrer ?",
          a: "Aucun minimum — vous pouvez commencer par un seul échantillon pour valider qualité, taille et rendu de la broderie avant d'équiper toute l'équipe. La plupart de nos clients en plomberie/électricité commandent d'abord 2-3 pièces, puis reviennent pour 15-30 pièces une fois qu'ils sont satisfaits. Le rabais volume s'active à 24 unités identiques.",
        },
      ]}
      serviceType="Uniformes professionnels pour plombiers et électriciens"
      faqLdMarker="data-faq-plomberie-ld"
      serviceLdMarker="data-service-plomberie-ld"
    />
  );
}
