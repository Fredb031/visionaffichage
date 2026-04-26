// Volume II Section 14.1 — Case studies dataset. Drives the
// /histoires-de-succes hub, the /histoires-de-succes/:slug detail
// pages, and the homepage "Ils ont fait confiance à Vision Affichage"
// 3-card row. Four entries cover the four buyer archetypes the brief
// calls out: small construction crew, seasonal landscaper, white-collar
// corporate cabinet, and a municipal account.
//
// Names, numbers, and quotes are realistic Quebec fiction — the brief
// is explicit that these stand in until the operator drops in real
// case studies. Hero images point at /case-studies/<slug>.jpg in the
// public folder; the detail page <img> falls back to a brand-colored
// div via onError so the layout doesn't break before the photos land.

export interface CaseStudy {
  slug: string;
  companyName: string;
  industry: string;
  location: string;
  teamSize: string;
  challenge: string;
  solution: string;
  result: string;
  quote: string;
  quotePerson: string;
  heroImage: string; // placeholder path — operator drops real photo at /public/case-studies/<slug>.jpg
  productsUsed: string[];
  orderSize: string;
  deliveryDays: number;
  orderDate: string;
}

export const CASE_STUDIES: CaseStudy[] = [
  {
    slug: 'construction-rivard',
    companyName: 'Construction Rivard',
    industry: 'Construction résidentielle',
    location: 'Saint-Hyacinthe, QC',
    teamSize: '8 employés',
    challenge:
      "L'équipe de Marc-André arrivait sur les chantiers en t-shirts dépareillés. Les nouveaux clients résidentiels demandaient à voir « les patrons » avant de signer — l'image floue coûtait des contrats.",
    solution:
      "12 t-shirts haute visibilité brodés au logo Rivard, 8 hoodies pour les matins frais, et 8 casquettes assorties. Tissu CSA pour la sécurité, broderie au lieu de l'impression pour durer une saison complète.",
    result:
      "Trois nouveaux contrats résidentiels signés dans les six semaines suivant la livraison. Marc-André attribue deux des trois à « l'effet équipe pro ».",
    quote:
      "On dirait pas, mais quand mes gars débarquent en uniforme avec le logo brodé, le client signe sans négocier. C'est rendu notre meilleur outil de vente.",
    quotePerson: 'Marc-André Rivard, propriétaire',
    heroImage: '/case-studies/construction-rivard.jpg',
    productsUsed: ['t-shirt-haute-visibilite', 'hoodie-zippe', 'casquette-brodee'],
    orderSize: '28 pièces',
    deliveryDays: 5,
    orderDate: '2025-09-12',
  },
  {
    slug: 'paysagement-verdure-qc',
    companyName: 'Paysagement Verdure QC',
    industry: 'Paysagement saisonnier',
    location: 'Granby, QC',
    teamSize: '14 employés saisonniers',
    challenge:
      "Saison de paysagement compressée d'avril à novembre — 14 employés à habiller pour un démarrage le 8 avril, avec un budget serré et la moitié de l'équipe encore à embaucher au moment de la commande.",
    solution:
      "Polos respirants brodés à 14 unités + 6 polos en stock pour les embauches de mi-saison, casquettes ajustables, et coquilles softshell pour les matins de mai. Production prioritaire en 5 jours pour respecter le démarrage.",
    result:
      "Équipe complète habillée le jour 1 de la saison. Les clients résidentiels ont reconnu les uniformes Verdure QC sur les chantiers du voisinage — 11 nouveaux contrats référencés dans les huit premières semaines.",
    quote:
      "Vision a livré en cinq jours pendant qu'un autre fournisseur me promettait trois semaines. Sans eux, je commençais ma saison avec une équipe en t-shirts blancs.",
    quotePerson: 'Stéphanie Verdure, fondatrice',
    heroImage: '/case-studies/paysagement-verdure-qc.jpg',
    productsUsed: ['polo-respirant-brode', 'casquette-brodee', 'softshell-zippe'],
    orderSize: '20 polos + 14 casquettes + 14 softshells',
    deliveryDays: 5,
    orderDate: '2025-04-01',
  },
  {
    slug: 'cabinet-lafleur-conseil',
    companyName: 'Cabinet Lafleur Conseil',
    industry: 'Services-conseils corporatifs',
    location: 'Montréal, QC',
    teamSize: '32 consultants',
    challenge:
      "Cabinet de consultation en pleine croissance préparant une participation au Salon des Affaires de Montréal. 32 consultants à habiller en chemises corporatives élégantes — broderie discrète, pas d'impression criarde, conforme aux standards de l'image corporative.",
    solution:
      "32 chemises Oxford brodées au fil ton-sur-ton (logo cabinet en gris pâle sur tissu blanc), 32 vestes molletonnées pour le cocktail réseautage, et 50 sacs fourre-tout pour les goodies du salon.",
    result:
      "Le cabinet a remporté le prix « Meilleure présentation » au salon. Trois mandats de consultation Fortune 500 signés dans les 90 jours, attribués en partie à la cohésion visuelle de l'équipe.",
    quote:
      "On voulait avoir l'air d'un Big Four sans le budget d'un Big Four. Vision nous a livré exactement ça — broderie ton-sur-ton impeccable, livraison à temps, et un service en français.",
    quotePerson: 'Isabelle Lafleur, associée principale',
    heroImage: '/case-studies/cabinet-lafleur-conseil.jpg',
    productsUsed: ['chemise-oxford-brodee', 'veste-molletonnee', 'sac-fourre-tout'],
    orderSize: '32 chemises + 32 vestes + 50 sacs',
    deliveryDays: 7,
    orderDate: '2025-08-04',
  },
  {
    slug: 'ville-saint-eustache',
    companyName: 'Ville de Saint-Eustache',
    industry: 'Municipal',
    location: 'Saint-Eustache, QC',
    teamSize: '85 employés municipaux',
    challenge:
      "Renouvellement complet des uniformes des employés municipaux (travaux publics, parcs et espaces verts, loisirs). Appel d'offres avec exigences de conformité CSA, identification claire du logo de la Ville, et facturation conforme aux règles d'achat municipal.",
    solution:
      "85 t-shirts haute visibilité CSA Z96 brodés au logo officiel, 85 hoodies marine d'hiver, 85 casquettes brodées, et 40 manteaux d'hiver pour les équipes extérieures. Bon de commande municipal accepté, facturation Net-30.",
    result:
      "Implantation complète en 10 jours ouvrables. Aucune réclamation qualité après six mois de port intensif. La Ville a reconduit le contrat pour les renouvellements 2026.",
    quote:
      "Pour un appel d'offres municipal, ce qu'on cherche c'est zéro surprise — conformité CSA, dates respectées, factures qui passent au comptable du premier coup. Vision a livré sur les trois.",
    quotePerson: 'Robert Tremblay, directeur des achats',
    heroImage: '/case-studies/ville-saint-eustache.jpg',
    productsUsed: ['t-shirt-haute-visibilite', 'hoodie-zippe', 'casquette-brodee', 'manteau-hiver-csa'],
    orderSize: '85 t-shirts + 85 hoodies + 85 casquettes + 40 manteaux',
    deliveryDays: 10,
    orderDate: '2025-10-15',
  },
];
