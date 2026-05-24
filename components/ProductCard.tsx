'use client';

import Link from 'next/link';
import { useShop } from './ShopProvider';
import { PriceDisplay } from './PriceDisplay';
import type { Product } from '@/lib/types';

const badgeStyle: Record<string, string> = {
  new: 'bg-terra text-white',
  sale: 'bg-gold text-ink',
  hot: 'bg-ink text-cream',
  featured: 'bg-terra-light text-ink',
};

const badgeLabel: Record<string, string> = {
  new: 'Nouveau',
  sale: 'Promo',
  hot: 'Tendance',
  featured: 'À la une',
};

export function ProductCard({ product }: { product: Product }) {
  const { wishlist, toggleWishlist } = useShop();
  const isWished = wishlist.includes(product.id);

  return (
    <article className="group relative flex flex-col">
      <Link href={`/produit/${product.slug}`} className="block">
        <div className="relative aspect-[4/5] overflow-hidden bg-bone rounded-sm">
          {/* Soft circle behind product */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-3/4 aspect-square rounded-full bg-beige/60 blur-2xl group-hover:bg-terra-light/40 transition-colors duration-700" />
          </div>

          {/* Image */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={product.images[0]}
            alt={product.name}
            loading="lazy"
            className="relative z-10 w-full h-full object-cover transition-transform duration-700 ease-smooth group-hover:scale-105"
          />

          {/* Badge */}
          {product.badge && (
            <span
              className={`absolute top-3 left-3 z-20 font-display text-[10px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-sm ${badgeStyle[product.badge]}`}
            >
              {badgeLabel[product.badge]}
            </span>
          )}

          {/* Wishlist */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              toggleWishlist(product.id);
            }}
            aria-label="Ajouter aux favoris"
            className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full bg-cream/90 backdrop-blur-sm flex items-center justify-center hover:bg-cream transition-colors"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill={isWished ? '#C8573A' : 'none'}
              stroke={isWished ? '#C8573A' : '#1C1410'}
              strokeWidth="1.6"
            >
              <path
                d="M12 20s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 10c0 5.65-7 10-7 10Z"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {/* Hover overlay CTA */}
          <div className="absolute bottom-0 left-0 right-0 z-20 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-smooth">
            <div className="bg-ink text-cream text-center py-2.5 rounded-sm font-display text-xs font-semibold tracking-widest uppercase">
              Voir le produit →
            </div>
          </div>
        </div>
      </Link>

      {/* Info */}
      <div className="pt-4 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-[15px] font-semibold text-ink truncate">
            {product.name}
          </h3>
          <p className="text-xs text-muted font-light mt-0.5 truncate">{product.shortDescription}</p>
        </div>
        {product.rating && (
          <div className="flex items-center gap-1 shrink-0">
            <Star />
            <span className="text-xs font-medium text-ink">{product.rating.toFixed(1)}</span>
          </div>
        )}
      </div>

      <div className="mt-2">
        <PriceDisplay usd={product.priceUSD} oldUsd={product.oldPriceUSD} size="md" inline />
      </div>

      {/* Color swatches */}
      {product.colors && product.colors.length > 0 && (
        <div className="flex items-center gap-1.5 mt-3">
          {product.colors.slice(0, 4).map((c) => (
            <span
              key={c.name}
              title={c.name}
              className="w-3.5 h-3.5 rounded-full border border-line"
              style={{ backgroundColor: c.hex }}
            />
          ))}
          {product.colors.length > 4 && (
            <span className="text-[10px] text-muted ml-1">+{product.colors.length - 4}</span>
          )}
        </div>
      )}
    </article>
  );
}

function Star() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="#D4A84B">
      <path d="m12 2 3 6.5 7 1-5 4.8 1.2 7L12 17.8 5.8 21.3 7 14.3 2 9.5l7-1L12 2Z" />
    </svg>
  );
}
