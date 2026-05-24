'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useShop } from './ShopProvider';
import { PriceDisplay } from './PriceDisplay';
import { USD_TO_CDF_RATE, RATE_UPDATED_AT } from '@/lib/currency';
import type { Product } from '@/lib/types';

export function ProductDetail({ product }: { product: Product }) {
  const { addToCart, openChat, wishlist, toggleWishlist } = useShop();
  const [activeImage, setActiveImage] = useState(0);
  const [size, setSize] = useState<string | undefined>(product.sizes?.[0]);
  const [color, setColor] = useState<string | undefined>(product.colors?.[0]?.name);
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState<'description' | 'specs' | 'shipping'>('description');
  const [added, setAdded] = useState(false);

  const isWished = wishlist.includes(product.id);

  const handleAdd = () => {
    addToCart({ productId: product.id, size, color, quantity: qty });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleOrder = () => {
    addToCart({ productId: product.id, size, color, quantity: qty });
    setTimeout(() => openChat(), 100);
  };

  return (
    <>
      {/* Breadcrumb */}
      <div className="max-w-7xl mx-auto px-6 lg:px-10 pt-8">
        <nav className="font-display text-[11px] tracking-widest uppercase text-muted flex items-center gap-2">
          <Link href="/" className="hover:text-terra transition-colors">
            Accueil
          </Link>
          <span>/</span>
          <Link href="/catalogue" className="hover:text-terra transition-colors">
            Catalogue
          </Link>
          <span>/</span>
          <Link
            href={`/catalogue?cat=${product.category}`}
            className="hover:text-terra transition-colors"
          >
            {product.subcategory}
          </Link>
          <span>/</span>
          <span className="text-ink truncate max-w-[200px]">{product.name}</span>
        </nav>
      </div>

      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-12 lg:py-16">
        <div className="grid lg:grid-cols-[1fr_480px] gap-12 lg:gap-20">
          {/* Gallery */}
          <div>
            <div className="relative bg-bone rounded-lg overflow-hidden aspect-square flex items-center justify-center">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2/3 aspect-square rounded-full bg-beige blur-3xl opacity-60" />
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={product.images[activeImage]}
                alt={product.name}
                className="relative z-10 max-h-[90%] max-w-[90%] object-contain transition-opacity duration-300"
                key={activeImage}
              />
              {product.badge && (
                <span className="absolute top-5 left-5 z-20 bg-terra text-cream font-display text-[10px] font-bold tracking-widest uppercase px-3 py-1.5 rounded-sm">
                  {product.badge === 'sale' ? 'Promo' : product.badge === 'new' ? 'Nouveau' : product.badge === 'hot' ? 'Tendance' : 'À la une'}
                </span>
              )}
            </div>

            {/* Thumbs */}
            {product.images.length > 1 && (
              <div className="mt-4 flex gap-3">
                {product.images.map((src, i) => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => setActiveImage(i)}
                    className={`w-20 h-20 rounded overflow-hidden border-2 transition-colors ${
                      activeImage === i ? 'border-terra' : 'border-line hover:border-terra-light'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="font-display text-[10px] tracking-[0.35em] uppercase text-terra font-semibold">
                  {product.subcategory}
                </span>
                <h1 className="mt-3 font-display font-extrabold text-4xl md:text-5xl text-ink leading-[1.05]">
                  {product.name}
                </h1>
              </div>
              <button
                type="button"
                onClick={() => toggleWishlist(product.id)}
                aria-label="Ajouter aux favoris"
                className="shrink-0 w-12 h-12 rounded-full border border-line flex items-center justify-center hover:border-terra transition-colors"
              >
                <svg
                  width="20"
                  height="20"
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
            </div>

            {/* Rating */}
            {product.rating && (
              <div className="mt-4 flex items-center gap-2">
                <div className="flex">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <svg
                      key={i}
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill={i < Math.floor(product.rating!) ? '#D4A84B' : 'none'}
                      stroke="#D4A84B"
                      strokeWidth="1.5"
                    >
                      <path d="m12 2 3 6.5 7 1-5 4.8 1.2 7L12 17.8 5.8 21.3 7 14.3 2 9.5l7-1L12 2Z" />
                    </svg>
                  ))}
                </div>
                <span className="text-sm font-medium">{product.rating.toFixed(1)}</span>
                <span className="text-xs text-muted">({product.reviewCount} avis)</span>
              </div>
            )}

            {/* Price */}
            <div className="mt-8 pb-8 border-b border-line">
              <PriceDisplay usd={product.priceUSD} oldUsd={product.oldPriceUSD} size="xl" />
              <p className="mt-3 text-[11px] text-muted font-light">
                Taux : 1 USD = {USD_TO_CDF_RATE.toLocaleString('fr-FR')} FC • Mis à jour le{' '}
                {RATE_UPDATED_AT}
              </p>
            </div>

            <p className="mt-6 text-sm text-ink-light font-light leading-relaxed">
              {product.shortDescription}
            </p>

            {/* Colors */}
            {product.colors && product.colors.length > 0 && (
              <div className="mt-8">
                <div className="flex items-center justify-between">
                  <span className="font-display text-[11px] tracking-widest uppercase font-semibold">
                    Couleur
                  </span>
                  <span className="text-xs text-muted">{color}</span>
                </div>
                <div className="mt-3 flex gap-2">
                  {product.colors.map((c) => {
                    const active = color === c.name;
                    return (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => setColor(c.name)}
                        title={c.name}
                        className={`relative w-11 h-11 rounded-full border-2 transition-transform hover:scale-105 ${
                          active ? 'border-terra' : 'border-line'
                        }`}
                        style={{ backgroundColor: c.hex }}
                      >
                        {active && (
                          <span className="absolute inset-0 ring-2 ring-terra ring-offset-2 ring-offset-cream rounded-full" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Sizes */}
            {product.sizes && product.sizes.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center justify-between">
                  <span className="font-display text-[11px] tracking-widest uppercase font-semibold">
                    Taille
                  </span>
                  <button className="text-xs text-terra underline">Guide des tailles</button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {product.sizes.map((s) => {
                    const active = size === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSize(s)}
                        className={`min-w-[52px] h-11 px-4 rounded border font-display text-sm font-semibold transition-colors ${
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
              </div>
            )}

            {/* Quantity + CTAs */}
            <div className="mt-8 flex items-center gap-3">
              <div className="flex items-center border border-line rounded-full overflow-hidden">
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="w-11 h-11 text-lg hover:bg-beige transition-colors"
                  aria-label="Diminuer"
                >
                  −
                </button>
                <span className="w-10 text-center font-display font-semibold">{qty}</span>
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.min(product.stock, q + 1))}
                  className="w-11 h-11 text-lg hover:bg-beige transition-colors"
                  aria-label="Augmenter"
                >
                  +
                </button>
              </div>

              <button
                type="button"
                onClick={handleAdd}
                className="flex-1 h-12 rounded-full border-2 border-ink text-ink hover:bg-ink hover:text-cream font-display text-xs font-semibold tracking-[0.2em] uppercase transition-colors"
              >
                {added ? '✓ Ajouté' : 'Ajouter au panier'}
              </button>
            </div>

            <button
              type="button"
              onClick={handleOrder}
              className="mt-3 w-full h-14 rounded-full bg-terra hover:bg-terra-dark text-cream font-display text-sm font-semibold tracking-[0.2em] uppercase transition-colors flex items-center justify-center gap-3 group"
            >
              💬 Commander via le chat
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </button>

            <p className="mt-3 text-[11px] text-muted text-center font-light">
              Paiement et livraison convenus directement avec notre équipe • Stock : {product.stock} pièces
            </p>

            {/* Trust badges */}
            <div className="mt-8 grid grid-cols-3 gap-3 text-center">
              <TrustItem icon="🚚" label="Livraison RDC" />
              <TrustItem icon="💳" label="Mobile Money" />
              <TrustItem icon="↺" label="Retour 7 jours" />
            </div>

            {/* Tabs */}
            <div className="mt-12 border-t border-line pt-8">
              <div className="flex gap-6 border-b border-line">
                {(
                  [
                    { key: 'description', label: 'Description' },
                    { key: 'specs', label: 'Caractéristiques' },
                    { key: 'shipping', label: 'Livraison' },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTab(t.key)}
                    className={`font-display text-xs font-semibold tracking-widest uppercase pb-3 border-b-2 transition-colors ${
                      tab === t.key
                        ? 'border-terra text-ink'
                        : 'border-transparent text-muted hover:text-ink'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="pt-5 text-sm text-ink-light font-light leading-relaxed">
                {tab === 'description' && <p>{product.description}</p>}
                {tab === 'specs' && (
                  <ul className="space-y-2">
                    <li>
                      <strong>Catégorie :</strong> {product.subcategory}
                    </li>
                    <li>
                      <strong>Stock :</strong> {product.stock} pièces disponibles
                    </li>
                    {product.tags.length > 0 && (
                      <li>
                        <strong>Tags :</strong> {product.tags.join(', ')}
                      </li>
                    )}
                    {product.colors && (
                      <li>
                        <strong>Coloris :</strong> {product.colors.map((c) => c.name).join(', ')}
                      </li>
                    )}
                  </ul>
                )}
                {tab === 'shipping' && (
                  <div className="space-y-3">
                    <p>
                      <strong>Kinshasa :</strong> livraison sous 24h, frais convenus dans le chat
                      (généralement 5 000 FC).
                    </p>
                    <p>
                      <strong>Reste de la RDC :</strong> délai 2-5 jours selon la destination,
                      modalités définies avec notre équipe.
                    </p>
                    <p>
                      <strong>Retrait en boutique :</strong> possible 1h après confirmation de
                      commande.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function TrustItem({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="border border-line rounded-md py-3">
      <div className="text-xl">{icon}</div>
      <div className="mt-1 font-display text-[10px] tracking-widest uppercase text-muted">
        {label}
      </div>
    </div>
  );
}
