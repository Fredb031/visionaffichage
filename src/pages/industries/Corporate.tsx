import { IndustryPageShell } from '@/components/industries/IndustryPageShell';
import { useLang } from '@/lib/langContext';

/**
 * Mega Blueprint §08.3 — Corporate landing page.
 * Master Prompt "Audi precision" copy: short, declarative, ships to the
 * office. Polos, vestes, casquettes — embroidered, dropped at reception.
 */
// Hoisted to module scope so the array reference is stable across
// re-renders. Module-scope const = same identity for the lifetime of
// the page (commit 73b7be5).
const CORPORATE_PRODUCT_SKUS: string[] = ['S445', 'WERK250', 'ATCF2500', 'L445'];

export default function Corporate() {
  const { lang } = useLang();
  const isEn = lang === 'en';

  return (
    <IndustryPageShell
      title={
        isEn
          ? 'Corporate uniforms, no fuss.'
          : "L'uniforme corporatif sans complications."
      }
      metaDescription={
        isEn
          ? 'Embroidered polos, jackets and caps with your company logo. 5 days, delivered to your office.'
          : "Polos, vestes et casquettes brodés au logo de ton entreprise. 5 jours, livré au bureau."
      }
      eyebrow={isEn ? 'Corporate · Quebec' : 'Corporate · Québec'}
      heroLede={
        isEn
          ? 'Embroidered polos, jackets and caps with your company logo. 5 days, delivered to your office. Built in Saint-Hyacinthe, packed by employee.'
          : "Polos, vestes et casquettes brodés au logo de ton entreprise. 5 jours, livré au bureau. Production à Saint-Hyacinthe, emballage par employé."
      }
      heroBullets={
        isEn
          ? [
              'Polos for sales, advisory and HR teams.',
              'Premium tees for events and brand launches.',
              'Onboarding kits: hoodie + tee + cap + beanie.',
              'High-density embroidery — sharp on dark colours.',
              'Packed by size, by name. Ready to hand out.',
            ]
          : [
              'Polos pour équipes de vente, conseil et RH.',
              'T-shirts premium pour événements et lancements de marque.',
              "Kits d'embauche : hoodie + t-shirt + casquette + tuque.",
              'Broderie haute densité — net sur les couleurs sombres.',
              'Emballé par taille, par employé. Prêt à distribuer.',
            ]
      }
      ctaLabel={isEn ? 'Browse products' : 'Voir les produits'}
      ctaHref="/boutique"
      ctaClassName="bg-va-blue hover:bg-va-blue-h text-white"
      productsHeading={isEn ? 'Built for the office.' : 'Conçus pour le bureau.'}
      productsSubcopy={
        isEn
          ? 'Tailored cuts, premium fabrics, embroidery that holds the brand line.'
          : "Coupes ajustées, tissus haut de gamme, broderie qui tient la ligne de marque."
      }
      productSkus={CORPORATE_PRODUCT_SKUS}
      faqHeading={
        isEn ? 'Corporate — straight answers.' : 'Corporate — réponses directes.'
      }
      faq={
        isEn
          ? [
              {
                q: 'Can you handle onboarding kits for new hires?',
                a: 'Yes. Standardised kits (e.g. polo + hoodie + tee + beanie, all embroidered) packed individually by name and size. Send the monthly list — we manage replenishment and ship to the office or directly to remote employees.',
              },
              {
                q: 'Can you match our exact corporate Pantone?',
                a: 'Yes. Pantone (PMS) match on screen print or embroidery from a sample or brand book. A small set-up fee may apply on runs under 12 pieces. For fabric colours, our SanMar/ATC suppliers stock most corporate tones at no upcharge.',
              },
              {
                q: 'Net 30 corporate billing?',
                a: 'Net 30 terms on credit approval for recurring orders or guaranteed annual volume. Simplifies bookkeeping for uniform refresh and event runs. Ask your advisor for the form on your first quote.',
              },
              {
                q: 'Lead time for a corporate event?',
                a: '5 business days after proof approval. For a fixed event date, send the quote at least 3 weeks ahead. Rushes possible at 48-72h on stock availability.',
              },
            ]
          : [
              {
                q: "Pouvez-vous gérer les kits d'embauche ?",
                a: "Oui. Kits standardisés (par exemple : polo + hoodie + t-shirt + tuque, tous brodés) emballés individuellement par nom et taille. Envoyez la liste mensuelle — on gère le ré-approvisionnement et la livraison au bureau ou directement à l'employé en télétravail.",
              },
              {
                q: 'Match exact de notre code Pantone corporatif ?',
                a: "Oui. Match Pantone (PMS) en sérigraphie ou broderie à partir d'un échantillon ou d'une charte. Petit frais de mise en couleur sur les séries < 12 pièces. Pour les couleurs de tissu, nos fournisseurs SanMar/ATC offrent la plupart des teintes corporate sans surcoût.",
              },
              {
                q: 'Compte corporatif et facturation Net 30 ?',
                a: "Termes Net 30 sur approbation pour les commandes récurrentes ou un volume annuel garanti. Simplifie la compta pour les renouvellements et les événements. Demandez le formulaire à votre conseiller à la première soumission.",
              },
              {
                q: 'Délai pour un événement corporatif ?',
                a: "5 jours ouvrables après approbation de la preuve. Pour une date fixe, envoyez la soumission au moins 3 semaines à l'avance. Urgences 48-72h selon le stock.",
              },
            ]
      }
      serviceType={
        isEn
          ? 'Custom corporate apparel for businesses'
          : 'Vêtements corporate personnalisés pour entreprises'
      }
      faqLdMarker="data-faq-corporate-ld"
      serviceLdMarker="data-service-corporate-ld"
      finalHeading={isEn ? 'Dressed and delivered.' : 'Habillé et livré.'}
      finalSubcopy={
        isEn
          ? 'Pick the pieces, send the logo, we drop it at reception in 5 days.'
          : 'Choisis les pièces, envoie le logo, on dépose à la réception en 5 jours.'
      }
    />
  );
}
