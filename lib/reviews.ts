import type { Review } from './types';

export const reviews: Review[] = [
  {
    id: 'rev-001',
    productId: 'ATCF2400',
    author: 'Mathieu Bernier',
    role: { 'fr-ca': 'Surintendant de chantier', 'en-ca': 'Site superintendent' },
    company: 'Construction Bernier & Fils',
    industry: 'construction',
    quote: {
      'fr-ca':
        "On a essayé deux autres fournisseurs avant Vision Affichage. C'est la première fois que la broderie tient après deux hivers de chantier.",
      'en-ca':
        'We tried two other suppliers before Vision Affichage. This is the first time the embroidery survived two winters on site.',
    },
    rating: 5,
    date: '2025-11-12',
  },
  {
    id: 'rev-002',
    productId: 'ATC1000',
    author: 'Stéphanie Lavoie',
    role: { 'fr-ca': 'Directrice des opérations', 'en-ca': 'Operations director' },
    company: 'Paysagement Verdure',
    industry: 'paysagement',
    quote: {
      'fr-ca':
        "L'équipe a recommandé un système par couches au lieu de 80 t-shirts. On a sauvé du budget et l'équipe est mieux habillée.",
      'en-ca':
        'They recommended a layered system instead of 80 tees. We saved budget and the crew looks better.',
    },
    rating: 5,
    date: '2025-09-04',
  },
  {
    id: 'rev-003',
    productId: 'WERK250',
    author: 'Patrick Roy',
    role: { 'fr-ca': 'Propriétaire', 'en-ca': 'Owner' },
    company: 'Mécanique Roy Inc.',
    industry: 'metiers',
    quote: {
      'fr-ca':
        "J'ai mis le Werk 250 dans la camionnette. Mes clients pensent que j'ai engagé du monde. C'est bon pour les ventes.",
      'en-ca':
        'I put the Werk 250 in the van. Clients think I hired more people. Good for sales.',
    },
    rating: 5,
    date: '2026-01-20',
  },
  {
    id: 'rev-004',
    productId: 'L445',
    author: 'Marie-Claude Tremblay',
    role: { 'fr-ca': 'Gérante de restaurant', 'en-ca': 'Restaurant manager' },
    company: 'Bistro La Voûte',
    industry: 'restauration',
    quote: {
      'fr-ca':
        'Le polo coupe femme L445 ajuste enfin correctement. Mes serveuses ne se plaignent plus de leur uniforme.',
      'en-ca':
        "The L445 women's polo actually fits properly. My servers stopped complaining about their uniform.",
    },
    rating: 5,
    date: '2025-08-30',
  },
  {
    id: 'rev-005',
    productId: 'ATC1000',
    author: 'Jonathan Côté',
    role: { 'fr-ca': "Chef d'équipe", 'en-ca': 'Crew lead' },
    company: 'Déménagement Express MTL',
    industry: 'demenagement',
    quote: {
      'fr-ca':
        'Logo dorsal grand format, on est plus visibles dans le trafic montréalais. Les voisins savent qui déménage qui.',
      'en-ca':
        "Big back logo means we're visible in Montreal traffic. Neighbours know who's moving who.",
    },
    rating: 4,
    date: '2025-07-12',
  },
  {
    id: 'rev-006',
    productId: 'S445LS',
    author: 'Annie Pelletier',
    role: { 'fr-ca': 'Directrice générale', 'en-ca': 'General manager' },
    company: 'Groupe Conseil Pelletier',
    industry: 'bureau',
    quote: {
      'fr-ca':
        "On voulait sortir du chandail polo générique. La chemise S445LS brodée donne le ton sobre qu'on cherchait.",
      'en-ca':
        'We wanted out of generic polos. The embroidered S445LS shirt sets the restrained tone we wanted.',
    },
    rating: 5,
    date: '2026-02-08',
  },
  {
    id: 'rev-007',
    productId: 'ATC1000',
    author: 'Sébastien Gagnon',
    role: { 'fr-ca': 'Coordonnateur événementiel', 'en-ca': 'Event coordinator' },
    company: 'Festival St-Sauveur',
    industry: 'bureau',
    quote: {
      'fr-ca':
        "200 t-shirts livrés en huit jours ouvrables, sans erreur de taille. C'est rare.",
      'en-ca':
        "200 tees delivered in eight business days, no sizing errors. That's rare.",
    },
    rating: 5,
    date: '2025-06-22',
  },
  {
    id: 'rev-008',
    productId: 'ATC1015',
    author: 'Karine Dubé',
    role: { 'fr-ca': 'Propriétaire', 'en-ca': 'Owner' },
    company: 'Café Dubé',
    industry: 'restauration',
    quote: {
      'fr-ca':
        "Service consultatif vrai. Ils ont refusé un produit qu'on voulait acheter parce que ce n'était pas le bon pour notre usage.",
      'en-ca':
        "Real consultative service. They refused to sell us a product because it wasn't the right one for our use case.",
    },
    rating: 5,
    date: '2025-10-15',
  },
];

export function getReviewsForProduct(productStyleCode: string): Review[] {
  return reviews.filter((r) => r.productId === productStyleCode);
}

export function getAverageRating(
  productStyleCode: string,
): { average: number; count: number } | null {
  const list = getReviewsForProduct(productStyleCode);
  if (list.length === 0) return null;
  const sum = list.reduce((acc, r) => acc + r.rating, 0);
  return {
    average: Math.round((sum / list.length) * 10) / 10,
    count: list.length,
  };
}

export function getOverallAverage(): { average: number; count: number } {
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
  return {
    average: Math.round((sum / reviews.length) * 10) / 10,
    count: reviews.length,
  };
}
