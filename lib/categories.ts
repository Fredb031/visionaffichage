import type { Bilingual } from './types';

export type HomeCategory = {
  slug: string;
  // Internal canonical name (matches `?category=` filter values used on /produits)
  filterValue: string;
  name: Bilingual;
  description: Bilingual;
  priceFromCents: number;
  imageSlug: string;
};

export const homeCategories: HomeCategory[] = [
  {
    slug: 'tshirt',
    filterValue: 'tshirt',
    name: { 'fr-ca': 'T-shirts', 'en-ca': 'T-shirts' },
    description: {
      'fr-ca': "Le tissu 6.1 oz qu'on voit sur 200+ chantiers québécois.",
      'en-ca': 'The 6.1 oz fabric you see on 200+ Quebec sites.',
    },
    priceFromCents: 1200,
    imageSlug: 'tshirt',
  },
  {
    slug: 'hoodie',
    filterValue: 'hoodie',
    name: { 'fr-ca': 'Hoodies', 'en-ca': 'Hoodies' },
    description: {
      'fr-ca': 'Hoodies 13 oz, capuchon doublé, parfait pour les matins frais.',
      'en-ca': '13 oz hoodies, lined hood, perfect for cool mornings.',
    },
    priceFromCents: 4200,
    imageSlug: 'hoodie',
  },
  {
    slug: 'polo',
    filterValue: 'polo',
    name: { 'fr-ca': 'Polos', 'en-ca': 'Polos' },
    description: {
      'fr-ca': 'Le polo broderie qui résiste à 200+ lavages.',
      'en-ca': 'The embroidered polo that survives 200+ washes.',
    },
    priceFromCents: 2800,
    imageSlug: 'polo',
  },
  {
    slug: 'cap',
    filterValue: 'cap',
    name: { 'fr-ca': 'Casquettes', 'en-ca': 'Caps' },
    description: {
      'fr-ca': 'La trucker structurée pour la broderie sur le panneau avant.',
      'en-ca': 'The structured trucker for front-panel embroidery.',
    },
    priceFromCents: 1800,
    imageSlug: 'cap',
  },
  {
    slug: 'tuque',
    filterValue: 'tuque',
    name: { 'fr-ca': 'Tuques', 'en-ca': 'Beanies' },
    description: {
      'fr-ca': 'La tuque double épaisseur sans rebord — idéale pour le logo brodé.',
      'en-ca': 'Double-knit beanie without cuff — ideal for embroidered logo.',
    },
    priceFromCents: 1400,
    imageSlug: 'tuque',
  },
  {
    slug: 'workwear',
    filterValue: 'workwear',
    name: { 'fr-ca': 'Workwear', 'en-ca': 'Workwear' },
    description: {
      'fr-ca': 'Vestes de travail robustes pour les environnements exigeants.',
      'en-ca': 'Tough work jackets for demanding environments.',
    },
    priceFromCents: 8900,
    imageSlug: 'workwear',
  },
];

export function getHomeCategories(): HomeCategory[] {
  return homeCategories;
}
