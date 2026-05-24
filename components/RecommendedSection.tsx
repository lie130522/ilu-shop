'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from './AuthProvider';
import { PRODUCTS } from '@/lib/products';
import { ProductCard } from './ProductCard';
import { getUserBehavior, getTopProducts } from '@/lib/firebase/db';
import { getRecentlyViewed } from '@/lib/tracking';
import type { Product } from '@/lib/types';

// ── Algorithme de recommandation ──────────────────────────────────────────────
// Score chaque produit selon :
// - Même catégorie que les produits vus/aimés (+3)
// - Tags en commun (+2 par tag)
// - Produit populaire (topProducts) (+1)
// - Déjà vu → pénalité (-5)
// - Déjà dans la wishlist → boost (+1)

function scoreProducts(
  candidates: Product[],
  seenIds: string[],
  viewedCategories: string[],
  viewedTags: string[],
  topProductIds: string[],
  wishlist: string[],
  excludeIds: string[],
): Product[] {
  const scored = candidates
    .filter((p) => !excludeIds.includes(p.id) && p.status !== 'inactive')
    .map((p) => {
      let score = 0;

      // Category match
      if (viewedCategories.includes(p.category)) score += 3;

      // Tag match
      const tagMatches = p.tags.filter((t) => viewedTags.includes(t)).length;
      score += tagMatches * 2;

      // Already seen → slight penalty (we still show but deprioritize)
      if (seenIds.includes(p.id)) score -= 5;

      // Popular
      if (topProductIds.includes(p.id)) score += 1;

      // Wishlist boost (user may want to buy eventually)
      if (wishlist.includes(p.id)) score += 1;

      return { product: p, score };
    });

  return scored
    .sort((a, b) => b.score - a.score)
    .map((s) => s.product);
}

// ── Recently Viewed Section ───────────────────────────────────────────────────
export function RecentlyViewedSection({ excludeId }: { excludeId?: string }) {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    const ids = getRecentlyViewed().filter((id) => id !== excludeId);
    const found = ids
      .map((id) => PRODUCTS.find((p) => p.id === id))
      .filter((p): p is Product => !!p)
      .slice(0, 4);
    setProducts(found);
  }, [excludeId]);

  if (products.length === 0) return null;

  return (
    <section className="py-16 bg-cream">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <div className="flex items-end justify-between mb-8">
          <div>
            <span className="font-display text-[10px] tracking-[0.35em] uppercase text-terra font-semibold">
              — Récemment consultés
            </span>
            <h2 className="mt-2 font-display font-bold text-2xl md:text-3xl text-ink">
              Tu as regardé
            </h2>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Recommended For You Section ───────────────────────────────────────────────
export function RecommendedSection({
  excludeId,
  wishlist = [],
}: {
  excludeId?: string;
  wishlist?: string[];
}) {
  const { user } = useAuth();
  const [recommended, setRecommended] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function compute() {
      setLoading(true);
      try {
        const recentIds = getRecentlyViewed();
        let viewedCategories: string[] = [];
        let viewedTags: string[] = [];
        let topProductIds: string[] = [];

        // Get user behavior from Firestore if logged in
        if (user) {
          const events = await getUserBehavior(user.uid, 30);
          const viewedProductIds = events.map((e) => e.productId);
          const viewedProducts = viewedProductIds
            .map((id) => PRODUCTS.find((p) => p.id === id))
            .filter((p): p is Product => !!p);
          viewedCategories = viewedProducts.map((p) => p.category);
          viewedTags = viewedProducts.flatMap((p) => p.tags);
        } else {
          // Anonymous: use recently viewed from localStorage
          const viewedProducts = recentIds
            .map((id) => PRODUCTS.find((p) => p.id === id))
            .filter((p): p is Product => !!p);
          viewedCategories = viewedProducts.map((p) => p.category);
          viewedTags = viewedProducts.flatMap((p) => p.tags);
        }

        // Get top products for popularity boost
        const topStats = await getTopProducts(10);
        topProductIds = topStats.map((s) => s.productId);

        const excludeIds = excludeId ? [excludeId] : [];
        const scored = scoreProducts(
          PRODUCTS,
          recentIds,
          viewedCategories,
          viewedTags,
          topProductIds,
          wishlist,
          excludeIds,
        );

        setRecommended(scored.slice(0, 4));
      } catch {
        // Fallback: show featured products
        setRecommended(PRODUCTS.filter((p) => p.status === 'featured').slice(0, 4));
      } finally {
        setLoading(false);
      }
    }
    compute();
  }, [user, excludeId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <section className="py-16 bg-bone">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="h-8 w-48 bg-beige rounded animate-pulse mb-8" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-beige rounded-xl aspect-[3/4] animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (recommended.length === 0) return null;

  return (
    <section className="py-16 bg-bone">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <div className="flex items-end justify-between mb-8">
          <div>
            <span className="font-display text-[10px] tracking-[0.35em] uppercase text-terra font-semibold">
              — Sélection personnalisée
            </span>
            <h2 className="mt-2 font-display font-bold text-2xl md:text-3xl text-ink">
              {user ? 'Recommandés pour toi' : 'Tu pourrais aimer'}
            </h2>
          </div>
          <Link
            href="/catalogue"
            className="font-display text-xs tracking-widest uppercase font-semibold text-terra hover:text-terra-dark transition-colors"
          >
            Tout voir →
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
          {recommended.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </div>
    </section>
  );
}
