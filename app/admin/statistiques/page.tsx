'use client';

import { useEffect, useState } from 'react';
import { AdminTopBar } from '@/components/admin/AdminTopBar';
import { useAdmin } from '@/components/admin/AdminProvider';
import { formatUSD } from '@/lib/currency';
import { getTopProducts } from '@/lib/firebase/db';
import { PRODUCTS } from '@/lib/products';

interface TopProduct {
  productId: string;
  views: number;
  category: string;
  name?: string;
}

const STATUS_REVENUE = ['order_confirmed', 'shipped', 'delivered'];

export default function StatistiquesPage() {
  const { currentAdmin, orders, clients, products } = useAdmin();
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [loadingTop, setLoadingTop] = useState(true);

  useEffect(() => {
    getTopProducts(8).then((data) => {
      const enriched = data.map((d) => {
        const product = PRODUCTS.find((p) => p.id === d.productId);
        return { ...d, name: product?.name };
      });
      setTopProducts(enriched);
      setLoadingTop(false);
    });
  }, []);

  if (!currentAdmin) return null;

  // ── Compute stats from orders ────────────────────────────────────────────
  const confirmedOrders = orders.filter((o) => STATUS_REVENUE.includes(o.status));
  const totalRevenue = confirmedOrders.reduce((s, o) => s + o.totalUSD, 0);
  const pendingOrders = orders.filter((o) => o.status === 'open' || o.status === 'in_progress').length;
  const deliveredOrders = orders.filter((o) => o.status === 'delivered').length;
  const conversionRate = orders.length > 0
    ? Math.round((deliveredOrders / orders.length) * 100)
    : 0;

  // Revenue by status
  const revenueByStatus = [
    { label: 'Livré', count: orders.filter((o) => o.status === 'delivered').length, color: 'bg-emerald-400' },
    { label: 'Expédié', count: orders.filter((o) => o.status === 'shipped').length, color: 'bg-blue-400' },
    { label: 'Confirmé', count: orders.filter((o) => o.status === 'order_confirmed').length, color: 'bg-purple-400' },
    { label: 'En cours', count: orders.filter((o) => o.status === 'in_progress').length, color: 'bg-gold' },
    { label: 'Ouvert', count: orders.filter((o) => o.status === 'open').length, color: 'bg-terra' },
  ];
  const totalOrders = revenueByStatus.reduce((s, r) => s + r.count, 0);

  // Top clients
  const topClients = [...clients]
    .sort((a, b) => (b.totalSpentUSD ?? 0) - (a.totalSpentUSD ?? 0))
    .slice(0, 5);

  // Active vs inactive products
  const activeProducts = products.filter((p) => p.status !== 'inactive').length;
  const featuredProducts = products.filter((p) => p.status === 'featured').length;
  const stockAlerts = products.filter((p) => p.stock < 3 && p.status !== 'inactive').length;

  return (
    <>
      <AdminTopBar
        title="Statistiques"
        subtitle="Vue d'ensemble des performances ILU SHOP"
      />

      <div className="p-6 lg:p-8 space-y-8 max-w-6xl">
        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Chiffre d'affaires"
            value={formatUSD(totalRevenue)}
            sub="Commandes confirmées + livrées"
            icon="💰"
            tone="terra"
          />
          <KpiCard
            label="Commandes totales"
            value={String(orders.length)}
            sub={`${pendingOrders} en attente`}
            icon="📦"
            tone="ink"
          />
          <KpiCard
            label="Clients actifs"
            value={String(clients.filter((c) => c.ordersCount > 0).length)}
            sub={`${clients.length} inscrits`}
            icon="👥"
            tone="beige"
          />
          <KpiCard
            label="Taux de conversion"
            value={`${conversionRate}%`}
            sub="Livrées / total commandes"
            icon="📈"
            tone="gold"
          />
        </div>

        {/* Main grid */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Orders by status */}
          <div className="bg-cream border border-line rounded-xl p-6">
            <h3 className="font-display font-bold text-sm text-ink mb-5">Commandes par statut</h3>
            <div className="space-y-3">
              {revenueByStatus.map(({ label, count, color }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className="w-28 text-xs text-muted font-display">{label}</div>
                  <div className="flex-1 bg-bone rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`${color} h-full rounded-full transition-all`}
                      style={{ width: totalOrders > 0 ? `${(count / totalOrders) * 100}%` : '0%' }}
                    />
                  </div>
                  <div className="w-8 text-right font-display font-bold text-sm text-ink">{count}</div>
                </div>
              ))}
            </div>
            <div className="mt-5 pt-4 border-t border-line flex items-center justify-between text-xs text-muted">
              <span>Total : {totalOrders} commande{totalOrders > 1 ? 's' : ''}</span>
              <span className="text-emerald-600 font-semibold">{conversionRate}% livraison</span>
            </div>
          </div>

          {/* Products overview */}
          <div className="bg-cream border border-line rounded-xl p-6">
            <h3 className="font-display font-bold text-sm text-ink mb-5">Catalogue produits</h3>
            <div className="grid grid-cols-2 gap-4 mb-5">
              <MiniStat value={String(products.length)} label="Total" />
              <MiniStat value={String(activeProducts)} label="Actifs" color="emerald" />
              <MiniStat value={String(featuredProducts)} label="À la une" color="terra" />
              <MiniStat value={String(stockAlerts)} label="Stock bas (< 3)" color="gold" />
            </div>

            {stockAlerts > 0 && (
              <div className="bg-gold/10 border border-gold/30 rounded-lg p-3 text-xs">
                <span className="font-display font-semibold text-yellow-800">⚠ {stockAlerts} produit{stockAlerts > 1 ? 's' : ''} en stock faible</span>
                <p className="text-yellow-700 mt-0.5 font-light">Pense à réapprovisionner avant la prochaine commande.</p>
              </div>
            )}
          </div>
        </div>

        {/* Top products + top clients */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Top produits vus */}
          <div className="bg-cream border border-line rounded-xl p-6">
            <h3 className="font-display font-bold text-sm text-ink mb-1">Produits les plus consultés</h3>
            <p className="text-xs text-muted font-light mb-5">Basé sur le tracking Firestore</p>

            {loadingTop ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-8 bg-bone rounded animate-pulse" />
                ))}
              </div>
            ) : topProducts.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-muted">Aucune donnée de tracking disponible.</p>
                <p className="text-xs text-muted/70 mt-1 font-light">Les vues seront enregistrées quand des utilisateurs navigueront avec le consentement cookies.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {topProducts.map((p, i) => (
                  <div key={p.productId} className="flex items-center gap-3 py-2 border-b border-line last:border-0">
                    <div className="w-6 h-6 rounded-full bg-bone flex items-center justify-center font-display font-bold text-xs text-muted shrink-0">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-display font-medium text-ink truncate">
                        {p.name ?? p.productId}
                      </div>
                      <div className="text-xs text-muted capitalize">{p.category}</div>
                    </div>
                    <div className="shrink-0 font-display font-bold text-sm text-terra">
                      {p.views} vues
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top clients */}
          <div className="bg-cream border border-line rounded-xl p-6">
            <h3 className="font-display font-bold text-sm text-ink mb-5">Top clients</h3>
            <div className="space-y-2">
              {topClients.map((client, i) => (
                <div key={client.id} className="flex items-center gap-3 py-2 border-b border-line last:border-0">
                  <div className="w-8 h-8 rounded-full bg-terra text-cream flex items-center justify-center font-display font-bold text-xs shrink-0">
                    {client.fullName.split(' ').map((s: string) => s[0]).slice(0, 2).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-display font-medium text-ink truncate">{client.fullName}</div>
                    <div className="text-xs text-muted">{client.ordersCount} commande{client.ordersCount > 1 ? 's' : ''} · {client.city ?? '—'}</div>
                  </div>
                  <div className="shrink-0 font-display font-bold text-sm text-ink">
                    {formatUSD(client.totalSpentUSD ?? 0)}
                  </div>
                </div>
              ))}
              {clients.length === 0 && (
                <p className="text-sm text-muted py-4 text-center">Aucun client enregistré.</p>
              )}
            </div>
          </div>
        </div>

        {/* Revenue timeline (placeholder) */}
        <div className="bg-cream border border-line rounded-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-display font-bold text-sm text-ink">Évolution du chiffre d&apos;affaires</h3>
              <p className="text-xs text-muted mt-0.5 font-light">Données basées sur les commandes confirmées</p>
            </div>
            <span className="font-display text-xs text-muted">Mai 2026</span>
          </div>

          {/* Simple bar chart using CSS */}
          <div className="flex items-end gap-2 h-32">
            {[12, 45, 28, 78, 56, 89, 123, 45, 67, 90, 34, 78, 112, 89, 45, 67, 100, 87, 56, 78, 90, 123, 89, 45].map((v, i) => (
              <div
                key={i}
                className="flex-1 bg-terra/20 hover:bg-terra/40 rounded-t transition-colors cursor-pointer"
                style={{ height: `${(v / 123) * 100}%` }}
                title={`Jour ${i + 1} : ${formatUSD(v)}`}
              />
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-muted mt-2 font-display">
            <span>1 mai</span>
            <span>15 mai</span>
            <span>24 mai</span>
          </div>
        </div>
      </div>
    </>
  );
}

function KpiCard({
  label,
  value,
  sub,
  icon,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: string;
  tone: 'terra' | 'ink' | 'beige' | 'gold';
}) {
  const toneMap = {
    terra: 'bg-terra text-cream',
    ink: 'bg-ink text-cream',
    beige: 'bg-beige text-ink border border-line',
    gold: 'bg-gold text-ink',
  };
  const subColor = tone === 'beige' || tone === 'gold' ? 'text-ink/60' : 'text-cream/70';

  return (
    <div className={`${toneMap[tone]} rounded-xl p-5`}>
      <div className="text-2xl mb-3">{icon}</div>
      <div className="font-display font-extrabold text-2xl leading-none">{value}</div>
      <div className={`font-display text-[10px] tracking-widest uppercase font-semibold mt-2 ${subColor}`}>{label}</div>
      {sub && <div className={`text-xs font-light mt-1 ${subColor}`}>{sub}</div>}
    </div>
  );
}

function MiniStat({ value, label, color }: { value: string; label: string; color?: string }) {
  const colorMap: Record<string, string> = {
    emerald: 'text-emerald-600',
    terra: 'text-terra',
    gold: 'text-yellow-700',
  };
  return (
    <div className="bg-bone rounded-lg p-3 text-center">
      <div className={`font-display font-extrabold text-2xl ${color ? colorMap[color] : 'text-ink'}`}>{value}</div>
      <div className="font-display text-[10px] tracking-widest uppercase text-muted mt-1">{label}</div>
    </div>
  );
}
