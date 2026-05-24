'use client';

import { useState, useEffect } from 'react';
import { AdminTopBar } from '@/components/admin/AdminTopBar';
import { useAdmin } from '@/components/admin/AdminProvider';
import { getShopSettings, saveShopSettings, DEFAULT_SETTINGS } from '@/lib/firebase/settings';
import type { ShopSettings } from '@/lib/firebase/settings';

export default function ParametresPage() {
  const { currentAdmin } = useAdmin();
  const [settings, setSettings] = useState<ShopSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getShopSettings().then((s) => { setSettings(s); setLoading(false); });
  }, []);

  if (!currentAdmin) return null;

  const update = (path: string, value: string | number | boolean) => {
    setSettings((prev) => {
      const next = JSON.parse(JSON.stringify(prev)) as ShopSettings;
      const keys = path.split('.');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let cursor: any = next;
      for (let i = 0; i < keys.length - 1; i++) cursor = cursor[keys[i]];
      cursor[keys[keys.length - 1]] = value;
      return next;
    });
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveShopSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      alert('Erreur lors de la sauvegarde : ' + (e instanceof Error ? e.message : 'inconnue'));
    } finally {
      setSaving(false);
    }
  };

  const MM_METHODS = [
    { key: 'mpesa',  label: 'M-Pesa', color: 'bg-red-100 text-red-700',   icon: '📱' },
    { key: 'airtel', label: 'Airtel Money', color: 'bg-blue-100 text-blue-700', icon: '📲' },
    { key: 'orange', label: 'Orange Money', color: 'bg-orange-100 text-orange-700', icon: '🟠' },
  ] as const;

  return (
    <>
      <AdminTopBar
        title="Paramètres"
        subtitle="Configuration de la boutique ILU SHOP"
      />

      <div className="p-6 lg:p-8 space-y-8 max-w-3xl">

        {loading ? (
          <div className="space-y-4">
            {[1,2,3].map(i => <div key={i} className="h-24 bg-bone rounded-xl animate-pulse" />)}
          </div>
        ) : (
          <>
            {/* Mobile Money */}
            <div className="bg-cream border border-line rounded-xl p-6">
              <h2 className="font-display font-bold text-sm text-ink mb-1">Numéros Mobile Money</h2>
              <p className="text-xs text-muted font-light mb-6">
                Ces informations s&apos;affichent au client lors du paiement et dans le chat automatique.
              </p>

              <div className="space-y-5">
                {MM_METHODS.map(({ key, label, color, icon }) => {
                  const cfg = settings[key];
                  return (
                    <div key={key} className="border border-line rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{icon}</span>
                          <span className="font-display font-semibold text-sm text-ink">{label}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${color}`}>
                            {cfg.active ? 'Actif' : 'Inactif'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => update(`${key}.active`, !cfg.active)}
                          className={`relative w-10 h-5 rounded-full transition-colors ${cfg.active ? 'bg-terra' : 'bg-bone border border-line'}`}
                        >
                          <span className={`absolute top-0.5 w-4 h-4 bg-cream rounded-full shadow transition-all ${cfg.active ? 'left-5' : 'left-0.5'}`} />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="font-display text-[10px] tracking-widest uppercase text-muted block mb-1">
                            Numéro de téléphone
                          </label>
                          <input
                            type="tel"
                            value={cfg.number}
                            onChange={(e) => update(`${key}.number`, e.target.value)}
                            placeholder="+243 81 XXX XXXX"
                            className="w-full bg-bone border border-line rounded-md px-3 py-2 text-sm font-mono outline-none focus:border-terra transition-colors"
                          />
                        </div>
                        <div>
                          <label className="font-display text-[10px] tracking-widest uppercase text-muted block mb-1">
                            Nom du compte
                          </label>
                          <input
                            type="text"
                            value={cfg.accountName}
                            onChange={(e) => update(`${key}.accountName`, e.target.value)}
                            placeholder="ILU SHOP"
                            className="w-full bg-bone border border-line rounded-md px-3 py-2 text-sm outline-none focus:border-terra transition-colors"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Frais de retrait */}
            <div className="bg-cream border border-line rounded-xl p-6">
              <h2 className="font-display font-bold text-sm text-ink mb-1">Frais de retrait Mobile Money</h2>
              <p className="text-xs text-muted font-light mb-4">
                Montant en CDF ajouté automatiquement au total quand le client choisit Mobile Money.
              </p>
              <div className="flex items-center gap-4">
                <div className="flex-1 max-w-xs">
                  <input
                    type="number"
                    min={0}
                    step={500}
                    value={settings.withdrawalFeeCDF}
                    onChange={(e) => update('withdrawalFeeCDF', Number(e.target.value))}
                    className="w-full bg-bone border border-line rounded-md px-3 py-2.5 text-sm font-mono outline-none focus:border-terra transition-colors"
                  />
                </div>
                <span className="font-display text-sm text-muted">CDF</span>
                <div className="text-xs text-muted font-light bg-gold/10 border border-gold/30 rounded-lg px-3 py-2">
                  Fourchette recommandée : 2 000 – 4 000 CDF
                </div>
              </div>
            </div>

            {/* Message livraison */}
            <div className="bg-cream border border-line rounded-xl p-6">
              <h2 className="font-display font-bold text-sm text-ink mb-1">Message automatique — Confirmation livraison</h2>
              <p className="text-xs text-muted font-light mb-4">
                Envoyé automatiquement dans le chat quand le mode de paiement est &quot;Cash à la livraison&quot;.
              </p>
              <textarea
                value={settings.deliveryNote}
                onChange={(e) => update('deliveryNote', e.target.value)}
                rows={3}
                className="w-full bg-bone border border-line rounded-md px-3 py-2.5 text-sm outline-none focus:border-terra transition-colors resize-none leading-relaxed"
              />
            </div>

            {/* Save */}
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="h-11 px-8 rounded-full bg-ink hover:bg-terra text-cream font-display text-xs font-semibold tracking-widest uppercase transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-cream/40 border-t-cream rounded-full animate-spin" />
                    Sauvegarde…
                  </>
                ) : '💾 Sauvegarder'}
              </button>
              {saved && (
                <span className="text-emerald-600 font-display text-xs font-semibold tracking-widest uppercase animate-fadeUp">
                  ✓ Paramètres sauvegardés
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
