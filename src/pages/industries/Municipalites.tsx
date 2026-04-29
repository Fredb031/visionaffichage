import { IndustryPageShell } from '@/components/industries/IndustryPageShell';
import { useLang } from '@/lib/langContext';

/**
 * Mega Blueprint §08.3 — Municipalités landing page.
 * Master Prompt "Audi precision" copy: serves the people who serve their
 * city. Cols bleus, équipes municipales, services publics. Conformité,
 * durabilité, livraison garantie.
 */
// Module-scope const for stable array identity across renders
// (commit 7813c42).
const MUNICIPALITES_PRODUCT_SKUS: string[] = ['S445', 'ATC1000', 'ATCF2500', 'ATC6606'];

export default function Municipalites() {
  const { lang } = useLang();
  const isEn = lang === 'en';

  return (
    <IndustryPageShell
      title={
        isEn
          ? 'For those who serve their city.'
          : 'Pour ceux qui servent leur ville.'
      }
      metaDescription={
        isEn
          ? 'Uniforms for blue-collar crews, municipal teams, public services. Compliant, durable, guaranteed delivery.'
          : "Uniformes pour cols bleus, équipes municipales, services publics. Conformité, durabilité, livraison garantie."
      }
      eyebrow={isEn ? 'Municipalities · Quebec' : 'Municipalités · Québec'}
      heroLede={
        isEn
          ? 'Uniforms for blue-collar crews, municipal teams, public services. Compliant, durable, guaranteed delivery. Built in Saint-Hyacinthe, dropped at city hall.'
          : "Uniformes pour cols bleus, équipes municipales, services publics. Conformité, durabilité, livraison garantie. Production à Saint-Hyacinthe, livraison à l'hôtel de ville."
      }
      heroBullets={
        isEn
          ? [
              'Polos for citizen reception, councillors, elected officials.',
              'Heavy-duty tees for public works and roadwork crews.',
              'Embroidered hoodies for day-camp counsellors and rec staff.',
              'Compliant with municipal RFP requirements (SEAO).',
              "Official city logo reproduced faithfully — embroidery or print.",
            ]
          : [
              "Polos pour personnel d'accueil citoyen, conseillers et élus.",
              'T-shirts robustes pour équipes de travaux publics et voirie.',
              'Hoodies brodés pour moniteurs de camp de jour et loisirs.',
              "Conforme aux exigences d'appels d'offres municipaux (SEAO).",
              'Logo officiel de la ville reproduit fidèlement en broderie ou impression.',
            ]
      }
      ctaLabel={isEn ? 'Browse products' : 'Voir les produits'}
      ctaHref="/boutique"
      ctaClassName="bg-va-blue hover:bg-va-blue-h text-white"
      productsHeading={
        isEn ? 'Built for public service.' : 'Conçus pour le service public.'
      }
      productsSubcopy={
        isEn
          ? 'From the polo on the reception desk to the tee on the roadwork crew. One supplier, every department.'
          : "Du polo à l'accueil au t-shirt sur la voirie. Un seul fournisseur, tous les départements."
      }
      productSkus={MUNICIPALITES_PRODUCT_SKUS}
      faqHeading={
        isEn ? 'Municipalities — straight answers.' : 'Municipalités — réponses directes.'
      }
      faq={
        isEn
          ? [
              {
                q: 'Can you respond to a municipal public RFP?',
                a: "Yes. Formal SEAO-compliant submissions: detailed product specs, unit prices and volumes, Pantone sheets, production schedule. Send the RFP, we deliver a complete response on time.",
              },
              {
                q: "Can you faithfully reproduce our city's official logo?",
                a: "Yes. From a vector file (SVG, AI, EPS, PDF) supplied by your communications team, we reproduce your official logo without distortion. A digital proof goes out for approval before any piece is stitched.",
              },
              {
                q: 'Different uniforms for different departments?',
                a: "Yes. One order can cover public works, recreation, urban planning, citizen reception — different styles, colours, sizes, each with its own logo or department name. Each sub-order is packed and labelled separately.",
              },
              {
                q: 'Payment terms for municipalities?',
                a: "Net 30 on approval for municipal organisations, with PO-based invoicing. We accept institutional bank transfers. For very large orders (500+ pieces), 50% deposit on order with balance on delivery.",
              },
            ]
          : [
              {
                q: "Pouvez-vous répondre à un appel d'offres municipal public ?",
                a: "Oui. Soumissions formelles conformes SEAO : fiches techniques détaillées, prix unitaires et volumes, fiches Pantone, échéancier. Envoyez l'appel d'offres, on livre une réponse complète dans les délais.",
              },
              {
                q: 'Pouvez-vous reproduire fidèlement notre logo officiel ?',
                a: "Oui. À partir d'un fichier vectoriel (SVG, AI, EPS, PDF) fourni par votre service des communications, on reproduit votre logo officiel sans altération. Une preuve numérique pour approbation avant que la moindre pièce ne soit cousue.",
              },
              {
                q: 'Uniformes différents selon les départements ?',
                a: "Oui. Une seule commande peut couvrir travaux publics, loisirs, urbanisme, accueil — modèles, couleurs et tailles différents, chacun avec son logo ou nom de département. Chaque sous-commande est emballée et étiquetée séparément.",
              },
              {
                q: 'Termes de paiement pour les municipalités ?',
                a: "Net 30 sur approbation pour les organismes municipaux, facturation par bon de commande. On accepte le virement bancaire institutionnel. Pour les très grosses commandes (500+ pièces), 50 % à la commande, solde à la livraison.",
              },
            ]
      }
      serviceType={
        isEn
          ? 'Uniforms for Quebec cities and municipalities'
          : 'Uniformes pour villes et municipalités du Québec'
      }
      faqLdMarker="data-faq-municipalites-ld"
      serviceLdMarker="data-service-municipalites-ld"
      finalHeading={
        isEn ? 'Dress every department.' : 'Habillez tous les départements.'
      }
      finalSubcopy={
        isEn
          ? 'Browse the catalogue, request an RFP-grade quote, get a digital proof inside 24 hours.'
          : "Parcourez le catalogue, demandez une soumission conforme aux appels d'offres, recevez une preuve numérique en moins de 24h."
      }
    />
  );
}
