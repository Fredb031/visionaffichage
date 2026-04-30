import type { Industry } from './types';

export const industries: Industry[] = [
  {
    slug: 'construction',
    name: { 'fr-ca': 'Construction', 'en-ca': 'Construction' },
    shortDescription: {
      'fr-ca': "Vêtements résistants brodés à l'avant et au dos.",
      'en-ca': 'Tough apparel embroidered front and back.',
    },
    pitch: {
      'fr-ca':
        "Sur les chantiers québécois, votre logo doit tenir cinq ans, pas cinq lavages. Nous brodons sur des tissus pensés pour le froid, la poussière et la sueur.",
      'en-ca':
        'On Quebec job sites, your logo has to last five years, not five washes. We embroider on fabrics built for cold, dust, and sweat.',
    },
    hookLine: {
      'fr-ca': 'Logo qui tient cinq hivers.',
      'en-ca': 'Logos that survive five winters.',
    },
    keyProducts: ['ATCF2400', 'ATC6606', 'WERK250', 'C105'],
  },
  {
    slug: 'paysagement',
    name: { 'fr-ca': 'Paysagement', 'en-ca': 'Landscaping' },
    shortDescription: {
      'fr-ca': "T-shirts d'été, ouates de printemps et automne.",
      'en-ca': 'Summer tees, spring and fall hoodies.',
    },
    pitch: {
      'fr-ca':
        "Vos équipes de paysagement passent de 5°C à 28°C dans la même journée. On vous bâtit un système d'uniforme par couches qui suit la saison.",
      'en-ca':
        'Your landscaping crews go from 5°C to 28°C in a single day. We build a layered uniform system that follows the season.',
    },
    hookLine: {
      'fr-ca': 'Système d\'uniforme par couches.',
      'en-ca': 'Layered uniform system.',
    },
    keyProducts: ['ATC1000', 'ATCF2400', 'C105', 'L445'],
  },
  {
    slug: 'restauration',
    name: { 'fr-ca': 'Restauration', 'en-ca': 'Restaurants' },
    shortDescription: {
      'fr-ca': 'Service en salle reconnaissable, cuisine pratique.',
      'en-ca': 'Recognizable front-of-house, practical kitchen.',
    },
    pitch: {
      'fr-ca':
        "Polo brodé pour la salle, t-shirt sérigraphié pour la cuisine, tablier pour les barristas. On orchestre un look cohérent du bar à la terrasse.",
      'en-ca':
        'Embroidered polo for service, screen-printed tee for the kitchen, apron for the bar. A coherent look from counter to patio.',
    },
    hookLine: {
      'fr-ca': 'Du bar à la terrasse.',
      'en-ca': 'From counter to patio.',
    },
    keyProducts: ['L445', 'ATC1015', 'ATC1000', 'C105'],
  },
  {
    slug: 'demenagement',
    name: { 'fr-ca': 'Déménagement', 'en-ca': 'Moving services' },
    shortDescription: {
      'fr-ca': 'Visibilité dans la rue, confort dans le camion.',
      'en-ca': 'Street visibility, comfort in the cab.',
    },
    pitch: {
      'fr-ca':
        "Vos déménageurs sont vos panneaux publicitaires mobiles. Logo dorsal grand format, polo identifiant le chef d'équipe, casquette pour terminer.",
      'en-ca':
        'Your movers are your rolling billboards. Large back logos, polo for the lead, cap to finish the look.',
    },
    hookLine: {
      'fr-ca': 'Panneaux publicitaires mobiles.',
      'en-ca': 'Rolling billboards.',
    },
    keyProducts: ['ATC1000', 'ATCF2500', 'L445', 'C105'],
  },
  {
    slug: 'metiers',
    name: { 'fr-ca': 'Métiers spécialisés', 'en-ca': 'Skilled trades' },
    shortDescription: {
      'fr-ca': 'Plombiers, électriciens, mécaniciens.',
      'en-ca': 'Plumbers, electricians, mechanics.',
    },
    pitch: {
      'fr-ca':
        "Le client vous voit sortir de la camionnette. Une chemise de travail brodée et propre dit « professionnel sérieux » avant que vous parliez.",
      'en-ca':
        'Customers see you step out of the truck. A clean embroidered workshirt says "serious professional" before you speak.',
    },
    hookLine: {
      'fr-ca': 'Pro avant d\'avoir parlé.',
      'en-ca': 'Pro before you speak.',
    },
    keyProducts: ['WERK250', 'ATCF2400', 'C105', 'ATC6606'],
  },
  {
    slug: 'bureau',
    name: { 'fr-ca': 'Bureau et corporatif', 'en-ca': 'Office and corporate' },
    shortDescription: {
      'fr-ca': "Réception, ventes, équipes événementielles.",
      'en-ca': 'Front desk, sales, event teams.',
    },
    pitch: {
      'fr-ca':
        "Polo et chemise brodés, ton sobre, qualité durable. L'image cohérente d'une PME qui se prend au sérieux.",
      'en-ca':
        'Embroidered polos and shirts, restrained tones, durable quality. The consistent look of an SMB that takes itself seriously.',
    },
    hookLine: {
      'fr-ca': 'Une PME qui se prend au sérieux.',
      'en-ca': 'An SMB that means business.',
    },
    keyProducts: ['L445', 'S445LS', 'ATC6606', 'ATCF2500'],
  },
];
