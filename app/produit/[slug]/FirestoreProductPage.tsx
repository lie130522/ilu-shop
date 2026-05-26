'use client';

// Rendu côté client pour les produits créés via l'admin (Firestore).
// Utilisé par /produit/[slug] quand le slug n'est pas dans lib/products.ts.

import { useEffect, useState } from 'react';
import { notFound } from 'next/navigation';
import { getProductBySlugFirestore } from '@/lib/firebase/products';
import { ProductDetail } from '@/components/ProductDetail';
import { RecommendedSection, RecentlyViewedSection } from '@/components/RecommendedSection';
import type { Product } from '@/lib/types';

interface Props {
  slug: string;
}

export function FirestoreProductPage({ slug }: Props) {
  // undefined = loading, null = not found, Product = found
  const [product, setProduct] = useState<Product | null | undefined>(undefined);

  useEffect(() => {
    getProductBySlugFirestore(slug).then((p) => setProduct(p ?? null));
  }, [slug]);

  // Chargement
  if (product === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bone">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-terra/30 border-t-terra rounded-full animate-spin" />
          <span className="font-display text-[11px] tracking-[0.3em] uppercase text-muted">
            Chargement…
          </span>
        </div>
      </div>
    );
  }

  // Produit introuvable dans Firestore non plus → vrai 404
  if (product === null) {
    notFound();
  }

  return (
    <>
      <ProductDetail product={product} />
      <RecentlyViewedSection excludeId={product.id} />
      <RecommendedSection excludeId={product.id} />
    </>
  );
}
