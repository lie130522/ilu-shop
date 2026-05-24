'use client';

import { useState, useMemo } from 'react';
import { PRODUCTS } from '@/lib/products';
import { ProductCard } from '@/components/ProductCard';

type SortKey = 'popularity' | 'newest' | 'price_asc' | 'price_desc';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'popularity', label: 'Popularité' },
  { value: 'newest', label: 'Nouveautés' },
  { value: 'price_asc', label: 'Prix croissant' },
  { value: 'price_desc', label: 'Prix décroissant' },
];

export function BestSellersSection() {
  const [sort, setSort] = useState<SortKey>('popularity');

  const products = useMemo(() => {
    // Base pool: best-rated products
    const pool = PRODUCTS.filter((p) => (p.rating ?? 0) >= 4.5 && p.status !== 'inactive');

    const sorted = [...pool].sort((a, b) => {
      switch (sort) {
        case 'price_asc':
          return a.priceUSD - b.priceUSD;
        case 'price_desc':
          return b.priceUSD - a.priceUSD;
        case 'newest':
          // New badge items first, then by rating
          if (a.badge === 'new' && b.badge !== 'new') return -1;
          if (b.badge === 'new' && a.badge !== 'new') return 1;
          return (b.rating ?? 0) - (a.rating ?? 0);
        case 'popularity':
        default:
          return (b.rating ?? 0) - (a.rating ?? 0);
      }
    });

    return sorted.slice(0, 8);
  }, [sort]);

  return (
    <section className="py-24 bg-bone">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
          <div>
            <span className="font-display text-[10px] tracking-[0.35em] uppercase text-terra font-semibold">
              — Best Sellers
            </span>
            <h2 className="mt-3 font-display font-bold text-4xl md:text-5xl text-ink">
              Les préférés.
            </h2>
          </div>

          {/* Sort select */}
          <div className="flex items-center gap-2">
            <span className="font-display text-[11px] tracking-widest uppercase text-muted">
              Trier
            </span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="bg-cream border border-line rounded-full px-4 py-2 text-xs font-medium outline-none cursor-pointer hover:border-terra transition-colors"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-12">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
}
