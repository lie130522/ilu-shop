'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useShop } from './ShopProvider';
import { useAuth } from './AuthProvider';
import { PriceDisplay } from './PriceDisplay';
import { trackView, trackCartAdd, trackWishlist, addRecentlyViewed } from '@/lib/tracking';
import type { Product } from '@/lib/types';

// ── P24 — Guide des tailles ───────────────────────────────────────────────────
const MODE_SIZES = [
  { taille: 'XS',  fr: '34–36', poitrine: '80–84', taille_cm: '60–64', hanches: '86–90' },
  { taille: 'S',   fr: '36–38', poitrine: '84–88', taille_cm: '64–68', hanches: '90–94' },
  { taille: 'M',   fr: '38–40', poitrine: '88–92', taille_cm: '68–72', hanches: '94–98' },
  { taille: 'L',   fr: '40–42', poitrine: '92–96', taille_cm: '72–76', hanches: '98–102' },
  { taille: 'XL',  fr: '42–44', poitrine: '96–100', taille_cm: '76–80', hanches: '102–106' },
  { taille: 'XXL', fr: '44–46', poitrine: '100–108', taille_cm: '80–88', hanches: '106–114' },
];
const TECH_SIZES = [
  { stockage: '64 Go',  usage: 'Usage courant, apps essentielles' },
  { stockage: '128 Go', usage: 'Recommandé — photos, apps, musique' },
  { stockage: '256 Go', usage: 'Utilisation intensive, vidéos 4K' },
  { stockage: '512 Go', usage: 'Pro, stockage maximal' },
];

