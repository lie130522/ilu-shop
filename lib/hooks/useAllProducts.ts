'use client';

// ─── useAllProducts ───────────────────────────────────────────────────────────
// Fusionne les produits statiques (seed) avec les produits Firestore (admin).
// • Les produits Firestore remplacent les produits seed ayant le même ID.
// • Les produits Firestore avec status:'inactive' sont exclus de l'affichage.
// • Met à jour en temps réel via onSnapshot.

import { useState, useEffect } from 'react';
import { PRODUCTS as SEED_PRODUCTS } from '@/lib/products';
import { subscribeFirestoreProducts } from '@/lib/firebase/products';
import type { Product } from '@/lib/types';

export function useAllProducts(): Product[] {
  const [firestoreProducts, setFirestoreProducts] = useState<Product[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeFirestoreProducts((products) => {
      // Exclure les produits inactifs
      setFirestoreProducts(products.filter((p) => p.status !== 'inactive'));
    });
    return unsubscribe;
  }, []);

  // Fusionner : les produits Firestore ont priorité sur les produits seed (même ID)
  const firestoreIds = new Set(firestoreProducts.map((p) => p.id));
  const seedFiltered = SEED_PRODUCTS.filter((p) => !firestoreIds.has(p.id));

  return [...seedFiltered, ...firestoreProducts];
}
