'use client';

import { useState } from 'react';
import { useAdmin } from '@/components/admin/AdminProvider';
import { AdminTopBar } from '@/components/admin/AdminTopBar';
import { PermissionGuard } from '@/components/admin/PermissionGuard';
import { formatCDF } from '@/lib/currency';

export default function AdminRatePage() {
  const { exchangeRate, rateUpdatedAt, rateUpdatedBy, updateExchangeRate, currentAdmin } =
    useAdmin();
  const [newRate, setNewRate] = useState(String(exchangeRate));
  const [confirm, setConfirm] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!currentAdmin) return null;

  const canEdit =
    currentAdmin.role === 'admin_principal' ||
    currentAdmin.permissions.includes('exchange_rate');
  const rate = Number(newRate);
  const isValid = !isNaN(rate) && rate >= 500 && rate <= 10000;
  const hasChanged = rate !== exchangeRate;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || !hasChanged) return;
    if (!confirm) {
      setConfirm(true);
      return;
    }
    updateExchangeRate(rate);
    setConfirm(false);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  return (
    <PermissionGuard permission="exchange_rate">
      <>
      <AdminTopBar
        title="Taux de change USD → CDF"
        subtitle="Modifier le taux affiché sur toute la boutique"
      />

      <div className="p-8 max-w-3xl space-y-6">
        {/* Current */}
        <div className="bg-ink text-cream rounded-lg p-8">
          <div className="font-display text-[10px] tracking-[0.3em] uppercase text-cream/60 font-semibold">
            Taux actuel
          </div>
          <div className="mt-4 flex items-baseline gap-3">
            <span className="font-display font-extrabold text-6xl text-cream leading-none">
              {exchangeRate.toLocaleString('fr-FR')}
            </span>
            <span className="font-display text-xl text-gold font-semibold">FC / 1 USD</span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-4 text-xs">
            <Equiv usd={1} rate={exchangeRate} />
            <Equiv usd={10} rate={exchangeRate} />
            <Equiv usd={100} rate={exchangeRate} />
          </div>
          <div className="mt-6 pt-6 border-t border-cream/10 text-[11px] text-cream/50 font-light">
            Dernière mise à jour le{' '}
            {new Date(rateUpdatedAt).toLocaleDateString('fr-FR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}{' '}
            • par {rateUpdatedBy}
          </div>
        </div>

        {/* Update form */}
        {canEdit ? (
          <form onSubmit={handleSubmit} className="bg-cream border border-line rounded-lg p-6">
            <h3 className="font-display font-bold text-base">Mettre à jour</h3>
            <p className="text-xs text-muted mt-1">
              Modifiez le taux en cas d'évolution significative du marché. La modification est{' '}
              <strong>immédiate</strong> sur tous les prix affichés au client.
            </p>

            <div className="mt-5 flex items-end gap-4">
              <div className="flex-1">
                <label className="font-display text-[10px] tracking-widest uppercase font-semibold block mb-2">
                  Nouveau taux (FC pour 1 USD)
                </label>
                <input
                  type="number"
                  min={500}
                  max={10000}
                  step={1}
                  value={newRate}
                  onChange={(e) => {
                    setNewRate(e.target.value);
                    setConfirm(false);
                  }}
                  className="w-full bg-bone border border-line rounded-md px-4 py-3 text-2xl font-display font-bold text-ink outline-none focus:border-terra"
                />
                <div className="mt-1 text-[11px] text-muted">Entre 500 et 10 000 FC</div>
              </div>
              <button
                type="submit"
                disabled={!isValid || !hasChanged}
                className="h-12 px-6 rounded-full bg-terra hover:bg-terra-dark text-cream font-display text-xs font-semibold tracking-widest uppercase transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {confirm ? 'Confirmer ?' : 'Mettre à jour'}
              </button>
            </div>

            {hasChanged && isValid && (
              <div className="mt-5 bg-bone rounded-md p-4">
                <div className="font-display text-[10px] tracking-widest uppercase font-semibold text-muted">
                  Aperçu après modification
                </div>
                <div className="mt-2 grid grid-cols-3 gap-3 text-sm">
                  <Preview usd={1} rate={rate} />
                  <Preview usd={10} rate={rate} />
                  <Preview usd={100} rate={rate} />
                </div>
                <div className="mt-3 text-[11px] text-terra-dark">
                  Δ {((rate / exchangeRate - 1) * 100).toFixed(2)}% par rapport au taux actuel
                </div>
              </div>
            )}

            {success && (
              <div className="mt-5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-md px-4 py-3 text-sm">
                ✓ Taux mis à jour avec succès. Tous les prix sont recalculés en temps réel.
              </div>
            )}
          </form>
        ) : (
          <div className="bg-terra/10 border border-terra/30 rounded-lg p-6 text-center text-terra-dark text-sm">
            Vous n'avez pas la permission de modifier le taux de change.
          </div>
        )}
      </div>
      </>
    </PermissionGuard>
  );
}

function Equiv({ usd, rate }: { usd: number; rate: number }) {
  return (
    <div>
      <div className="text-cream/40">{usd} USD =</div>
      <div className="font-display font-bold text-cream mt-1">{formatCDF(usd * rate)}</div>
    </div>
  );
}

function Preview({ usd, rate }: { usd: number; rate: number }) {
  return (
    <div>
      <div className="text-[10px] text-muted">{usd} USD</div>
      <div className="font-display font-bold text-terra">{formatCDF(usd * rate)}</div>
    </div>
  );
}
