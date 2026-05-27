'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useAllProducts } from '@/lib/hooks/useAllProducts';
import { ProductCard } from '@/components/ProductCard';
import { useShop } from '@/components/ShopProvider';
import { usdToCdf, formatUSD, formatCDF } from '@/lib/currency';

type SortKey = 'discount' | 'priceAsc' | 'priceDesc' | 'popular';

export default function PromoPage() {
  const allProducts = useAllProducts();
  const { exchangeRate } = useShop();
  const [sort, setSort] = useState<SortKey>('discount');

  // Uniquement les articles avec badge 'sale' ET un ancien prix défini
  const promoProducts = useMemo(() => {
    const list = allProducts.filter((p) => p.badge === 'sale');

    return [...list].sort((a, b) => {
      switch (sort) {
        case 'discount': {
          // Trier par % de réduction décroissant
          const discA = a.oldPriceUSD ? (1 - a.priceUSD / a.oldPriceUSD) : 0;
          const discB = b.oldPriceUSD ? (1 - b.priceUSD / b.oldPriceUSD) : 0;
          return discB - discA;
        }
        case 'priceAsc':
          return a.priceUSD - b.priceUSD;
        case 'priceDesc':
          return b.priceUSD - a.priceUSD;
        default:
          return (b.rating ?? 0) - (a.rating ?? 0);
      }
    });
  }, [allProducts, sort]);

  // Économies totales disponibles (somme des réductions)
  const totalSavings = useMemo(() => {
    return promoProducts.reduce((acc, p) => {
      if (p.oldPriceUSD) acc += p.oldPriceUSD - p.priceUSD;
      return acc;
    }, 0);
  }, [promoProducts]);

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="bg-ink text-cream relative overflow-hidden">
        {/* Fond décoratif */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-20 -right-20 w-96 h-96 rounded-full bg-gold/10 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-96 h-96 rounded-full bg-terra/20 blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 lg:px-10 py-16 lg:py-24">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8">
            <div>
              <nav className="font-display text-[11px] tracking-widest uppercase text-cream/50 flex items-center gap-2 mb-6">
                <Link href="/" className="hover:text-gold transition-colors">Accueil</Link>
                <span>/</span>
                <span className="text-cream/80">Promotions</span>
              </nav>

              {/* Badge promo */}
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gold/20 border border-gold/40 mb-4">
                <span className="text-gold font-display font-bold text-xs tracking-widest uppercase">
                  % Offres spéciales
                </span>
              </div>

              <h1 className="font-display font-extrabold text-5xl md:text-7xl leading-none">
                Meilleures<br />
                <span className="text-gold">Promos</span>
                <span className="text-terra">.</span>
              </h1>
              <p className="mt-5 text-sm text-cream/60 font-light max-w-md leading-relaxed">
                {promoProducts.length > 0
                  ? `${promoProducts.length} article${promoProducts.length > 1 ? 's' : ''} en promotion — jusqu'à ${Math.round(Math.max(...promoProducts.map(p => p.oldPriceUSD ? (1 - p.priceUSD / p.oldPriceUSD) * 100 : 0)))}% de réduction.`
                  : 'Aucune promotion disponible pour le moment. Revenez bientôt !'}
              </p>
            </div>

            {/* Stats */}
            {promoProducts.length > 0 && (
              <div className="flex flex-wrap gap-4">
                <StatCard
                  label="Articles en promo"
                  value={String(promoProducts.length)}
                  unit="articles"
                />
                <StatCard
                  label="Économies disponibles"
                  value={formatUSD(totalSavings)}
                  unit={`≈ ${formatCDF(usdToCdf(totalSavings, exchangeRate))}`}
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Contenu ──────────────────────────────────────────────────────── */}
      <section className="py-12 bg-bone min-h-[60vh]">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          {promoProducts.length === 0 ? (
            /* État vide */
            <div className="py-24 text-center">
              <div className="text-7xl mb-6">🏷️</div>
              <h2 className="font-display font-extrabold text-3xl text-ink">
                Pas encore de promotions
              </h2>
              <p className="mt-3 text-muted text-sm max-w-sm mx-auto">
                L&apos;équipe prépare de belles offres pour vous. En attendant, explorez notre catalogue complet.
              </p>
              <Link
                href="/catalogue"
                className="mt-8 inline-block font-display text-xs tracking-widest uppercase font-bold bg-ink text-cream px-8 py-3.5 rounded-full hover:bg-terra transition-colors"
              >
                Voir tout le catalogue →
              </Link>
            </div>
          ) : (
            <>
              {/* Toolbar tri */}
              <div className="flex items-center justify-between mb-8 pb-4 border-b border-line">
                <p className="font-display text-xs tracking-widest uppercase text-muted">
                  {promoProducts.length} résultat{promoProducts.length > 1 ? 's' : ''}
                </p>
                <div className="flex items-center gap-3">
                  <label className="font-display text-[11px] tracking-widest uppercase text-muted">
                    Trier
                  </label>
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as SortKey)}
                    className="bg-cream border border-line rounded-full px-4 py-2 text-xs font-medium outline-none cursor-pointer hover:border-terra transition-colors"
                  >
                    <option value="discount">Réduction max</option>
                    <option value="popular">Popularité</option>
                    <option value="priceAsc">Prix croissant</option>
                    <option value="priceDesc">Prix décroissant</option>
                  </select>
                </div>
              </div>

              {/* Grille produits */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-5 gap-y-12">
                {promoProducts.map((product) => (
                  <div key={product.id} className="relative">
                    {/* Badge réduction */}
                    {product.oldPriceUSD && (
                      <div className="absolute top-3 left-3 z-10 bg-gold text-ink text-[10px] font-display font-extrabold tracking-widest uppercase px-2.5 py-1 rounded-full shadow-sm">
                        -{Math.round((1 - product.priceUSD / product.oldPriceUSD) * 100)}%
                      </div>
                    )}
                    <ProductCard product={product} />
                  </div>
                ))}
              </div>

              {/* CTA bas de page */}
              <div className="mt-16 text-center py-10 border-t border-line">
                <p className="text-muted text-sm mb-4">
                  Vous cherchez autre chose ?
                </p>
                <Link
                  href="/catalogue"
                  className="font-display text-xs tracking-widest uppercase font-bold border border-line text-ink px-8 py-3 rounded-full hover:bg-ink hover:text-cream transition-colors"
                >
                  Explorer tout le catalogue
                </Link>
              </div>
            </>
          )}
        </div>
      </section>
    </>
  );
}

function StatCard({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="bg-cream/10 border border-cream/20 rounded-2xl px-6 py-4 min-w-[160px]">
      <p className="font-display text-[10px] tracking-widest uppercase text-cream/50 font-semibold">
        {label}
      </p>
      <p className="font-display font-extrabold text-2xl text-gold mt-1">{value}</p>
      <p className="text-[11px] text-cream/50 mt-0.5">{unit}</p>
    </div>
  );
}
