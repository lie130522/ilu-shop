'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { useShop } from '@/components/ShopProvider';
import { PRODUCTS } from '@/lib/products';
import { formatUSD } from '@/lib/currency';
import { getUserOrders, getUserProfile, setUserProfile } from '@/lib/firebase/db';
import type { ClientOrder, UserProfile } from '@/lib/firebase/db';

type Tab = 'dashboard' | 'commandes' | 'wishlist' | 'profil';

// P15 — Aligné sur OrderStatus de lib/admin/types
const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  open: { label: 'En attente', color: 'bg-gold/20 text-yellow-800 border-gold/30' },
  in_progress: { label: 'En cours', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  order_confirmed: { label: 'Confirmée', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  shipped: { label: 'Expédiée', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  delivered: { label: 'Livrée ✓', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  closed: { label: 'Clôturée', color: 'bg-terra/10 text-terra-dark border-terra/30' },
};

export default function ComptePage() {
  const { user, loading, logout } = useAuth();
  const { wishlist, toggleWishlist } = useShop();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>('dashboard');
  const [orders, setOrders] = useState<ClientOrder[]>([]);
  const [profile, setProfileState] = useState<UserProfile | null>(null);
  const [profileForm, setProfileForm] = useState<Partial<UserProfile>>({});
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/connexion');
  }, [user, loading, router]);

  // Load orders + profile when tab changes
  useEffect(() => {
    if (!user) return;
    if (tab === 'commandes' || tab === 'dashboard') {
      setOrdersLoading(true);
      getUserOrders(user.uid).then((o) => { setOrders(o); setOrdersLoading(false); });
    }
    if (tab === 'profil') {
      getUserProfile(user.uid).then((p) => {
        const base: UserProfile = {
          displayName: user.displayName ?? '',
          email: user.email ?? '',
          phone: '',
          city: '',
          address: '',
          neighborhood: '',
        };
        const merged = { ...base, ...p };
        setProfileState(merged);
        setProfileForm(merged);
      });
    }
  }, [tab, user]);

  if (loading || !user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-terra/30 border-t-terra rounded-full animate-spin" />
      </div>
    );
  }

  const initial = (user.displayName || user.email || 'U')[0].toUpperCase();
  const wishlistProducts = PRODUCTS.filter((p) => wishlist.includes(p.id));

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setProfileSaving(true);
    await setUserProfile(user.uid, profileForm);
    setProfileSaved(true);
    setProfileSaving(false);
    setTimeout(() => setProfileSaved(false), 3000);
  };

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'dashboard', label: 'Tableau de bord', icon: '◎' },
    { key: 'commandes', label: 'Mes commandes', icon: '📦' },
    { key: 'wishlist', label: 'Ma wishlist', icon: '♡' },
    { key: 'profil', label: 'Mon profil', icon: '👤' },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 lg:py-14">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <span className="font-display text-[10px] tracking-[0.35em] uppercase text-terra font-semibold">
            ◯ Mon espace
          </span>
          <h1 className="mt-2 font-display font-extrabold text-4xl text-ink">
            Bonjour{user.displayName ? `, ${user.displayName.split(' ')[0]}` : ''}.
          </h1>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="font-display text-[11px] tracking-widest uppercase font-semibold text-muted hover:text-terra transition-colors"
        >
          Se déconnecter
        </button>
      </div>

      <div className="grid lg:grid-cols-[220px_1fr] gap-6">
        {/* Sidebar nav */}
        <nav className="space-y-1">
          {/* Avatar card */}
          <div className="bg-cream border border-line rounded-xl p-4 flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-terra text-cream flex items-center justify-center font-display font-extrabold text-lg shrink-0">
              {user.photoURL ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.photoURL} alt="" className="w-12 h-12 rounded-full object-cover" />
              ) : initial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-display font-semibold text-sm text-ink truncate">
                {user.displayName || 'Client ILU SHOP'}
              </p>
              <p className="text-xs text-muted truncate">{user.email}</p>
            </div>
          </div>

          {tabs.map(({ key, label, icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-display font-medium transition-colors ${
                tab === key
                  ? 'bg-ink text-cream'
                  : 'text-ink hover:bg-bone'
              }`}
            >
              <span className="text-base">{icon}</span>
              {label}
            </button>
          ))}

          <div className="pt-4 mt-4 border-t border-line">
            <Link
              href="/"
              className="block text-xs text-muted hover:text-terra transition-colors font-display tracking-wide"
            >
              ← Retour à la boutique
            </Link>
          </div>
        </nav>

        {/* Main content */}
        <div>
          {/* ── Dashboard ── */}
          {tab === 'dashboard' && (
            <div className="space-y-6">
              {/* Quick stats */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <StatCard label="Commandes" value={String(orders.length)} icon="📦" onClick={() => setTab('commandes')} />
                <StatCard label="Wishlist" value={String(wishlist.length)} icon="♡" onClick={() => setTab('wishlist')} />
                <StatCard
                  label="Dépensé"
                  value={formatUSD(orders.filter((o) => o.status !== 'closed').reduce((s, o) => s + o.totalUSD, 0))}
                  icon="💳"
                />
              </div>

              {/* Recent orders */}
              <div className="bg-cream border border-line rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display font-bold text-sm">Dernières commandes</h3>
                  <button type="button" onClick={() => setTab('commandes')} className="font-display text-[11px] tracking-widest uppercase text-terra hover:text-terra-dark font-semibold">
                    Tout voir →
                  </button>
                </div>
                {ordersLoading ? (
                  <div className="py-4 flex justify-center">
                    <div className="w-6 h-6 border-2 border-terra/30 border-t-terra rounded-full animate-spin" />
                  </div>
                ) : orders.length === 0 ? (
                  <div className="py-6 text-center">
                    <p className="text-sm text-muted">Aucune commande pour l&apos;instant.</p>
                    <Link href="/catalogue" className="mt-3 inline-block font-display text-xs font-semibold tracking-widest uppercase text-terra hover:underline">
                      Explorer le catalogue →
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {orders.slice(0, 3).map((order) => (
                      <OrderRow key={order.id} order={order} />
                    ))}
                  </div>
                )}
              </div>

              {/* Wishlist preview */}
              {wishlistProducts.length > 0 && (
                <div className="bg-cream border border-line rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-display font-bold text-sm">Ma wishlist</h3>
                    <button type="button" onClick={() => setTab('wishlist')} className="font-display text-[11px] tracking-widest uppercase text-terra hover:text-terra-dark font-semibold">
                      Tout voir →
                    </button>
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-1">
                    {wishlistProducts.slice(0, 4).map((p) => (
                      <Link key={p.id} href={`/produit/${p.slug}`} className="shrink-0 w-20">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.images[0]} alt={p.name} className="w-20 h-20 object-cover rounded-lg" />
                        <p className="text-[11px] text-ink font-medium mt-1 truncate">{p.name}</p>
                        <p className="text-[11px] text-terra font-semibold">{formatUSD(p.priceUSD)}</p>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Commandes ── */}
          {tab === 'commandes' && (
            <div>
              <h2 className="font-display font-bold text-xl text-ink mb-5">Mes commandes</h2>
              {ordersLoading ? (
                <div className="py-12 flex justify-center">
                  <div className="w-8 h-8 border-2 border-terra/30 border-t-terra rounded-full animate-spin" />
                </div>
              ) : orders.length === 0 ? (
                <div className="bg-cream border border-line rounded-xl p-10 text-center">
                  <div className="text-5xl mb-4">📦</div>
                  <p className="font-display font-semibold text-ink">Aucune commande</p>
                  <p className="text-sm text-muted mt-2 font-light">Découvrez notre catalogue et passez votre première commande.</p>
                  <Link href="/catalogue" className="mt-6 inline-block bg-ink hover:bg-terra text-cream font-display text-xs font-semibold tracking-widest uppercase px-8 py-3 rounded-full transition-colors">
                    Explorer →
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {orders.map((order) => (
                    <div key={order.id} className="bg-cream border border-line rounded-xl p-5">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div>
                          <div className="font-display font-semibold text-sm text-ink">{order.itemsLabel}</div>
                          <div className="text-xs text-muted mt-0.5">
                            {order.createdAt ? new Date((order.createdAt as { seconds: number }).seconds * 1000).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-display font-bold text-sm text-ink">{formatUSD(order.totalUSD)}</div>
                          <span className={`inline-block mt-1 text-[10px] font-display font-semibold tracking-widest uppercase px-2 py-0.5 rounded border ${STATUS_LABEL[order.status]?.color ?? 'bg-bone text-muted border-line'}`}>
                            {STATUS_LABEL[order.status]?.label ?? order.status}
                          </span>
                        </div>
                      </div>
                      <div className="text-xs text-muted border-t border-line pt-3 flex gap-4">
                        <span>📍 {order.deliveryInfo.city}{order.deliveryInfo.neighborhood ? `, ${order.deliveryInfo.neighborhood}` : ''}</span>
                        <span>💳 {order.paymentMethod}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Wishlist ── */}
          {tab === 'wishlist' && (
            <div>
              <h2 className="font-display font-bold text-xl text-ink mb-5">
                Ma wishlist <span className="text-muted font-light text-base">({wishlistProducts.length})</span>
              </h2>
              {wishlistProducts.length === 0 ? (
                <div className="bg-cream border border-line rounded-xl p-10 text-center">
                  <div className="text-5xl mb-4">♡</div>
                  <p className="font-display font-semibold text-ink">Aucun article sauvegardé</p>
                  <p className="text-sm text-muted mt-2 font-light">Parcourez le catalogue et cliquez sur ♡ pour sauvegarder vos coups de cœur.</p>
                  <Link href="/catalogue" className="mt-6 inline-block bg-ink hover:bg-terra text-cream font-display text-xs font-semibold tracking-widest uppercase px-8 py-3 rounded-full transition-colors">
                    Explorer →
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {wishlistProducts.map((product) => (
                    <div key={product.id} className="bg-cream border border-line rounded-xl overflow-hidden group">
                      <Link href={`/produit/${product.slug}`} className="block relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={product.images[0]}
                          alt={product.name}
                          className="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </Link>
                      <div className="p-3">
                        <Link href={`/produit/${product.slug}`} className="font-display font-semibold text-sm text-ink hover:text-terra transition-colors block truncate">
                          {product.name}
                        </Link>
                        <div className="flex items-center justify-between mt-2">
                          <span className="font-display font-bold text-sm text-terra">{formatUSD(product.priceUSD)}</span>
                          <button
                            type="button"
                            onClick={() => toggleWishlist(product.id)}
                            className="text-terra hover:text-terra-dark transition-colors text-lg"
                            title="Retirer de la wishlist"
                          >
                            ♥
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Profil ── */}
          {tab === 'profil' && (
            <div>
              <h2 className="font-display font-bold text-xl text-ink mb-5">Mon profil</h2>
              <div className="bg-cream border border-line rounded-xl p-6 space-y-5">
                <div className="grid sm:grid-cols-2 gap-5">
                  <Field label="Nom complet">
                    <input
                      type="text"
                      value={profileForm.displayName ?? ''}
                      onChange={(e) => setProfileForm((f) => ({ ...f, displayName: e.target.value }))}
                      className="w-full bg-bone border border-line rounded-md px-4 py-3 text-sm outline-none focus:border-terra transition-colors"
                    />
                  </Field>
                  <Field label="Email">
                    <input
                      type="email"
                      value={user.email ?? ''}
                      disabled
                      className="w-full bg-bone border border-line rounded-md px-4 py-3 text-sm text-muted cursor-not-allowed"
                    />
                  </Field>
                  <Field label="Téléphone">
                    <input
                      type="tel"
                      value={profileForm.phone ?? ''}
                      onChange={(e) => setProfileForm((f) => ({ ...f, phone: e.target.value }))}
                      placeholder="+243 81 234 5678"
                      className="w-full bg-bone border border-line rounded-md px-4 py-3 text-sm outline-none focus:border-terra transition-colors"
                    />
                  </Field>
                  <Field label="Ville">
                    <input
                      type="text"
                      value={profileForm.city ?? ''}
                      onChange={(e) => setProfileForm((f) => ({ ...f, city: e.target.value }))}
                      placeholder="Kinshasa"
                      className="w-full bg-bone border border-line rounded-md px-4 py-3 text-sm outline-none focus:border-terra transition-colors"
                    />
                  </Field>
                  <Field label="Adresse">
                    <input
                      type="text"
                      value={profileForm.address ?? ''}
                      onChange={(e) => setProfileForm((f) => ({ ...f, address: e.target.value }))}
                      placeholder="Avenue de la Paix, n°12"
                      className="w-full bg-bone border border-line rounded-md px-4 py-3 text-sm outline-none focus:border-terra transition-colors"
                    />
                  </Field>
                  <Field label="Quartier / Commune">
                    <input
                      type="text"
                      value={profileForm.neighborhood ?? ''}
                      onChange={(e) => setProfileForm((f) => ({ ...f, neighborhood: e.target.value }))}
                      placeholder="Gombe"
                      className="w-full bg-bone border border-line rounded-md px-4 py-3 text-sm outline-none focus:border-terra transition-colors"
                    />
                  </Field>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleSaveProfile}
                    disabled={profileSaving}
                    className="h-11 px-8 rounded-full bg-ink hover:bg-terra text-cream font-display text-xs font-semibold tracking-widest uppercase transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {profileSaving ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-cream/40 border-t-cream rounded-full animate-spin" />
                        Sauvegarde…
                      </>
                    ) : 'Sauvegarder'}
                  </button>
                  {profileSaved && (
                    <span className="text-sm text-emerald-600 font-display font-medium">✓ Sauvegardé</span>
                  )}
                </div>
              </div>

              {/* Sécurité */}
              <div className="mt-5 bg-cream border border-line rounded-xl p-6">
                <h3 className="font-display font-semibold text-sm text-ink mb-3">Sécurité</h3>
                <div className="text-sm text-muted font-light space-y-2">
                  <p>
                    Compte créé avec{' '}
                    <span className="font-medium text-ink">
                      {user.providerData[0]?.providerId === 'google.com' ? 'Google OAuth' : 'Email / Mot de passe'}
                    </span>
                  </p>
                  {!user.emailVerified && (
                    <p className="text-terra text-xs">⚠ Email non vérifié. Vérifie ta boîte mail.</p>
                  )}
                </div>
              </div>

              {/* Données & vie privée */}
              <div className="mt-5 bg-cream border border-line rounded-xl p-6">
                <h3 className="font-display font-semibold text-sm text-ink mb-2">Vie privée</h3>
                <p className="text-xs text-muted font-light leading-relaxed">
                  Tes données comportementales (produits consultés, wishlist) nous aident à te proposer des recommandations personnalisées. Tu peux demander leur suppression à tout moment via <a href="mailto:privacy@ilushop.cd" className="underline hover:text-terra">privacy@ilushop.cd</a>.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, onClick }: { label: string; value: string; icon: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-cream border border-line rounded-xl p-4 text-left hover:border-terra/40 transition-colors w-full"
    >
      <div className="text-xl mb-2">{icon}</div>
      <div className="font-display font-extrabold text-2xl text-ink">{value}</div>
      <div className="font-display text-[10px] tracking-widest uppercase text-muted mt-1 font-semibold">{label}</div>
    </button>
  );
}

function OrderRow({ order }: { order: ClientOrder }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b border-line last:border-0">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-display font-medium text-ink truncate">{order.itemsLabel}</div>
        <div className="text-xs text-muted">{formatUSD(order.totalUSD)} · {order.paymentMethod}</div>
      </div>
      <span className={`shrink-0 text-[10px] font-display font-semibold tracking-widest uppercase px-2 py-0.5 rounded border ${STATUS_LABEL[order.status]?.color ?? 'bg-bone text-muted border-line'}`}>
        {STATUS_LABEL[order.status]?.label ?? order.status}
      </span>
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
