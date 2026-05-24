'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { PRODUCTS, CATEGORIES } from '@/lib/products';
import { ProductCard } from '@/components/ProductCard';
import type { Category } from '@/lib/types';

type SortKey = 'popular' | 'newest' | 'priceAsc' | 'priceDesc';

const ALL_COLORS = Array.from(
  new Map(
    PRODUCTS.flatMap((p) => p.colors ?? []).map((c) => [c.hex, c]),
  ).values(),
);
const ALL_SIZES = Array.from(new Set(PRODUCTS.flatMap((p) => p.sizes ?? [])));
const MAX_PRICE = Math.ceil(Math.max(...PRODUCTS.map((p) => p.priceUSD)) / 100) * 100;

export default function CatalogueClient() {
  const searchParams = useSearchParams();
  const initialCat = searchParams.get('cat') as Category | null;

  const [categories, setCategories] = useState<Set<Category>>(
    new Set(initialCat ? [initialCat] : []),
  );
  const [colors, setColors] = useState<Set<string>>(new Set());
  const [sizes, setSizes] = useState<Set<string>>(new Set());
  const [maxPrice, setMaxPrice] = useState(MAX_PRICE);
  const [sort, setSort] = useState<SortKey>('popular');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const filtered = useMemo(() => {
    let list = PRODUCTS.filter((p) => {
      if (categories.size > 0 && !categories.has(p.category)) return false;
      if (p.priceUSD > maxPrice) return false;
      if (colors.size > 0) {
        const hasColor = p.colors?.some((c) => colors.has(c.hex));
        if (!hasColor) return false;
      }
      if (sizes.size > 0) {
        const hasSize = p.sizes?.some((s) => sizes.has(s));
        if (!hasSize) return false;
      }
      return true;
    });

    list = [...list].sort((a, b) => {
      switch (sort) {
        case 'newest':
          if (a.badge === 'new' && b.badge !== 'new') return -1;
          if (a.badge !== 'new' && b.badge === 'new') return 1;
          return 0;
        case 'priceAsc':
          return a.priceUSD - b.priceUSD;
        case 'priceDesc':
          return b.priceUSD - a.priceUSD;
        default:
          return (b.rating ?? 0) - (a.rating ?? 0);
      }
    });

    return list;
  }, [categories, colors, sizes, maxPrice, sort]);

  const toggleSet = <T,>(set: Set<T>, value: T): Set<T> => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  const resetFilters = () => {
    setCategories(new Set());
    setColors(new Set());
    setSizes(new Set());
    setMaxPrice(MAX_PRICE);
  };

  const activeFilterCount =
    categories.size + colors.size + sizes.size + (maxPrice < MAX_PRICE ? 1 : 0);

  return (
    <>
      {/* Hero strip */}
      <section className="bg-bone border-b border-line">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-14 lg:py-20">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <nav className="font-display text-[11px] tracking-widest uppercase text-muted flex items-center gap-2">
                <Link href="/" className="hover:text-terra transition-colors">
                  Accueil
                </Link>
                <span>/</span>
                <span className="text-ink">Catalogue</span>
              </nav>
              <h1 className="mt-4 font-display font-extrabold text-5xl md:text-7xl text-ink leading-none">
                Shop<span className="text-terra">.</span>
              </h1>
              <p className="mt-4 text-sm font-light text-muted max-w-md">
                {filtered.length} pièces — Mode & High-Tech. Filtres et tri en direct.
              </p>
            </div>

            {/* Category chips */}
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => {
                const active = categories.has(cat.slug as Category);
                return (
                  <button
                    key={cat.slug}
                    onClick={() => setCategories(toggleSet(categories, cat.slug as Category))}
                    className={`font-display text-[11px] tracking-widest uppercase font-semibold px-4 py-2 rounded-full border transition-colors ${
                      active
                        ? 'bg-ink text-cream border-ink'
                        : 'border-line text-ink hover:bg-beige'
                    }`}
                  >
                    {cat.label} <span className="opacity-50">({cat.count})</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Main grid */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="grid lg:grid-cols-[260px_1fr] gap-10">
            {/* Filters sidebar */}
            <aside
              className={`lg:block ${
                mobileFiltersOpen ? 'fixed inset-0 z-50 bg-cream overflow-y-auto p-6' : 'hidden'
              }`}
            >
              <div className="flex items-center justify-between mb-6 lg:hidden">
                <h3 className="font-display font-bold text-xl">Filtres</h3>
                <button
                  type="button"
                  onClick={() => setMobileFiltersOpen(false)}
                  className="w-9 h-9 rounded-full bg-beige flex items-center justify-center"
                >
                  ✕
                </button>
              </div>

              <div className="flex items-center justify-between mb-6">
                <h3 className="hidden lg:block font-display text-[11px] tracking-[0.3em] uppercase font-semibold text-ink">
                  Filtres
                </h3>
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="font-display text-[10px] tracking-widest uppercase text-terra hover:text-terra-dark transition-colors underline"
                  >
                    Réinitialiser ({activeFilterCount})
                  </button>
                )}
              </div>

              <FilterGroup title="Catégorie">
                {CATEGORIES.map((cat) => (
                  <Checkbox
                    key={cat.slug}
                    label={`${cat.label} (${cat.count})`}
                    checked={categories.has(cat.slug as Category)}
                    onChange={() => setCategories(toggleSet(categories, cat.slug as Category))}
                  />
                ))}
              </FilterGroup>

              <FilterGroup title="Prix max">
                <input
                  type="range"
                  min={20}
                  max={MAX_PRICE}
                  step={20}
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                  className="w-full accent-terra"
                />
                <div className="mt-2 flex items-center justify-between font-display text-xs">
                  <span className="text-muted">$20</span>
                  <span className="font-bold text-terra">${maxPrice}</span>
                </div>
              </FilterGroup>

              <FilterGroup title="Couleurs">
                <div className="flex flex-wrap gap-2">
                  {ALL_COLORS.map((c) => {
                    const active = colors.has(c.hex);
                    return (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => setColors(toggleSet(colors, c.hex))}
                        title={c.name}
                        className={`relative w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
                          active ? 'border-terra' : 'border-line'
                        }`}
                        style={{ backgroundColor: c.hex }}
                      >
                        {active && (
                          <span className="absolute inset-0 flex items-center justify-center text-white text-xs">
                            ✓
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </FilterGroup>

              <FilterGroup title="Tailles">
                <div className="flex flex-wrap gap-2">
                  {ALL_SIZES.map((s) => {
                    const active = sizes.has(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSizes(toggleSet(sizes, s))}
                        className={`min-w-[40px] h-9 px-3 rounded border font-display text-xs font-semibold transition-colors ${
                          active
                            ? 'bg-ink text-cream border-ink'
                            : 'bg-cream text-ink border-line hover:border-terra'
                        }`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </FilterGroup>
            </aside>

            {/* Products */}
            <div>
              <div className="flex items-center justify-between mb-8 pb-4 border-b border-line">
                <button
                  type="button"
                  onClick={() => setMobileFiltersOpen(true)}
                  className="lg:hidden font-display text-xs font-semibold tracking-widest uppercase px-4 py-2 rounded-full border border-line"
                >
                  ☰ Filtres {activeFilterCount > 0 && `(${activeFilterCount})`}
                </button>
                <span className="hidden lg:block font-display text-xs tracking-widest uppercase text-muted">
                  {filtered.length} résultat{filtered.length > 1 ? 's' : ''}
                </span>
                <div className="flex items-center gap-3">
                  <label className="font-display text-[11px] tracking-widest uppercase text-muted">
                    Trier
                  </label>
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as SortKey)}
                    className="bg-cream border border-line rounded-full px-4 py-2 text-xs font-medium outline-none cursor-pointer hover:border-terra transition-colors"
                  >
                    <option value="popular">Popularité</option>
                    <option value="newest">Nouveautés</option>
                    <option value="priceAsc">Prix croissant</option>
                    <option value="priceDesc">Prix décroissant</option>
                  </select>
                </div>
              </div>

              {filtered.length === 0 ? (
                <div className="py-24 text-center">
                  <div className="font-display text-6xl text-beige">∅</div>
                  <p className="mt-6 font-display text-xl font-bold">Aucun produit trouvé</p>
                  <p className="mt-2 text-sm text-muted">Essayez de réinitialiser les filtres.</p>
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="mt-8 font-display text-xs tracking-widest uppercase font-semibold bg-ink text-cream px-6 py-3 rounded-full hover:bg-terra transition-colors"
                  >
                    Réinitialiser
                  </button>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-12">
                  {filtered.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8 pb-8 border-b border-line last:border-b-0">
      <h4 className="font-display text-xs font-semibold tracking-[0.25em] uppercase text-ink mb-4">
        {title}
      </h4>
      <div>{children}</div>
    </div>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex items-center gap-3 py-1.5 cursor-pointer group">
      <span
        className={`w-4 h-4 border rounded-sm flex items-center justify-center transition-colors ${
          checked ? 'bg-terra border-terra' : 'border-line group-hover:border-terra'
        }`}
      >
        {checked && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
            <path d="m5 12 5 5 9-12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
      <span className="text-sm text-ink-light font-light group-hover:text-ink transition-colors">
        {label}
      </span>
    </label>
  );
}
