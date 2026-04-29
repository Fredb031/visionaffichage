import { IndustryPageShell } from '@/components/industries/IndustryPageShell';
import { useLang } from '@/lib/langContext';

/**
 * Mega Blueprint §08.3 — Paysagement (landscaping) landing page.
 * Master Prompt "Audi precision" copy: holds the season. T-shirts,
 * polos, casquettes — fabrics that last, logo that lasts.
 */
// Module-scope const for stable array identity (commit 1a988cc).
const PAYSAGEMENT_PRODUCT_SKUS: string[] = ['S350', 'ATC1000', 'S445', 'ATC6606'];

export default function Paysagement() {
  const { lang } = useLang();
  const isEn = lang === 'en';

  return (
    <IndustryPageShell
      title={
        isEn
          ? 'A uniform that holds the season.'
          : "L'uniforme qui résiste à la saison."
      }
      metaDescription={
        isEn
          ? 'T-shirts, polos and caps for field crews. Fabrics that last, logo that lasts.'
          : "T-shirts, polos et casquettes pour les équipes terrain. Matériaux qui tiennent, logo qui dure."
      }
      eyebrow={isEn ? 'Landscaping · Quebec' : 'Paysagement · Québec'}
      heroLede={
        isEn
          ? 'T-shirts, polos and caps for field crews. Fabrics that last, logo that lasts. Built in Saint-Hyacinthe for Quebec landscapers, season after season.'
          : "T-shirts, polos et casquettes pour les équipes terrain. Matériaux qui tiennent, logo qui dure. Production à Saint-Hyacinthe pour les paysagistes québécois, saison après saison."
      }
      heroBullets={
        isEn
          ? [
              'Breathable fabrics (sport, technical poly) for hot days.',
              'Polos for client visits and on-site quotes.',
              'Embroidered caps — sun protection plus brand.',
              'Bright colours that stay bright through the wash.',
              'Easy annual refresh — your order history is on file.',
            ]
          : [
              'Tissus respirants (sport, polyester technique) pour les journées chaudes.',
              'Polos pour rencontres clients et soumissions sur place.',
              "Casquettes brodées — protection solaire et marque sur le terrain.",
              "Couleurs vives qui restent vives lavage après lavage.",
              "Renouvellement annuel facile — votre historique est sauvegardé.",
            ]
      }
      ctaLabel={isEn ? 'Browse products' : 'Voir les produits'}
      ctaHref="/boutique"
      ctaClassName="bg-va-blue hover:bg-va-blue-h text-white"
      productsHeading={
        isEn ? 'Built for the field.' : 'Conçus pour le terrain.'
      }
      productsSubcopy={
        isEn
          ? 'Light, breathable, ready for grass stains and dirt — and a brand that survives both.'
          : "Léger, respirant, prêt pour les taches de gazon et de terre — et une marque qui survit aux deux."
      }
      productSkus={PAYSAGEMENT_PRODUCT_SKUS}
      faqHeading={
        isEn ? 'Landscaping — straight answers.' : 'Paysagement — réponses directes.'
      }
      faq={
        isEn
          ? [
              {
                q: 'Best fabric for hot days in landscaping?',
                a: 'Sport tees (S350, L350) in technical polyester wick fast and dry faster than cotton — built for long mowing or planting days. For client meetings, polo S445 in polycotton balances comfort and a sharp look.',
              },
              {
                q: 'Will my logo survive the laundry cycle?',
                a: 'Yes. Embroidery and high-durability DTF print both clear 50+ industrial wash cycles without cracking or fading. The bright colours landscapers prefer (green, yellow, safety orange) ship in pigment inks rated UV-stable.',
              },
              {
                q: 'Can you outfit my whole crew across sizes and cuts?',
                a: 'Yes. One order mixes sizes (S to 4XL), men/women/kids cuts, and styles (tee + polo + cap) at the same global unit rate. Tell us the breakdown on the quote, we fit production.',
              },
              {
                q: 'High-vis option for roadside work?',
                a: 'Bright orange or safety yellow tees on most ATC models. For CSA Z96 reflective vests, contact us — we source through partners and apply your logo.',
              },
            ]
          : [
              {
                q: 'Quels tissus pour les journées chaudes en paysagement ?',
                a: "T-shirts sport (S350, L350) en polyester technique qui évacuent et sèchent plus vite que le coton — bâtis pour les longues journées de tonte ou de plantation. Pour les rencontres clients, le polo S445 en polycoton tient le confort et l'apparence soignée.",
              },
              {
                q: 'Mon logo tient-il après plusieurs lavages ?',
                a: "Oui. Broderie et impression DTF haute durabilité passent toutes deux 50+ lavages industriels sans craqueler ni se décolorer. Les couleurs vives (vert, jaune, orange sécurité) sont en encres pigmentées UV-stables.",
              },
              {
                q: 'Habiller toute mon équipe avec différentes tailles et coupes ?',
                a: "Oui. Une même commande mélange tailles (S à 4XL), coupes hommes/femmes/enfants, et modèles (t-shirt + polo + casquette) au même tarif unitaire global. Indiquez la répartition à la soumission, on adapte la production.",
              },
              {
                q: 'Couleur sécurité haute visibilité pour le travail près de la route ?',
                a: "T-shirts en orange vif ou jaune sécurité disponibles sur la plupart des modèles ATC. Pour les vêtements certifiés CSA Z96 (rétroréfléchissants), contactez-nous — on les approvisionne via nos partenaires et on appose votre logo.",
              },
            ]
      }
      serviceType={
        isEn
          ? 'Custom apparel for landscaping companies'
          : 'Vêtements personnalisés pour compagnies de paysagement'
      }
      faqLdMarker="data-faq-paysagement-ld"
      serviceLdMarker="data-service-paysagement-ld"
      finalHeading={
        isEn ? "Dress the crew before the season starts." : "Habillez l'équipe avant le début de saison."
      }
      finalSubcopy={
        isEn
          ? 'Browse the catalogue, lock in colours, get a digital proof inside 24 hours.'
          : 'Parcourez le catalogue, fixez les couleurs, recevez une preuve numérique en moins de 24h.'
      }
    />
  );
}
