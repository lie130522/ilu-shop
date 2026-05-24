'use client';

import { useAdmin } from '@/components/admin/AdminProvider';
import { AdminTopBar } from '@/components/admin/AdminTopBar';
import { formatUSD } from '@/lib/currency';

export default function AdminEditorialPage() {
  const { products, toggleFeatured, currentAdmin } = useAdmin();
  if (!currentAdmin) return null;

  const featured = products.filter((p) => p.status === 'featured');
  const candidates = products.filter((p) => p.status === 'active' && p.stock > 0);

  return (
    <>
      <AdminTopBar
        title="Section Éditoriale — À la une"
        subtitle={`${featured.length} produit${featured.length > 1 ? 's' : ''} mis en avant sur la page d'accueil`}
      />

      <div className="p-8 space-y-8">
        {/* Rule reminder */}
        <div className="bg-cream border border-line border-l-4 border-l-terra rounded-md p-5">
          <div className="font-display text-[10px] tracking-widest uppercase font-semibold text-terra">
            ★ Règle « À la une »
          </div>
          <p className="mt-2 text-sm text-ink-light font-light">
            Pour être mis à la une, un produit doit être <strong>actif</strong>, en{' '}
            <strong>stock {'>'} 0</strong>, et idéalement avoir une image sans fond (pipeline IA en
            phase 3).
          </p>
        </div>

        {/* Featured products */}
        <section>
          <h3 className="font-display font-bold text-lg mb-4">Actuellement à la une</h3>
          {featured.length === 0 ? (
            <div className="bg-cream border border-dashed border-line rounded-lg p-12 text-center">
              <div className="text-5xl text-beige">∅</div>
              <p className="mt-4 text-sm text-muted">
                Aucun produit n'est mis à la une. Sélectionnez-en ci-dessous.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {featured.map((p) => (
                <div
                  key={p.id}
                  className="bg-cream border-2 border-terra rounded-lg overflow-hidden group"
                >
                  <div className="relative aspect-square bg-bone">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-3/4 aspect-square rounded-full bg-beige/60 blur-xl" />
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.images[0]}
                      alt={p.name}
                      className="relative z-10 w-full h-full object-cover"
                    />
                    <span className="absolute top-2 left-2 bg-terra text-cream text-[9px] font-display font-bold tracking-widest uppercase px-2 py-0.5 rounded">
                      À la une
                    </span>
                  </div>
                  <div className="p-3">
                    <div className="font-display font-bold text-sm text-ink truncate">{p.name}</div>
                    <div className="text-[11px] text-muted">{formatUSD(p.priceUSD)} • Stock {p.stock}</div>
                    <button
                      type="button"
                      onClick={() => toggleFeatured(p.id)}
                      className="mt-3 w-full font-display text-[10px] tracking-widest uppercase font-semibold bg-terra/15 hover:bg-terra hover:text-cream text-terra-dark py-2 rounded-full transition-colors"
                    >
                      Retirer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Available candidates */}
        <section>
          <h3 className="font-display font-bold text-lg mb-4">Produits éligibles</h3>
          <p className="text-sm text-muted mb-4">
            Actifs + stock {'>'} 0 — cliquez pour mettre à la une.
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {candidates
              .filter((p) => p.status !== 'featured')
              .map((p) => (
                <div
                  key={p.id}
                  className="bg-cream border border-line rounded-lg overflow-hidden hover:border-terra hover:shadow-sm transition-all"
                >
                  <div className="relative aspect-square bg-bone">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.images[0]}
                      alt={p.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-3">
                    <div className="font-display font-bold text-sm text-ink truncate">{p.name}</div>
                    <div className="text-[11px] text-muted">{formatUSD(p.priceUSD)} • Stock {p.stock}</div>
                    <button
                      type="button"
                      onClick={() => toggleFeatured(p.id)}
                      className="mt-3 w-full font-display text-[10px] tracking-widest uppercase font-semibold bg-bone hover:bg-terra hover:text-cream text-ink py-2 rounded-full transition-colors"
                    >
                      ★ Mettre à la une
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </section>
      </div>
    </>
  );
}
