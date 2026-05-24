'use client';

import Link from 'next/link';
import { useAdmin } from '@/components/admin/AdminProvider';
import { AdminTopBar } from '@/components/admin/AdminTopBar';
import { formatCDF, formatUSD } from '@/lib/currency';
import { STATUS_LABEL, STATUS_TONE } from '@/lib/admin/types';

export default function AdminDashboard() {
  const {
    currentAdmin,
    products,
    orders,
    clients,
    notifications,
    admins,
    exchangeRate,
    rateUpdatedAt,
  } = useAdmin();
  if (!currentAdmin) return null;

  const totalRevenue = orders
    .filter((o) => ['order_confirmed', 'shipped', 'delivered'].includes(o.status))
    .reduce((sum, o) => sum + o.totalUSD, 0);

  const openConversations = orders.filter((o) => o.status === 'open' || o.unreadCount > 0).length;
  const activeProducts = products.filter((p) => p.status !== 'inactive').length;
  const featuredCount = products.filter((p) => p.status === 'featured').length;
  const unreadNotifs = notifications.filter((n) => !n.read).length;

  const recentOrders = [...orders]
    .sort((a, b) => +new Date(b.lastMessageAt) - +new Date(a.lastMessageAt))
    .slice(0, 5);

  return (
    <>
      <AdminTopBar
        title={`Bonjour, ${currentAdmin.fullName.split(' ')[0]} 👋`}
        subtitle={`${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`}
      />

      <div className="p-8 space-y-8">
        {/* Quick-stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="CA confirmé"
            value={formatUSD(totalRevenue)}
            sub={`≈ ${formatCDF(totalRevenue * exchangeRate)}`}
            tone="terra"
            trend="+12% / sem."
          />
          <StatCard
            label="Commandes ouvertes"
            value={String(openConversations)}
            sub={openConversations > 0 ? 'À traiter' : 'Tout est à jour'}
            tone="gold"
          />
          <StatCard
            label="Produits actifs"
            value={String(activeProducts)}
            sub={`${featuredCount} à la une`}
            tone="ink"
          />
          <StatCard
            label="Clients"
            value={String(clients.length)}
            sub={`${clients.filter((c) => c.ordersCount > 0).length} ont commandé`}
            tone="beige"
          />
        </div>

        {/* Main grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Recent orders */}
          <div className="lg:col-span-2 bg-cream border border-line rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-line flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-base">Activité récente</h3>
                <p className="text-[11px] text-muted font-light">5 dernières conversations</p>
              </div>
              <Link
                href="/admin/commandes"
                className="font-display text-[11px] tracking-widest uppercase font-semibold text-terra hover:text-terra-dark"
              >
                Tout voir →
              </Link>
            </div>
            <div className="divide-y divide-line">
              {recentOrders.map((order) => (
                <Link
                  key={order.id}
                  href="/admin/commandes"
                  className="flex items-center gap-4 px-6 py-4 hover:bg-bone transition-colors group"
                >
                  <div className="w-10 h-10 rounded-full bg-bone flex items-center justify-center font-display font-bold text-sm text-terra shrink-0">
                    {order.clientName
                      .split(' ')
                      .map((s) => s[0])
                      .slice(0, 2)
                      .join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-display font-semibold text-sm text-ink truncate">
                        {order.clientName}
                      </span>
                      {order.unreadCount > 0 && (
                        <span className="bg-terra text-cream text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                          {order.unreadCount}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted truncate mt-0.5">{order.lastMessage}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`inline-block text-[10px] font-display font-bold tracking-widest uppercase px-2 py-0.5 rounded border ${STATUS_TONE[order.status]}`}
                    >
                      {STATUS_LABEL[order.status]}
                    </span>
                    <div className="font-display text-sm font-bold text-ink mt-1">
                      {formatUSD(order.totalUSD)}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Side panel */}
          <div className="space-y-6">
            {/* Exchange rate */}
            <div className="bg-ink text-cream rounded-lg p-6">
              <div className="font-display text-[10px] tracking-[0.3em] uppercase text-cream/60 font-semibold">
                Taux USD → CDF
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="font-display font-extrabold text-4xl text-cream">
                  {exchangeRate.toLocaleString('fr-FR')}
                </span>
                <span className="text-gold font-display text-sm font-semibold">FC / USD</span>
              </div>
              <div className="mt-2 text-[11px] text-cream/40 font-light">
                Mis à jour le{' '}
                {new Date(rateUpdatedAt).toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </div>
              <Link
                href="/admin/taux"
                className="mt-4 inline-block font-display text-[11px] tracking-widest uppercase font-semibold text-terra-light hover:text-cream underline"
              >
                Modifier le taux →
              </Link>
            </div>

            {/* Team */}
            <div className="bg-cream border border-line rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-display font-bold text-sm">Équipe</h4>
                  <p className="text-[11px] text-muted">{admins.length} / 3 admins</p>
                </div>
                {currentAdmin.role === 'admin_principal' && (
                  <Link
                    href="/admin/equipe"
                    className="font-display text-[10px] tracking-widest uppercase font-semibold text-terra hover:text-terra-dark underline"
                  >
                    Gérer →
                  </Link>
                )}
              </div>
              <div className="mt-4 space-y-2">
                {admins.map((a) => (
                  <div key={a.id} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-terra text-cream flex items-center justify-center font-display font-bold text-xs">
                      {a.fullName
                        .split(' ')
                        .map((s) => s[0])
                        .slice(0, 2)
                        .join('')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{a.fullName}</div>
                      <div className="text-[10px] text-muted truncate">
                        {a.role === 'admin_principal' ? 'Principal' : 'Secondaire'}
                      </div>
                    </div>
                  </div>
                ))}
                {Array.from({ length: 3 - admins.length }).map((_, i) => (
                  <div key={`slot-${i}`} className="flex items-center gap-3 opacity-40">
                    <div className="w-8 h-8 rounded-full border border-dashed border-muted flex items-center justify-center text-muted text-xs">
                      +
                    </div>
                    <span className="text-xs text-muted italic">Slot libre</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Notifications */}
            <div className="bg-cream border border-line rounded-lg p-6">
              <h4 className="font-display font-bold text-sm">Alertes</h4>
              {unreadNotifs > 0 ? (
                <p className="mt-2 text-sm text-ink-light">
                  <strong className="text-terra">{unreadNotifs}</strong> notification{unreadNotifs > 1 ? 's' : ''} non lue{unreadNotifs > 1 ? 's' : ''}.
                </p>
              ) : (
                <p className="mt-2 text-sm text-muted">Tout est à jour ✓</p>
              )}
              <Link
                href="/admin/notifications"
                className="mt-4 inline-block font-display text-[11px] tracking-widest uppercase font-semibold text-terra hover:text-terra-dark underline"
              >
                Voir l'historique →
              </Link>
            </div>
          </div>
        </div>

        {/* Module shortcuts */}
        <div>
          <h3 className="font-display font-bold text-lg mb-4">Accès rapides</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <ShortcutCard href="/admin/produits" label="Catalogue" icon="📦" />
            <ShortcutCard href="/admin/commandes" label="Commandes" icon="💬" />
            <ShortcutCard href="/admin/editorial" label="Éditorial" icon="⭐" />
            <ShortcutCard href="/admin/equipe" label="Équipe" icon="👥" />
          </div>
        </div>
      </div>
    </>
  );
}

function StatCard({
  label,
  value,
  sub,
  tone,
  trend,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: 'terra' | 'ink' | 'beige' | 'gold';
  trend?: string;
}) {
  const map = {
    terra: 'bg-terra text-cream',
    ink: 'bg-ink text-cream',
    beige: 'bg-beige text-ink border border-line',
    gold: 'bg-gold text-ink',
  };
  const subColor = tone === 'beige' ? 'text-muted' : tone === 'gold' ? 'text-ink/70' : 'text-cream/70';

  return (
    <div className={`${map[tone]} rounded-lg p-5`}>
      <div className={`font-display text-[10px] tracking-[0.3em] uppercase font-semibold ${subColor}`}>
        {label}
      </div>
      <div className="mt-2 font-display font-extrabold text-3xl leading-none">{value}</div>
      {sub && <div className={`mt-2 text-xs ${subColor} font-light`}>{sub}</div>}
      {trend && (
        <div className={`mt-3 inline-block text-[10px] font-display font-semibold ${subColor}`}>
          ▲ {trend}
        </div>
      )}
    </div>
  );
}

function ShortcutCard({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <Link
      href={href}
      className="bg-cream border border-line rounded-lg p-5 hover:border-terra hover:shadow-sm transition-all group"
    >
      <div className="text-2xl">{icon}</div>
      <div className="mt-3 font-display font-bold text-sm text-ink group-hover:text-terra transition-colors">
        {label}
      </div>
      <div className="mt-1 text-xs text-muted font-light">Ouvrir le module →</div>
    </Link>
  );
}
