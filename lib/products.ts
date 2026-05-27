import type { Product } from './types';

// ─── Produits statiques (seed) ────────────────────────────────────────────────
// Vidé intentionnellement — tous les produits passent maintenant par Firestore
// (ajoutés via /admin/produits/nouveau).
// Ce tableau reste exporté pour compatibilité avec les composants qui l'importent.

export const PRODUCTS: Product[] = [];

export function getProductBySlug(slug: string): Product | undefined {
  return PRODUCTS.find((p) => p.slug === slug);
}

export function getFeaturedProducts(): Product[] {
  return PRODUCTS.filter((p) => p.status === 'featured');
}

export function getRelatedProducts(product: Product, count = 4): Product[] {
  return PRODUCTS.filter(
    (p) => p.id !== product.id && p.category === product.category,
  ).slice(0, count);
}

// Compteurs = 0 car PRODUCTS est vide.
// Mis à jour dynamiquement dans les composants via useAllProducts().
export const CATEGORIES = [
  { slug: 'mode',        label: 'Mode',             count: 0 },
  { slug: 'technologie', label: 'Technologie',       count: 0 },
  { slug: 'hybrides',    label: 'Wearables',         count: 0 },
  { slug: 'services',    label: 'Services digitaux', count: 0 },
];
