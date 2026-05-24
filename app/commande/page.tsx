'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useShop } from '@/components/ShopProvider';
import { useAuth } from '@/components/AuthProvider';
import { PRODUCTS } from '@/lib/products';
import { formatCDF, formatUSD, usdToCdf } from '@/lib/currency';
import { createOrder } from '@/lib/firebase/db';
import type { DeliveryInfo } from '@/lib/firebase/db';

type Step = 'recap' | 'livraison' | 'paiement' | 'confirmation';

const PAYMENT_METHODS = [
  { id: 'mpesa', label: 'M-Pesa', icon: '📱', detail: 'Paiement Mobile Money Vodacom' },
  { id: 'airtel', label: 'Airtel Money', icon: '📲', detail: 'Paiement Mobile Money Airtel' },
  { id: 'orange', label: 'Orange Money', icon: '🟠', detail: 'Paiement Mobile Money Orange' },
  { id: 'cash', label: 'Cash à la livraison', icon: '💵', detail: 'Payez en espèces à la réception' },
  { id: 'virement', label: 'Virement bancaire', icon: '🏦', detail: 'Virement vers notre compte' },
];

const STEPS: { key: Step; label: string }[] = [
  { key: 'recap', label: 'Panier' },
  { key: 'livraison', label: 'Livraison' },
  { key: 'paiement', label: 'Paiement' },
  { key: 'confirmation', label: 'Confirmation' },
];

