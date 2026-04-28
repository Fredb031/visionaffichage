import { IndustryPageShell } from '@/components/industries/IndustryPageShell';

const MUNICIPALITES_PRODUCT_SKUS: string[] = ['S445', 'ATC1000', 'ATCF2500', 'ATC6606'];

/**
 * Mega Blueprint §08.3 — Municipalités landing page. Targets
 * "uniformes municipalité Québec", "vêtements personnel ville",
 * "polos travaux publics municipalité". Recommended pieces cover the
 * dual brief: polos for front-desk / élus, durable tees and hoodies
 * for travaux publics crews.
 */
export default function Municipalites() {
  return (
    <IndustryPageShell
      title="Uniformes pour villes et municipalités | Vision Affichage Québec"
      metaDescription="Vêtements personnalisés pour villes, MRC et municipalités du Québec : travaux publics, loisirs, accueil citoyen. Soumissions par appel d'offres, livraison locale."
      eyebrow="Municipalités · Québec"
      heroLede="Vision Affichage outille les villes, MRC et municipalités québécoises avec des uniformes au logo officiel — polos pour le personnel d'accueil et les élus, t-shirts robustes pour les travaux publics, hoodies pour les moniteurs de camp de jour. Conformité aux appels d'offres municipaux, livraison à l'hôtel de ville sous 5 jours ouvrables."
      heroBullets={[
        'Polos pour personnel d\u2019accueil citoyen, conseillers et élus',
        'T-shirts robustes pour les équipes de travaux publics et voirie',
        'Hoodies brodés pour moniteurs de camp de jour et programmes loisirs',
        'Conforme aux exigences d\u2019appels d\u2019offres municipaux (factures détaillées, soumissions formelles)',
        'Logo officiel de la ville reproduit fidèlement en broderie ou impression',
      ]}
      ctaLabel="Personnaliser pour mon équipe municipalités"
      productsHeading="Vêtements recommandés pour les municipalités"
      productsSubcopy="Notre sélection pour les villes et MRC — du polo représentatif pour l'hôtel de ville au t-shirt durable pour les travaux publics."
      productSkus={MUNICIPALITES_PRODUCT_SKUS}
      faqHeading="Questions fréquentes — Municipalités"
      faq={[
        {
          q: "Pouvez-vous répondre à un appel d'offres public d'une municipalité ?",
          a: "Oui. Nous fournissons régulièrement des soumissions formelles répondant aux exigences SEAO (Système électronique d'appel d'offres) — fiches techniques détaillées par produit, prix unitaires et volumes, fiches de couleurs Pantone, échéancier de production. Envoyez-nous les documents d'appel d'offres et nous préparons une réponse complète dans les délais demandés.",
        },
        {
          q: "Pouvez-vous reproduire fidèlement le logo officiel de notre ville ?",
          a: "Oui. À partir d'un fichier vectoriel (SVG, AI, EPS, PDF) fourni par votre service des communications, nous reproduisons votre logo officiel en broderie ou impression sans altération de proportions ni de couleurs. Une preuve numérique vous est envoyée pour approbation avant production — vous valider la fidélité au standard graphique avant que la moindre pièce ne soit cousue.",
        },
        {
          q: "Pouvons-nous commander des uniformes différents pour différents départements ?",
          a: "Bien sûr. Une seule commande peut couvrir plusieurs départements (travaux publics, loisirs, urbanisme, accueil citoyen) avec des modèles, couleurs et tailles différents — chacun avec son logo et possiblement le nom du département brodé. Nous emballons et étiquetons chaque sous-commande séparément pour faciliter la distribution interne.",
        },
        {
          q: "Avez-vous des termes de paiement adaptés aux municipalités ?",
          a: "Oui. Nous offrons des termes Net 30 sur approbation pour les organismes municipaux, avec facturation par bon de commande et numéro de référence interne. Acceptons aussi le paiement par virement bancaire institutionnel. Pour les très grosses commandes (plus de 500 pièces), un acompte de 50 % à la commande peut être demandé avec solde à la livraison.",
        },
      ]}
      serviceType="Uniformes pour villes et municipalités du Québec"
      faqLdMarker="data-faq-municipalites-ld"
      serviceLdMarker="data-service-municipalites-ld"
    />
  );
}
