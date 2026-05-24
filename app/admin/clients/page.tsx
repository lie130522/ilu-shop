'use client';

import { useState, useMemo } from 'react';
import { useAdmin } from '@/components/admin/AdminProvider';
import { AdminTopBar } from '@/components/admin/AdminTopBar';
import { formatUSD } from '@/lib/currency';

export default function AdminClientsPage() {
  const { clients, currentAdmin } = useAdmin();
  const [search, setSearch] = useState('');

  if (!currentAdmin) return null;

  const filtered = useMemo(
    () =>
      clients.filter(
        (c) =>
          c.fullName.toLowerCase().includes(search.toLowerCase()) ||
          c.email.toLowerCase().includes(search.toLowerCase()) ||
          c.city.toLowerCase().includes(search.toLowerCase()),
      ),
    [clients, search],
  );

  const totalRevenue = clients.reduce((s, c) => s + c.totalSpentUSD, 0);
  const active = clients.filter((c) => c.ordersCount > 0).length;

  return (
    <>
      <AdminTopBar
        title="Clients"
        subtitle={`${clients.length} comptes • ${active} ont déjà commandé`}
      />

      <div className="p-8 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label="Total clients" value={String(clients.length)} />
          <Stat label="Acheteurs" value={String(active)} sub={`${Math.round((active / clients.length) * 100)}% de conversion`} />
          <Stat label="CA cumulé" value={formatUSD(totalRevenue)} tone="terra" />
          <Stat
            label="Panier moyen"
            value={formatUSD(active > 0 ? totalRevenue / active : 0)}
          />
        </div>

        <div className="bg-cream border border-line rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-line flex items-center justify-between">
            <input
              type="text"
              placeholder="Rechercher par nom, email, ville…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-bone border border-line rounded-full px-4 py-1.5 text-sm outline-none focus:border-terra w-80"
            />
            <span className="font-display text-[10px] tracking-widest uppercase text-muted">
              {filtered.length} résultat{filtered.length > 1 ? 's' : ''}
            </span>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-ink text-cream/80 text-left">
                <th className="px-5 py-3 font-display text-[10px] tracking-widest uppercase font-semibold">Client</th>
                <th className="px-5 py-3 font-display text-[10px] tracking-widest uppercase font-semibold">Ville</th>
                <th className="px-5 py-3 font-display text-[10px] tracking-widest uppercase font-semibold">Inscrit le</th>
                <th className="px-5 py-3 font-display text-[10px] tracking-widest uppercase font-semibold text-right">Commandes</th>
                <th className="px-5 py-3 font-display text-[10px] tracking-widest uppercase font-semibold text-right">Total dépensé</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-bone transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-terra/15 text-terra-dark flex items-center justify-center font-display font-bold text-xs">
                        {c.fullName.split(' ').map((s) => s[0]).slice(0, 2).join('')}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-sm text-ink truncate">{c.fullName}</div>
                        <div className="text-[11px] text-muted truncate">{c.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm">{c.city}</td>
                  <td className="px-5 py-3 text-sm text-muted">
                    {new Date(c.createdAt).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: 'short',
                      year: '2-digit',
                    })}
                  </td>
                  <td className="px-5 py-3 text-right font-display font-bold text-sm">
                    {c.ordersCount}
                  </td>
                  <td className="px-5 py-3 text-right font-display font-bold text-sm text-terra">
                    {formatUSD(c.totalSpentUSD)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-12 text-center text-muted text-sm">Aucun client trouvé.</div>
          )}
        </div>
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'terra';
}) {
  return (
    <div className={`rounded-lg p-5 ${tone === 'terra' ? 'bg-terra text-cream' : 'bg-cream border border-line'}`}>
      <div
        className={`font-display text-[10px] tracking-[0.3em] uppercase font-semibold ${
          tone === 'terra' ? 'text-cream/70' : 'text-muted'
        }`}
      >
        {label}
      </div>
      <div className="mt-2 font-display font-extrabold text-2xl leading-none">{value}</div>
      {sub && (
        <div
          className={`mt-2 text-xs font-light ${tone === 'terra' ? 'text-cream/70' : 'text-muted'}`}
        >
          {sub}
        </div>
      )}
    </div>
  );
}