export default function CommandePage() {
  const { cart, clearCart, openChat } = useShop();
  const { user } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>('recap');
  const [loading, setLoading] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);

  const [delivery, setDelivery] = useState<DeliveryInfo>({
    name: user?.displayName ?? '',
    phone: '',
    address: '',
    city: 'Kinshasa',
    neighborhood: '',
  });
  const [paymentMethod, setPaymentMethod] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Mark hydration complete
  useEffect(() => { setMounted(true); }, []);

  // Sync displayName when user loads
  useEffect(() => {
    if (user?.displayName && !delivery.name) {
      setDelivery((d) => ({ ...d, name: user.displayName! }));
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const lines = cart
    .map((item) => {
      const product = PRODUCTS.find((p) => p.id === item.productId);
      return product ? { item, product } : null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x);

  const subtotal = lines.reduce(
    (sum, { item, product }) => sum + product.priceUSD * item.quantity,
    0,
  );

  const itemsLabel = lines
    .slice(0, 2)
    .map(({ product }) => product.name)
    .join(' + ') + (lines.length > 2 ? ` +${lines.length - 2}` : '');

  // Redirect if cart empty — only after hydration to avoid false redirect
  useEffect(() => {
    if (!mounted) return;
    if (cart.length === 0 && step !== 'confirmation') router.replace('/panier');
  }, [mounted, cart.length, step, router]);

  const stepIdx = STEPS.findIndex((s) => s.key === step);

  const validateDelivery = () => {
    if (!delivery.name.trim()) return 'Le nom complet est requis.';
    if (!delivery.phone.trim()) return 'Le numéro de téléphone est requis.';
    if (!delivery.address.trim()) return "L'adresse est requise.";
    if (!delivery.city.trim()) return 'La ville est requise.';
    return null;
  };

  const handleConfirm = async () => {
    setError(null);
    if (!paymentMethod) { setError('Choisis un mode de paiement.'); return; }
    setLoading(true);
    try {
      const order = {
        items: cart,
        itemsLabel,
        totalUSD: subtotal,
        deliveryInfo: delivery,
        paymentMethod: PAYMENT_METHODS.find((p) => p.id === paymentMethod)?.label ?? paymentMethod,
        status: 'pending' as const,
      };

      let newOrderId: string | null = null;
      if (user) {
        newOrderId = await createOrder(user.uid, order);
        setOrderId(newOrderId);
      }

      setStep('confirmation');
    } catch {
      setError('Une erreur est survenue. Réessaie.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChat = () => {
    clearCart();
    openChat();
    router.push('/');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 lg:py-16">
      {/* Header */}
      <div className="mb-8">
        <nav className="font-display text-[11px] tracking-widest uppercase text-muted flex items-center gap-2 mb-4">
          <Link href="/" className="hover:text-terra transition-colors">Accueil</Link>
          <span>/</span>
          <Link href="/panier" className="hover:text-terra transition-colors">Panier</Link>
          <span>/</span>
          <span className="text-ink">Commande</span>
        </nav>
        <h1 className="font-display font-extrabold text-4xl text-ink">
          Finaliser ma commande<span className="text-terra">.</span>
        </h1>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-0 mb-10">
        {STEPS.map(({ key, label }, i) => (
          <div key={key} className="flex items-center flex-1">
            <div className="flex flex-col items-center gap-1 flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-display font-bold text-sm border-2 transition-all ${
                  i < stepIdx
                    ? 'bg-terra border-terra text-cream'
                    : i === stepIdx
                      ? 'bg-ink border-ink text-cream'
                      : 'bg-bone border-line text-muted'
                }`}
              >
                {i < stepIdx ? '✓' : i + 1}
              </div>
              <span
                className={`font-display text-[10px] tracking-widest uppercase font-semibold ${
                  i === stepIdx ? 'text-ink' : 'text-muted'
                }`}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mb-5 ${i < stepIdx ? 'bg-terra' : 'bg-line'}`} />
            )}
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-8">
        {/* Main content */}
        <div>
          {/* ── Étape 1 : Récap ── */}
          {step === 'recap' && (
            <div className="space-y-4">
              <h2 className="font-display font-bold text-xl text-ink">Votre panier</h2>
              {lines.map(({ item, product }) => (
                <div
                  key={`${item.productId}-${item.size}-${item.color}`}
                  className="flex gap-4 bg-bone rounded-lg p-4"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={product.images[0]}
                    alt={product.name}
                    className="w-20 h-20 object-cover rounded-md shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-display font-semibold text-sm text-ink">{product.name}</div>
                    <div className="text-xs text-muted mt-0.5">{product.subcategory}</div>
                    {(item.size || item.color) && (
                      <div className="mt-1 flex gap-2 text-[11px] text-ink-light">
                        {item.size && <span className="border border-line rounded px-1.5 py-0.5">Taille {item.size}</span>}
                        {item.color && <span className="border border-line rounded px-1.5 py-0.5">{item.color}</span>}
                      </div>
                    )}
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-muted">× {item.quantity}</span>
                      <span className="font-display font-bold text-sm text-ink">
                        {formatUSD(product.priceUSD * item.quantity)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setStep('livraison')}
                className="w-full h-13 mt-4 rounded-full bg-ink hover:bg-terra text-cream font-display text-xs font-semibold tracking-[0.25em] uppercase transition-colors py-4"
              >
                Continuer → Livraison
              </button>
            </div>
          )}

          {/* ── Étape 2 : Livraison ── */}
          {step === 'livraison' && (
            <div className="space-y-5">
              <h2 className="font-display font-bold text-xl text-ink">Informations de livraison</h2>

              {error && (
                <div className="bg-terra/10 border border-terra/30 text-terra-dark text-sm rounded-md px-4 py-3">
                  {error}
                </div>
              )}

              <Field label="Nom complet *">
                <input
                  type="text"
                  value={delivery.name}
                  onChange={(e) => setDelivery((d) => ({ ...d, name: e.target.value }))}
                  className="w-full bg-cream border border-line rounded-md px-4 py-3 text-sm outline-none focus:border-terra transition-colors"
                  placeholder="Jean-Baptiste Kabila"
                />
              </Field>

              <Field label="Téléphone *">
                <input
                  type="tel"
                  value={delivery.phone}
                  onChange={(e) => setDelivery((d) => ({ ...d, phone: e.target.value }))}
                  className="w-full bg-cream border border-line rounded-md px-4 py-3 text-sm outline-none focus:border-terra transition-colors"
                  placeholder="+243 81 234 5678"
                />
              </Field>

              <Field label="Adresse *">
                <input
                  type="text"
                  value={delivery.address}
                  onChange={(e) => setDelivery((d) => ({ ...d, address: e.target.value }))}
                  className="w-full bg-cream border border-line rounded-md px-4 py-3 text-sm outline-none focus:border-terra transition-colors"
                  placeholder="Avenue de la Paix, n°12"
                />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Ville *">
                  <input
                    type="text"
                    value={delivery.city}
                    onChange={(e) => setDelivery((d) => ({ ...d, city: e.target.value }))}
                    className="w-full bg-cream border border-line rounded-md px-4 py-3 text-sm outline-none focus:border-terra transition-colors"
                    placeholder="Kinshasa"
                  />
                </Field>
                <Field label="Quartier / Commune">
                  <input
                    type="text"
                    value={delivery.neighborhood}
                    onChange={(e) => setDelivery((d) => ({ ...d, neighborhood: e.target.value }))}
                    className="w-full bg-cream border border-line rounded-md px-4 py-3 text-sm outline-none focus:border-terra transition-colors"
                    placeholder="Gombe"
                  />
                </Field>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep('recap')}
                  className="flex-1 h-12 rounded-full border border-line bg-cream hover:bg-bone font-display text-xs font-semibold tracking-widest uppercase transition-colors"
                >
                  ← Retour
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const err = validateDelivery();
                    if (err) { setError(err); return; }
                    setError(null);
                    setStep('paiement');
                  }}
                  className="flex-[2] h-12 rounded-full bg-ink hover:bg-terra text-cream font-display text-xs font-semibold tracking-[0.25em] uppercase transition-colors"
                >
                  Continuer → Paiement
                </button>
              </div>
            </div>
          )}

          {/* ── Étape 3 : Paiement ── */}
          {step === 'paiement' && (
            <div className="space-y-4">
              <h2 className="font-display font-bold text-xl text-ink">Mode de paiement</h2>
              <p className="text-sm text-muted font-light">
                Choisis comment tu souhaites payer. Notre équipe te contactera pour finaliser.
              </p>

              {error && (
                <div className="bg-terra/10 border border-terra/30 text-terra-dark text-sm rounded-md px-4 py-3">
                  {error}
                </div>
              )}

              <div className="space-y-3">
                {PAYMENT_METHODS.map((pm) => (
                  <button
                    key={pm.id}
                    type="button"
                    onClick={() => setPaymentMethod(pm.id)}
                    className={`w-full text-left rounded-lg border p-4 transition-all flex items-center gap-4 ${
                      paymentMethod === pm.id
                        ? 'border-terra bg-terra/5'
                        : 'border-line bg-cream hover:border-terra/40'
                    }`}
                  >
                    <span className="text-2xl shrink-0">{pm.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-display font-semibold text-sm text-ink">{pm.label}</div>
                      <div className="text-xs text-muted mt-0.5">{pm.detail}</div>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center ${
                        paymentMethod === pm.id
                          ? 'border-terra bg-terra'
                          : 'border-line'
                      }`}
                    >
                      {paymentMethod === pm.id && (
                        <div className="w-2 h-2 rounded-full bg-cream" />
                      )}
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep('livraison')}
                  className="flex-1 h-12 rounded-full border border-line bg-cream hover:bg-bone font-display text-xs font-semibold tracking-widest uppercase transition-colors"
                >
                  ← Retour
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={loading}
                  className="flex-[2] h-12 rounded-full bg-terra hover:bg-terra-light hover:text-ink text-cream font-display text-xs font-semibold tracking-[0.25em] uppercase transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-cream/40 border-t-cream rounded-full animate-spin" />
                      Traitement…
                    </>
                  ) : (
                    '✓ Confirmer la commande'
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ── Étape 4 : Confirmation ── */}
          {step === 'confirmation' && (
            <div className="text-center py-8">
              <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center text-4xl mx-auto">
                ✓
              </div>
              <h2 className="mt-6 font-display font-extrabold text-3xl text-ink">
                Commande enregistrée !
              </h2>
              <p className="mt-3 text-muted font-light max-w-sm mx-auto leading-relaxed">
                Notre équipe va maintenant te contacter via le chat pour finaliser le paiement
                ({PAYMENT_METHODS.find((p) => p.id === paymentMethod)?.label}) et la livraison à{' '}
                <strong>{delivery.city}{delivery.neighborhood ? `, ${delivery.neighborhood}` : ''}</strong>.
              </p>
              {orderId && (
                <div className="mt-4 inline-block bg-bone rounded-md px-4 py-2 font-mono text-xs text-muted">
                  Réf : {orderId.slice(0, 8).toUpperCase()}
                </div>
              )}

              <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  type="button"
                  onClick={handleOpenChat}
                  className="flex-1 sm:flex-none h-12 px-8 rounded-full bg-terra hover:bg-terra-light hover:text-ink text-cream font-display text-xs font-semibold tracking-[0.25em] uppercase transition-colors flex items-center justify-center gap-2"
                >
                  💬 Ouvrir le chat
                </button>
                {user && (
                  <Link
                    href="/compte"
                    className="flex-1 sm:flex-none h-12 px-8 rounded-full border border-line bg-cream hover:bg-bone font-display text-xs font-semibold tracking-widest uppercase transition-colors flex items-center justify-center"
                  >
                    Mon espace →
                  </Link>
                )}
              </div>

              <p className="mt-10 text-xs text-muted">
                ←{' '}
                <Link href="/" className="underline hover:text-terra transition-colors">
                  Retour à la boutique
                </Link>
              </p>
            </div>
          )}
        </div>

        {/* Récap sidebar */}
        {step !== 'confirmation' && (
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="bg-ink text-cream rounded-lg p-6">
              <h3 className="font-display text-[11px] tracking-[0.3em] uppercase font-semibold text-cream/60">
                Récapitulatif
              </h3>
              <div className="mt-4 space-y-3 pb-4 border-b border-cream/10">
                {lines.map(({ item, product }) => (
                  <div key={`${item.productId}-${item.size}`} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-cream/80 truncate flex-1">
                      {product.name} × {item.quantity}
                    </span>
                    <span className="font-display font-semibold text-cream shrink-0">
                      {formatUSD(product.priceUSD * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-end justify-between">
                <span className="font-display text-xs tracking-widest uppercase text-cream/60">Total</span>
                <div className="text-right">
                  <div className="font-display font-extrabold text-2xl text-cream">{formatUSD(subtotal)}</div>
                  <div className="text-gold font-display text-sm mt-0.5">≈ {formatCDF(usdToCdf(subtotal))}</div>
                </div>
              </div>

              {step !== 'recap' && (
                <div className="mt-4 pt-4 border-t border-cream/10 space-y-2 text-xs text-cream/60">
                  {delivery.name && (
                    <div className="flex gap-2">
                      <span>👤</span>
                      <span>{delivery.name} · {delivery.phone}</span>
                    </div>
                  )}
                  {delivery.address && (
                    <div className="flex gap-2">
                      <span>📍</span>
                      <span>{delivery.address}, {delivery.city}{delivery.neighborhood ? ` (${delivery.neighborhood})` : ''}</span>
                    </div>
                  )}
                  {paymentMethod && (
                    <div className="flex gap-2">
                      <span>💳</span>
                      <span>{PAYMENT_METHODS.find((p) => p.id === paymentMethod)?.label}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="font-display text-[11px] tracking-widest uppercase font-semibold text-ink mb-2 block">
        {label}
      </span>
      {children}
    </label>
  );
}
