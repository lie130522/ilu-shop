'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { subscribeFirestoreProducts } from '@/lib/firebase/products';
import { getAdminProducts } from '@/lib/admin/product-store';
import type { Product } from '@/lib/types';
import type { OutfitItem } from '@/lib/showroom/types';

interface OutfitContextForCreation {
  itemId: string;
  itemName: string;
  itemCategory: string;
  itemPriceUSD: number;
  outfitPhoto: string | null;
  outfitState: unknown;
}

interface ItemLinkModalProps {
  item: OutfitItem;
  onLink: (productId: string, productSlug: string, imageUrl: string) => void;
  onUnlink: () => void;
  onClose: () => void;
  /** Contexte outfit pour créer le produit et revenir automatiquement */
  outfitContext?: OutfitContextForCreation;
}

export function ItemLinkModal({ item, onLink, onUnlink, onClose, outfitContext }: ItemLinkModalProps) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [firestoreProducts, setFirestoreProducts] = useState<Product[]>([]);

  useEffect(() => {
    return subscribeFirestoreProducts(setFirestoreProducts);
  }, []);

  const localProducts = typeof window !== 'undefined' ? getAdminProducts() : [];
  const localIds = new Set(localProducts.map((p) => p.id));

  const all: {
    id: string; name: string; priceUSD: number;
    subcategory: string; images: string[]; slug: string;
  }[] = [
    ...localProducts.map((p) => ({
      id: p.id, name: p.name, priceUSD: p.priceUSD,
      subcategory: p.subcategory,
      images: p.images.map((img) => img.processedDataUrl || img.originalDataUrl),
      slug: p.slug,
    })),
    ...firestoreProducts
      .filter((p) => !localIds.has(p.id))
      .map((p) => ({
        id: p.id, name: p.name, priceUSD: p.priceUSD,
        subcategory: p.subcategory ?? '',
        images: p.images, slug: p.slug,
      })),
  ];

  const filtered = all.filter((p) =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()),
  );

  const handleSelect = (p: typeof all[0]) => {
    onLink(p.id, p.slug, p.images[0] ?? '');
    onClose();
  };

  const saveContextAndNavigate = (mode: 'manual' | 'gemini') => {
    if (outfitContext) {
      sessionStorage.setItem('ilu_outfit_context', JSON.stringify(outfitContext));
    }
    router.push(`/admin/produits/nouveau?from=outfit&mode=${mode}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
      />

      <div className="relative bg-cream rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-line">
          <div>
            <h3 className="font-display font-bold text-base">Lier au catalogue</h3>
            <p className="text-xs text-muted mt-0.5">
              Article :{' '}
              <strong className="text-ink">{item.name || 'Sans nom'}</strong>
              {item.productId && (
                <span className="ml-2 text-emerald-600 font-semibold">· Actuellement lié</span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-line flex items-center justify-center text-muted hover:bg-bone transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Bannière lien actuel */}
        {item.productId && (
          <div className="px-5 py-3 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between">
            <p className="text-xs text-emerald-700 font-semibold">
              Cet article est lié à un produit du catalogue.
            </p>
            <button
              type="button"
              onClick={() => { onUnlink(); onClose(); }}
              className="text-[10px] font-display font-bold tracking-widest uppercase text-terra hover:underline ml-4 shrink-0"
            >
              Délier
            </button>
          </div>
        )}

        {/* Recherche */}
        <div className="p-4 border-b border-line">
          <input
            type="text"
            placeholder="Rechercher dans le catalogue…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            className="w-full bg-bone border border-line rounded-full px-4 py-2 text-sm outline-none focus:border-terra"
          />
        </div>

        {/* Liste */}
        <div className="overflow-y-auto flex-1 p-2">
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-muted text-sm">
              {all.length === 0
                ? 'Aucun produit dans le catalogue.'
                : 'Aucun résultat pour cette recherche.'}
            </div>
          ) : (
            filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelect(p)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl hover:bg-bone transition-colors text-left ${
                  p.id === item.productId ? 'bg-emerald-50 border border-emerald-200' : ''
                }`}
              >
                <div className="w-12 h-12 rounded-lg bg-beige overflow-hidden shrink-0 border border-line">
                  {p.images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.images[0]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xl">📦</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display font-semibold text-sm text-ink truncate">{p.name}</div>
                  <div className="text-[11px] text-muted">{p.subcategory}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {p.id === item.productId && (
                    <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-display font-bold tracking-widest uppercase">
                      Actuel
                    </span>
                  )}
                  <span className="font-display font-bold text-sm text-terra">${p.priceUSD}</span>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer — créer dans le catalogue */}
        <div className="p-4 border-t border-line space-y-2">
          <p className="text-[10px] font-display font-semibold tracking-widest uppercase text-muted text-center mb-1">
            Créer dans le catalogue
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => saveContextAndNavigate('manual')}
              className="py-2.5 rounded-xl border-2 border-line text-ink font-display text-[10px] tracking-widest uppercase font-bold hover:border-ink transition-colors flex items-center justify-center gap-1.5"
            >
              📝 Manuellement
            </button>
            <button
              type="button"
              onClick={() => saveContextAndNavigate('gemini')}
              className="py-2.5 rounded-xl bg-ink text-cream font-display text-[10px] tracking-widest uppercase font-bold hover:bg-terra transition-colors flex items-center justify-center gap-1.5"
            >
              ✨ Avec Gemini
            </button>
          </div>
          <p className="text-[10px] text-muted text-center">
            Après création, vous serez redirigé ici automatiquement
          </p>
        </div>
      </div>
    </div>
  );
}
