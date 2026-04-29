import { IndustryPageShell } from '@/components/industries/IndustryPageShell';
import { useLang } from '@/lib/langContext';

/**
 * Mega Blueprint §08.3 — Plomberie & Électricité landing page.
 * Master Prompt "Audi precision" copy: visible, professional, on every
 * site. Embroidered uniforms your technicians wear with pride at the
 * client's door.
 */
// Module-scope const for stable array identity (commit 228d794).
const PLOMBERIE_ELEC_PRODUCT_SKUS: string[] = ['ATC1000', 'S445', 'ATCF2500', 'ATC1015'];

export default function PlomberieElectricite() {
  const { lang } = useLang();
  const isEn = lang === 'en';

  return (
    <IndustryPageShell
      title={
        isEn
          ? 'Visible. Pro. On every site.'
          : 'Visible. Pro. Sur tous les chantiers.'
      }
      metaDescription={
        isEn
          ? "The uniform your technicians wear with pride at the client's door. Embroidered, 5-day turnaround."
          : "L'uniforme que tes techniciens portent fièrement chez le client. Brodé en 5 jours."
      }
      eyebrow={
        isEn
          ? 'Plumbing & Electrical · Quebec'
          : 'Plomberie & Électricité · Québec'
      }
      heroLede={
        isEn
          ? "The uniform your technicians wear with pride at the client's door. Embroidered, 5-day turnaround. Built in Saint-Hyacinthe for Quebec specialists."
          : "L'uniforme que tes techniciens portent fièrement chez le client. Brodé en 5 jours. Production à Saint-Hyacinthe pour les spécialistes québécois."
      }
      heroBullets={
        isEn
          ? [
              'Heavy cotton and polycotton — survives tools and abrasion.',
              "Polos for client visits — sharper than a tee at the door.",
              'Embroidered hoodies for cold-weather outdoor work.',
              'Embroidered logos clear 50+ industrial wash cycles.',
              'Add your RBQ number or licence next to the logo if needed.',
            ]
          : [
              "Coton épais et polycoton — résiste aux outils et aux frottements.",
              "Polos pour visites clients — plus net qu'un t-shirt sur le pas de la porte.",
              "Hoodies brodés pour le travail extérieur en saison froide.",
              "Logos brodés qui passent 50+ lavages industriels.",
              "Ajout du numéro RBQ ou licence à côté du logo, sur demande.",
            ]
      }
      ctaLabel={isEn ? 'Browse products' : 'Voir les produits'}
      ctaHref="/boutique"
      ctaClassName="bg-va-blue hover:bg-va-blue-h text-white"
      productsHeading={
        isEn ? 'Built for the trades.' : 'Conçus pour les métiers spécialisés.'
      }
      productsSubcopy={
        isEn
          ? "Durable, easy to maintain, professional at the client's door."
          : "Durables, faciles à entretenir, professionnels chez le client."
      }
      productSkus={PLOMBERIE_ELEC_PRODUCT_SKUS}
      faqHeading={
        isEn
          ? 'Plumbing & Electrical — straight answers.'
          : 'Plomberie & Électricité — réponses directes.'
      }
      faq={
        isEn
          ? [
              {
                q: 'Can you embroider my RBQ number or certification?',
                a: 'Yes. Alongside your main logo we embroider RBQ, CMEQ or CMMTQ numbers — usually on the sleeve or right chest. Flag it on the quote and we include it on the digital proof before production.',
              },
              {
                q: 'Best style for residential client visits?',
                a: 'Polos S445 (men) and L445 (women) are our top recommendation for at-home service. Structured collar, polycotton fabric — sharp on the doorstep, comfortable under a tool belt. For commercial or industrial sites, ATC1000 tees stay the reference.',
              },
              {
                q: 'My gear gets stained with grease, sealant, oil — does it hold?',
                a: "Cotton and polycotton tees handle high-temperature industrial wash (60-90°C) without significant shrink. For tough stains, prewash with a degreaser. Embroidered logos shrug off industrial detergents — exactly why we prefer them to print for the trades.",
              },
              {
                q: 'Minimum order to start?',
                a: 'No minimum. Start with one sample to validate quality, fit and embroidery before kitting the team. Most plumbing/electrical clients order 2-3 pieces first, then reorder 15-30 once happy. Volume discount kicks in at 24 identical units.',
              },
            ]
          : [
              {
                q: 'Pouvez-vous broder mon numéro RBQ ou ma certification ?',
                a: "Oui. À côté de votre logo principal, on brode RBQ, CMEQ ou CMMTQ — habituellement sur la manche ou la poitrine droite. Indiquez-le à la soumission, on l'inclut sur la preuve numérique avant production.",
              },
              {
                q: 'Quel modèle pour les visites résidentielles ?',
                a: "Polos S445 (homme) et L445 (femme), notre recommandation no.1 pour le service à domicile. Polocol structuré, tissu polycoton — net sur le pas de la porte, confortable sous une ceinture à outils. Pour les chantiers commerciaux ou industriels, le t-shirt ATC1000 reste la référence.",
              },
              {
                q: 'Mes vêtements prennent graisse, mastic, huile — vont-ils tenir ?',
                a: "T-shirts en coton et polycoton supportent les lavages industriels à haute température (60-90°C) sans rétrécir significativement. Pour les taches tenaces, prélavage avec un dégraissant. Le logo brodé résiste aux détergents industriels — précisément pourquoi on le préfère à l'impression pour les métiers spécialisés.",
              },
              {
                q: 'Combien de pièces minimum pour démarrer ?',
                a: "Aucun minimum. Commencez par un seul échantillon pour valider qualité, taille et broderie avant d'équiper l'équipe. La plupart des clients en plomberie/électricité commandent 2-3 pièces d'abord, puis 15-30 quand ils sont satisfaits. Rabais volume à 24 pièces identiques.",
              },
            ]
      }
      serviceType={
        isEn
          ? 'Professional uniforms for plumbers and electricians'
          : 'Uniformes professionnels pour plombiers et électriciens'
      }
      faqLdMarker="data-faq-plomberie-ld"
      serviceLdMarker="data-service-plomberie-ld"
      finalHeading={
        isEn ? 'Suit up the technicians.' : 'Habillez les techniciens.'
      }
      finalSubcopy={
        isEn
          ? 'Browse the catalogue, send the logo, get a digital proof inside 24 hours.'
          : 'Parcourez le catalogue, envoyez le logo, recevez une preuve numérique en moins de 24h.'
      }
    />
  );
}
