'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAdmin } from '@/components/admin/AdminProvider';
import { AdminTopBar } from '@/components/admin/AdminTopBar';
import { hasPermission, PermissionDenied } from '@/components/admin/PermissionGuard';
import { subscribeAllOutfits, deleteOutfitFromFirestore } from '@/lib/firebase/outfits';
import { formatUSD } from '@/lib/currency';
import type { Outfit, OutfitCategory } from '@/lib/showroom/types';
import { OUTFIT_CATEGORY_LABEL } from '@/lib/showroom/types';
import { OutfitImportModal } from './_components/OutfitImportModal';

const FILTER_CATS: { val: OutfitCategory | 'all'; label: string }[] = [
  { val: 'all', label: 'Tous' },
  { val: 'casual', label: 'Casual' },
  { val: 'business', label: 'Business' },
  { val: 'soiree', label: 'Soirée' },
  { val: 'streetwear', label: 'Streetwear' },
  { val: 'tech', label: 'Tech' },
];

export default function AdminShowroomPage() {
  const { currentAdmin } = useAdmin();
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [filter, setFilter] = useState<OutfitCategory | 'all'>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);

  useEffect(() => {
    return subscribeAllOutfits(setOutfits);
  }, []);

  if (!currentAdmin) return null;
  if (!hasPermission(currentAdmin, 'showroom')) return <PermissionDenied permission="showroom" />;

  const filtered = filter === 'all' ? outfits : outfits.filter((o) => o.cat === filter);

  const handleDelete = async (id: string) => {
    await deleteOutfitFromFirestore(id);
    setConfirmDeleteId(null);
  };

  return (
    <>
      <AdminTopBar
        title="Showroom"
        subtitle={`${outfits.length} outfit${outfits.length > 1 ? 's' : ''} • ${outfits.filter((o) => o.status === 'published').length} publiés`}
      />

      <div className="p-8">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex items-center gap-1 bg-cream border border-line rounded-full p-1">
            {FILTER_CATS.map(({ val, label }) => (
              <button
                key={val}
                type="button"
                onClick={() => setFilter(val)}
                className={`font-display text-[11px] tracking-widest uppercase font-semibold px-3 py-1.5 rounded-full transition-colors ${
                  filter === val ? 'bg-ink text-cream' : 'text-muted hover:text-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="font-display text-[11px] tracking-widest uppercase font-semibold border border-line hover:border-ink text-ink px-5 py-2 rounded-full transition-colors flex items-center gap-2"
          >
            ✨ Import photo
          </button>
          <Link
            href="/admin/showroom/nouveau"
            className="font-display text-[11px] tracking-widest uppercase font-semibold bg-terra hover:bg-terra-dark text-cream px-5 py-2 rounded-full transition-colors"
          >
            + Nouvel outfit
          </Link>
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-muted text-sm bg-cream border border-dashed border-line rounded-xl">
            <div className="text-4xl mb-3">👗</div>
            <p>Aucun outfit trouvé. Créez votre premier look !</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((outfit) => {
              const total = outfit.items.reduce((s, it) => s + it.priceUSD, 0);
              const isDeleting = confirmDeleteId === outfit.id;

              return (
                <div
                  key={outfit.id}
                  className={`bg-cream border rounded-xl overflow-hidden transition-all ${
                    isDeleting ? 'border-terra bg-terra/5' : 'border-line hover:border-terra/40'
                  }`}
                >
                  {/* Photo */}
                  <div className="relative aspect-[3/4] bg-bone">
                    {outfit.photos[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={outfit.photos[0]}
                        alt={outfit.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-6xl opacity-20">
                        👗
                      </div>
                    )}

                    {/* Statut */}
                    <span className={`absolute top-2 right-2 text-[9px] font-display font-bold tracking-widest uppercase px-2 py-0.5 rounded ${
                      outfit.status === 'published'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-ink/70 text-cream'
                    }`}>
                      {outfit.status === 'published' ? 'Publié' : 'Brouillon'}
                    </span>

                    {/* Badge */}
                    {outfit.badge && (
                      <span className={`absolute top-2 left-2 text-[9px] font-display font-bold tracking-widest uppercase px-2 py-0.5 rounded ${
                        outfit.badgeType === 'promo' ? 'bg-terra text-cream' : 'bg-ink text-cream'
                      }`}>
                        {outfit.badge}
                      </span>
                    )}

                    {/* Nombre de dots */}
                    {outfit.dots.length > 0 && (
                      <span className="absolute bottom-2 left-2 bg-cream/90 text-ink text-[9px] font-display font-bold px-2 py-0.5 rounded">
                        🎯 {outfit.dots.length} point{outfit.dots.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {/* Infos */}
                  <div className="p-4">
                    <div className="font-display font-bold text-sm text-ink truncate">{outfit.name}</div>
                    <div className="text-[11px] text-muted mb-2">
                      {outfit.season} · {OUTFIT_CATEGORY_LABEL[outfit.cat]}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-display font-bold text-sm text-terra">{formatUSD(total)}</span>
                      <span className="text-[11px] text-muted">{outfit.items.length} articles</span>
                    </div>

                    {/* Actions */}
                    {!isDeleting ? (
                      <div className="flex gap-2 mt-3">
                        <Link
                          href={`/admin/showroom/${outfit.id}/modifier`}
                          className="flex-1 py-2 bg-bone hover:bg-beige rounded-lg text-[10px] font-display font-semibold tracking-widest uppercase text-center transition-colors"
                        >
                          Modifier
                        </Link>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(outfit.id)}
                          className="py-2 px-3 rounded-lg text-[10px] font-display font-semibold tracking-widest uppercase text-terra hover:bg-terra/10 transition-colors"
                        >
                          Supprimer
                        </button>
                      </div>
                    ) : (
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleDelete(outfit.id)}
                          className="flex-1 py-2 bg-terra text-cream rounded-lg text-[10px] font-display font-bold tracking-widest uppercase hover:bg-terra-dark transition-colors"
                        >
                          Confirmer
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="flex-1 py-2 border border-line rounded-lg text-[10px] font-display font-semibold tracking-widest uppercase hover:bg-bone transition-colors"
                        >
                          Annuler
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showImportModal && (
        <OutfitImportModal onClose={() => setShowImportModal(false)} />
      )}
    </>
  );
}
