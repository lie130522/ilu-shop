'use client';

import { useState, useEffect } from 'react';
import { subscribeFirestoreProducts } from '@/lib/firebase/products';
import { getAdminProducts } from '@/lib/admin/product-store';
import type { Product } from '@/lib/types';
import type { OutfitItem } from '@/lib/showroom/types';

interface ProductPickerProps {
  onSelect: (item: Omit<OutfitItem, 'id'>) => void;
  onClose: () => void;
}

// Map catégorie Firestore → catégorie outfit
function mapCategory(cat: string, sub: string): string {
  if (sub?.toLowerCase().includes('chaussure')) return 'Chaussures';
  if (sub?.toLowerCase().includes('bijou') || sub?.toLowerCase().includes('accessoire')) return 'Bijou';
  if (sub?.toLowerCase().includes('parfum') || sub?.toLowerCase().includes('beauté')) return 'Parfum';
  if (sub?.toLowerCase().includes('maroquinerie')) return 'Maroquinerie';
  if (cat === 'technologie') return 'Tech';
  if (cat === 'hybrides') return 'Wearable';
  if (cat === 'services') return 'Service';
  return 'Mode';
}

// Map catégorie → emoji
const CAT_EMOJI: Record<string, string> = {
  Mode: '👕', Chaussures: '👟', Bijou: '💍', Accessoire: '👜',
  Tech: '📱', Wearable: '⌚', Parfum: '🌸', Maroquinerie: '👜',
  Service: '📺',
};

export function ProductPicker({ onSelect, onClose }: ProductPickerProps) {
  const [search, setSearch] = useState('');
  const [firestoreProducts, setFirestoreProducts] = useState<Product[]>([]);

  useEffect(() => {
    return subscribeFirestoreProducts(setFirestoreProducts);
  }, []);

  // Fusionner localStorage + Firestore (dédupliqué)
  const localProducts = typeof window !== 'undefined' ? getAdminProducts() : [];
  const localIds = new Set(localProducts.map((p) => p.id));
  const all: { id: string; name: string; priceUSD: number; category: string; subcategory: string; images: string[]; slug: string }[] = [
    ...localProducts.map((p) => ({
      id: p.id, name: p.name, priceUSD: p.priceUSD,
      category: p.category, subcategory: p.subcategory,
      images: p.images.map((img) => img.processedDataUrl || img.originalDataUrl),
      slug: p.slug,
    })),
    ...firestoreProducts
      .filter((p) => !localIds.has(p.id))
      .map((p) => ({
        id: p.id, name: p.name, priceUSD: p.priceUSD,
        category: p.category, subcategory: p.subcategory ?? '',
        images: p.images, slug: p.slug,
      })),
  ];

  const filtered = all.filter((p) =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()),
  );

  const handleSelect = (p: typeof all[0]) => {
    const cat = mapCategory(p.category, p.subcategory);
    onSelect({
      productId: p.id,
      productSlug: p.slug,
      name: p.name,
      priceUSD: p.priceUSD,
      category: cat,
      emoji: CAT_EMOJI[cat] ?? '📦',
      imageUrl: p.images[0] ?? '',
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
      />

      <div className="relative bg-cream rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-line">
          <div>
            <h3 className="font-display font-bold text-base">Choisir un produit du catalogue</h3>
            <p className="text-xs text-muted mt-0.5">Sélectionne un produit pour le lier à l'outfit</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-line flex items-center justify-center text-muted hover:bg-bone transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-line">
          <input
            type="text"
            placeholder="Rechercher un produit…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            className="w-full bg-bone border border-line rounded-full px-4 py-2 text-sm outline-none focus:border-terra"
          />
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1 p-2">
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-muted text-sm">
              {all.length === 0 ? 'Aucun produit dans le catalogue.' : 'Aucun résultat.'}
            </div>
          ) : (
            filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelect(p)}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-bone transition-colors text-left"
              >
                {/* Thumbnail */}
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
                <div className="font-display font-bold text-sm text-terra shrink-0">
                  ${p.priceUSD}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer — ajout manuel */}
        <div className="p-4 border-t border-line">
          <button
            type="button"
            onClick={() => {
              onSelect({ name: '', priceUSD: 0, category: 'Mode', emoji: '📦' });
              onClose();
            }}
            className="w-full py-2 rounded-xl border border-dashed border-line text-sm text-muted hover:border-terra hover:text-terra transition-colors"
          >
            + Ajouter un article manuellement (sans lien catalogue)
          </button>
        </div>
      </div>
    </div>
  );
}