function SizeGuideModal({ category, onClose }: { category: string; onClose: () => void }) {
  const isTech = category !== 'mode';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="Fermer" onClick={onClose}
        className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" />
      <div className="relative bg-cream rounded-2xl shadow-2xl max-w-lg w-full p-6 animate-fadeUp">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display font-bold text-lg text-ink">Guide des tailles</h2>
          <button type="button" onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-bone flex items-center justify-center text-muted transition-colors">
            ✕
          </button>
        </div>
        {isTech ? (
          <div className="space-y-2">
            <p className="text-xs text-muted font-light mb-3">Capacité de stockage interne.</p>
            {TECH_SIZES.map((row) => (
              <div key={row.stockage} className="flex items-center gap-4 bg-bone rounded-md px-4 py-3">
                <span className="font-display font-bold text-sm text-ink w-20 shrink-0">{row.stockage}</span>
                <span className="text-xs text-muted font-light">{row.usage}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <p className="text-xs text-muted font-light mb-3">Mesures en cm. En cas de doute, prenez la taille supérieure.</p>
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-ink text-cream">
                  {['Taille','FR','Poitrine','Taille','Hanches'].map((h) => (
                    <th key={h} className="px-3 py-2 font-display font-semibold tracking-widest uppercase text-center first:text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {MODE_SIZES.map((row) => (
                  <tr key={row.taille} className="hover:bg-bone transition-colors">
                    <td className="px-3 py-2 font-display font-bold text-ink">{row.taille}</td>
                    <td className="px-3 py-2 text-center text-muted">{row.fr}</td>
                    <td className="px-3 py-2 text-center">{row.poitrine}</td>
                    <td className="px-3 py-2 text-center">{row.taille_cm}</td>
                    <td className="px-3 py-2 text-center">{row.hanches}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-4 text-[10px] text-muted font-light">
          Mesures indicatives. Des questions ? Demandez-nous dans le chat. 💬
        </p>
      </div>
    </div>
  );
}

export function ProductDetail({ product }: { product: Product }) {
  const { addToCart, openChatWithProduct, wishlist, toggleWishlist, rateUpdatedAt, exchangeRate } = useShop();
  const { user } = useAuth();
  const [activeImage, setActiveImage] = useState(0);
  const [colorImage, setColorImage] = useState<string | null>(null); // image override par couleur
  const [size, setSize] = useState<string | undefined>(product.sizes?.[0]);
  const [color, setColor] = useState<string | undefined>(product.colors?.[0]?.name);
  // URLs couleur résolues — fallback Storage si colorImageUrls absent du document Firestore
  const [resolvedColorUrls, setResolvedColorUrls] = useState<Record<string, string>>(
    product.colorImageUrls ?? {},
  );

  useEffect(() => {
    if (product.colorImageUrls || !product.colors?.length || !product.id) return;
    (async () => {
      try {
        const [{ ref, getDownloadURL }, { storage }] = await Promise.all([
          import('firebase/storage'),
          import('@/lib/firebase/client'),
        ]);
        const resolved: Record<string, string> = {};
        await Promise.allSettled(
          product.colors!.map(async (c) => {
            try {
              const sanitized = c.hex.replace('#', '');
              const url = await getDownloadURL(
                ref(storage, `products/${product.id}/color-${sanitized}`),
              );
              resolved[c.hex] = url;
            } catch { /* image couleur absente pour cette variante */ }
          }),
        );
        if (Object.keys(resolved).length > 0) setResolvedColorUrls(resolved);
      } catch { /* Firebase non disponible */ }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState<'description' | 'specs' | 'shipping'>('description');
  const [added, setAdded] = useState(false);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false); // P24

  const isWished = wishlist.includes(product.id);

  // Track product view + recently viewed
  useEffect(() => {
    addRecentlyViewed(product.id);
    trackView(user?.uid ?? null, product.id, product.category);
  }, [product.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAdd = () => {
    addToCart({ productId: product.id, size, color, quantity: qty });
    trackCartAdd(user?.uid ?? null, product.id, product.category);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleOrder = () => {
    addToCart({ productId: product.id, size, color, quantity: qty });
    trackCartAdd(user?.uid ?? null, product.id, product.category);
    openChatWithProduct({
      productName: product.name,
      productSlug: product.slug,
      priceUSD: product.priceUSD,
      size,
      color,
      qty,
    });
  };

  const handleWishlist = () => {
    toggleWishlist(product.id);
    trackWishlist(user?.uid ?? null, product.id, product.category);
  };

  return (
    <>
      {/* P24 — Modal guide des tailles */}
      {sizeGuideOpen && (
        <SizeGuideModal
          category={product.category}
          onClose={() => setSizeGuideOpen(false)}
        />
      )}
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
                src={colorImage ?? product.images[activeImage]}
                alt={product.name}
                className="relative z-10 max-h-[90%] max-w-[90%] object-contain transition-opacity duration-300"
                key={colorImage ?? activeImage}
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
                    onClick={() => { setActiveImage(i); setColorImage(null); }}
                    className={`w-20 h-20 rounded overflow-hidden border-2 transition-colors ${
                      activeImage === i && !colorImage ? 'border-terra' : 'border-line hover:border-terra-light'
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
                onClick={handleWishlist}
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
                Taux indicatif : 1 USD ≈ {exchangeRate.toLocaleString('fr-FR')} FC
                {rateUpdatedAt && (
                  <span className="ml-1">
                    · Mis à jour le{' '}
                    {new Date(rateUpdatedAt).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                )}
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
                {(() => {
                  const activeColor = product.colors?.find((c) => c.name === color);
                  return activeColor?.note ? (
                    <p className="mt-1 text-xs text-muted italic">{activeColor.note}</p>
                  ) : null;
                })()}
                <div className="mt-3 flex gap-2">
                  {product.colors.map((c) => {
                    const active = color === c.name;
                    const imgUrl = resolvedColorUrls[c.hex];
                    return (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => {
                          setColor(c.name);
                          setColorImage(imgUrl ?? null);
                        }}
                        title={c.name}
                        className={`relative w-11 h-11 rounded-full border-2 transition-transform hover:scale-105 ${
                          active ? 'border-terra' : 'border-line'
                        }`}
                        style={{ backgroundColor: c.hex }}
                      >
                        {active && (
                          <span className="absolute inset-0 ring-2 ring-terra ring-offset-2 ring-offset-cream rounded-full" />
                        )}
                        {/* Indicateur image disponible */}
                        {imgUrl && !active && (
                          <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-terra rounded-full border-2 border-cream" />
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
                  <button type="button" onClick={() => setSizeGuideOpen(true)} className="text-xs text-terra underline hover:text-terra-dark transition-colors">Guide des tailles</button>
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
                      <strong>Stock :</strong>{' '}
                      {product.stock >= 9999 ? 'Disponible' : `${product.stock} pièces disponibles`}
                    </li>
                    {product.genre && (
                      <li>
                        <strong>Genre :</strong>{' '}
                        {{ femme: 'Femme', homme: 'Homme', mixte: 'Mixte', enfant: 'Enfant' }[product.genre]}
                      </li>
                    )}
                    {product.brand && (
                      <li><strong>Marque :</strong> {product.brand}</li>
                    )}
                    {product.material && (
                      <li><strong>Matière :</strong> {product.material}</li>
                    )}
                    {product.modele && (
                      <li><strong>Modèle :</strong> {product.modele}</li>
                    )}
                    {product.ram && product.ram.length > 0 && (
                      <li><strong>RAM :</strong> {product.ram.join(' / ')}</li>
                    )}
                    {product.connectivity && product.connectivity.length > 0 && (
                      <li><strong>Connectivité :</strong> {product.connectivity.join(', ')}</li>
                    )}
                    {product.platform && (
                      <li><strong>Plateforme :</strong> {product.platform}</li>
                    )}
                    {product.deliveryMode && (
                      <li>
                        <strong>Mode de livraison :</strong>{' '}
                        {{
                          activation_code: 'Code d\'activation',
                          configured_account: 'Compte configuré',
                          direct_recharge: 'Rechargement direct',
                        }[product.deliveryMode]}
                      </li>
                    )}
                    {product.rdcAvailability && (
                      <li>
                        <strong>Disponibilité RDC :</strong>{' '}
                        {{
                          confirmed: '✓ Confirmée',
                          to_verify: '⚠ À vérifier',
                          limited: '⚡ Limitée',
                        }[product.rdcAvailability]}
                      </li>
                    )}
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
