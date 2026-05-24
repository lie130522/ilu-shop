'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useShop } from '@/components/ShopProvider';
import { PRODUCTS } from '@/lib/products';
import { PriceDisplay } from '@/components/PriceDisplay';
import { formatCDF, formatUSD, usdToCdf } from '@/lib/currency';

export default function PanierClient() {
  const { cart, removeFromCart, updateQuantity, clearCart } = useShop();
  const router = useRouter();

  const lines = cart
    .map((item) => {
      const product = PRODUCTS.find((p) => p.id === item.productId);
      return product ? { item, product } : null;
    })
    .filter((x): x is { item: typeof cart[number]; product: typeof PRODUCTS[number] } => !!x);

  const subtotal = lines.reduce((sum, { item, product }) => sum + product.priceUSD * item.quantity, 0);

  if (lines.length === 0) {
    return (
      <section className="max-w-3xl mx-auto px-6 py-32 text-center">
        <div className="font-display text-7xl text-beige">∅</div>
        <h1 className="mt-8 font-display font-extrabold text-4xl md:text-5xl text-ink">
          Votre panier est vide
        </h1>
        <p className="mt-4 text-muted font-light max-w-md mx-auto">
          Découvrez notre sélection éditoriale et ajoutez vos pièces préférées au panier.
        </p>
        <Link
          href="/catalogue"
          className="inline-flex items-center gap-3 mt-10 bg-ink hover:bg-terra text-cream font-display text-xs font-semibold tracking-[0.25em] uppercase px-8 py-4 rounded-full transition-colors duration-300 group"
        >
          Explorer le catalogue
          <span className="transition-transform group-hover:translate-x-1">→</span>
        </Link>
      </section>
    );
  }

  return (
    <section className="max-w-7xl mx-auto px-6 lg:px-10 py-12 lg:py-16">
      {/* Header */}
      <div className="mb-12">
        <nav className="font-display text-[11px] tracking-widest uppercase text-muted flex items-center gap-2">
          <Link href="/" className="hover:text-terra transition-colors">
            Accueil
          </Link>
          <span>/</span>
          <span className="text-ink">Panier</span>
        </nav>
        <div className="mt-4 flex items-end justify-between gap-4 flex-wrap">
          <h1 className="font-display font-extrabold text-5xl md:text-6xl text-ink leading-none">
            Votre panier<span className="text-terra">.</span>
          </h1>
          <button
            type="button"
            onClick={clearCart}
            className="font-display text-[11px] tracking-widest uppercase text-muted hover:text-terra transition-colors underline"
          >
            Vider le panier
          </button>
        </div>
        <p className="mt-3 text-sm text-muted font-light">
          {lines.length} article{lines.length > 1 ? 's' : ''} • Paiement et livraison convenus par chat
        </p>
      </div>

      <div className="grid lg:grid-cols-[1fr_400px] gap-10">
        {/* Cart items */}
        <div className="space-y-4">
          {lines.map(({ item, product }) => (
            <div
              key={`${item.productId}-${item.size}-${item.color}`}
              className="flex gap-4 bg-bone rounded-lg p-4 hover:shadow-sm transition-shadow"
            >
              <Link
                href={`/produit/${product.slug}`}
                className="relative shrink-0 w-28 h-28 md:w-32 md:h-32 bg-cream rounded-md overflow-hidden flex items-center justify-center"
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-3/4 aspect-square rounded-full bg-beige/60 blur-xl" />
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={product.images[0]}
                  alt={product.name}
                  className="relative z-10 w-full h-full object-cover"
                />
              </Link>

              <div className="flex-1 min-w-0 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/produit/${product.slug}`}
                        className="font-display text-base md:text-lg font-bold text-ink hover:text-terra transition-colors truncate block"
                      >
                        {product.name}
                      </Link>
                      <div className="text-xs text-muted mt-1 truncate">{product.subcategory}</div>
                      {(item.size || item.color) && (
                        <div className="mt-2 flex items-center gap-3 text-[11px] text-ink-light">
                          {item.size && (
                            <span className="border border-line rounded px-2 py-0.5">
                              Taille {item.size}
                            </span>
                          )}
                          {item.color && (
                            <span className="border border-line rounded px-2 py-0.5">
                              {item.color}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.productId, item.size, item.color)}
                      aria-label="Retirer"
                      className="text-muted hover:text-terra transition-colors p-1"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                        <path d="M5 7h14M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="flex items-end justify-between gap-3 mt-3">
                  <div className="flex items-center border border-line rounded-full bg-cream">
                    <button
                      type="button"
                      onClick={() =>
                        updateQuantity(
                          item.productId,
                          Math.max(1, item.quantity - 1),
                          item.size,
                          item.color,
                        )
                      }
                      className="w-9 h-9 hover:bg-beige rounded-l-full transition-colors"
                      aria-label="Diminuer"
                    >
                      −
                    </button>
                    <span className="w-8 text-center font-display font-semibold text-sm">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        updateQuantity(item.productId, item.quantity + 1, item.size, item.color)
                      }
                      className="w-9 h-9 hover:bg-beige rounded-r-full transition-colors"
                      aria-label="Augmenter"
                    >
                      +
                    </button>
                  </div>
                  <PriceDisplay usd={product.priceUSD * item.quantity} size="md" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="bg-ink text-cream rounded-lg p-8">
            <h3 className="font-display text-[11px] tracking-[0.3em] uppercase font-semibold text-cream/60">
              Récapitulatif
            </h3>
            <div className="mt-6 space-y-3 pb-6 border-b border-cream/10">
              <Row label="Sous-total" value={formatUSD(subtotal)} sub={formatCDF(usdToCdf(subtotal))} />
              <Row label="Livraison" value="Convenu en chat" small />
            </div>
            <div className="mt-6 flex items-end justify-between">
              <span className="font-display text-xs tracking-widest uppercase text-cream/60">
                Total
              </span>
              <div className="text-right">
                <div className="font-display font-extrabold text-3xl text-cream leading-none">
                  {formatUSD(subtotal)}
                </div>
                <div className="font-display text-sm text-gold font-medium mt-1">
                  ≈ {formatCDF(usdToCdf(subtotal))}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => router.push('/commande')}
              className="mt-8 w-full h-14 rounded-full bg-terra hover:bg-terra-light hover:text-ink text-cream font-display text-sm font-semibold tracking-[0.2em] uppercase transition-colors flex items-center justify-center gap-3 group"
            >
              Passer commande
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </button>

            <p className="mt-4 text-[11px] text-cream/50 font-light text-center leading-relaxed">
              Tu renseignes ton adresse et ton mode de paiement. Notre équipe te contacte ensuite
              par chat pour finaliser.
            </p>
          </div>

          {/* Trust */}
          <div className="mt-6 bg-bone rounded-lg p-6">
            <h4 className="font-display text-[10px] tracking-widest uppercase font-semibold text-ink">
              Modes de paiement acceptés
            </h4>
            <div className="mt-4 flex flex-wrap gap-2">
              {['M-Pesa', 'Airtel Money', 'Orange Money', 'Virement', 'Cash'].map((m) => (
                <span
                  key={m}
                  className="font-display text-[10px] font-semibold tracking-wider px-2.5 py-1 rounded bg-cream border border-line"
                >
                  {m}
                </span>
              ))}
            </div>
            <div className="mt-5 flex items-center gap-2 text-xs text-muted font-light">
              <span className="text-base">🔒</span>
              Transactions convenues directement avec l'équipe ILU SHOP
            </div>
          </div>

          <Link
            href="/catalogue"
            className="mt-6 block text-center font-display text-xs font-semibold tracking-widest uppercase text-ink hover:text-terra transition-colors underline"
          >
            ← Continuer mes achats
          </Link>
        </aside>
      </div>
    </section>
  );
}

function Row({
  label,
  value,
  sub,
  small,
}: {
  label: string;
  value: string;
  sub?: string;
  small?: boolean;
}) {
  return (
    <div className="flex items-start justify-between">
      <span className={`text-cream/70 font-light ${small ? 'text-xs' : 'text-sm'}`}>{label}</span>
      <div className="text-right">
        <div className={`font-display font-semibold ${small ? 'text-xs text-cream/70' : 'text-sm text-cream'}`}>
          {value}
        </div>
        {sub && <div className="text-[10px] text-gold mt-0.5">≈ {sub}</div>}
      </div>
    </div>
  );
}
