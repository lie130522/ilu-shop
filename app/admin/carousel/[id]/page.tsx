'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAdmin } from '@/components/admin/AdminProvider';
import { AdminTopBar } from '@/components/admin/AdminTopBar';
import { subscribeFirestoreProducts } from '@/lib/firebase/products';
import {
  subscribeCarousels,
  updateCarouselProducts,
  updateCarouselMeta,
  MAX_CAROUSEL_PRODUCTS,
  type Carousel,
} from '@/lib/firebase/carousel';
import type { Product } from '@/lib/types';

export default function CarouselEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { currentAdmin } = useAdmin();

  const [carousels, setCarousels] = useState<Carousel[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);

  // Picker state
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSelected, setPickerSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [savingProducts, setSavingProducts] = useState(false);

  // Meta editing
  const [editingMeta, setEditingMeta] = useState(false);
  const [metaName, setMetaName] = useState('');
  const [metaDesc, setMetaDesc] = useState('');
  const [savingMeta, setSavingMeta] = useState(false);

  // Move/remove state
  const [moving, setMoving] = useState<string | null>(null);

  useEffect(() => subscribeCarousels(setCarousels), []);
  useEffect(() => subscribeFirestoreProducts(setAllProducts), []);

  const carousel = carousels.find((c) => c.id === id);

  // Produits actuels du carousel (dans l'ordre)
  const currentProducts = useMemo(() => {
    if (!carousel) return [];
    return carousel.productIds
      .map((pid) => allProducts.find((p) => p.id === pid))
      .filter((p): p is Product => !!p);
  }, [carousel, allProducts]);

  if (!currentAdmin) return null;

  if (carousels.length > 0 && !carousel) {
    return (
      <>
        <AdminTopBar title="Carousel introuvable" />
        <div className="p-8 text-center">
          <p className="text-muted mb-4">Ce carousel n&apos;existe pas ou a été supprimé.</p>
          <Link href="/admin/carousel" className="text-terra font-semibold text-sm hover:underline">
            ← Retour aux carousels
          </Link>
        </div>
      </>
    );
  }

  // ── Move product ──────────────────────────────────────────────────────────
  const handleMove = async (productId: string, dir: 'up' | 'down') => {
    if (!carousel) return;
    const ids = [...carousel.productIds];
    const idx = ids.indexOf(productId);
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= ids.length) return;
    [ids[idx], ids[swapIdx]] = [ids[swapIdx], ids[idx]];
    setMoving(productId);
    try { await updateCarouselProducts(id, ids); }
    finally { setMoving(null); }
  };

  // ── Remove product ────────────────────────────────────────────────────────
  const handleRemove = async (productId: string) => {
    if (!carousel) return;
    const ids = carousel.productIds.filter((pid) => pid !== productId);
    await updateCarouselProducts(id, ids);
  };

  // ── Open picker ───────────────────────────────────────────────────────────
  const openPicker = () => {
    setPickerSelected(carousel?.productIds ? [...carousel.productIds] : []);
    setSearch('');
    setShowPicker(true);
  };

  // ── Toggle product in picker ──────────────────────────────────────────────
  const togglePicker = (productId: string) => {
    setPickerSelected((prev) => {
      if (prev.includes(productId)) return prev.filter((pid) => pid !== productId);
      if (prev.length >= MAX_CAROUSEL_PRODUCTS) return prev; // limite atteinte
      return [...prev, productId];
    });
  };

  // ── Save picker ───────────────────────────────────────────────────────────
  const savePicker = async () => {
    setSavingProducts(true);
    try {
      await updateCarouselProducts(id, pickerSelected);
      setShowPicker(false);
    } finally {
      setSavingProducts(false);
    }
  };

  // ── Save meta ─────────────────────────────────────────────────────────────
  const saveMeta = async () => {
    if (!metaName.trim()) return;
    setSavingMeta(true);
    try {
      await updateCarouselMeta(id, metaName, metaDesc);
      setEditingMeta(false);
    } finally {
      setSavingMeta(false);
    }
  };

  const openMeta = () => {
    setMetaName(carousel?.name ?? '');
    setMetaDesc(carousel?.description ?? '');
    setEditingMeta(true);
  };

  const filteredProducts = search
    ? allProducts.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : allProducts;

  const pickerCount = pickerSelected.length;
  const atMax = pickerCount >= MAX_CAROUSEL_PRODUCTS;

  return (
    <>
      <AdminTopBar
        title={carousel?.name ?? '…'}
        subtitle={`${currentProducts.length}/${MAX_CAROUSEL_PRODUCTS} produits · ${carousel?.actif ? '🟢 Actif' : '⚪ Inactif'}`}
      />

      <div className="p-6 max-w-3xl space-y-6">

        {/* Retour */}
        <Link
          href="/admin/carousel"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-terra transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
          Tous les carousels
        </Link>

        {/* Infos carousel + édition */}
        <div className="bg-cream border border-line rounded-2xl p-5">
          {editingMeta ? (
            <div className="space-y-3">
              <div>
                <label className="block font-display text-[10px] tracking-widest uppercase text-muted font-semibold mb-1.5">Nom</label>
                <input
                  type="text"
                  value={metaName}
                  onChange={(e) => setMetaName(e.target.value)}
                  autoFocus
                  className="w-full px-4 py-2.5 bg-bone border border-line rounded-xl text-sm outline-none focus:border-terra"
                />
              </div>
              <div>
                <label className="block font-display text-[10px] tracking-widest uppercase text-muted font-semibold mb-1.5">Description</label>
                <input
                  type="text"
                  value={metaDesc}
                  onChange={(e) => setMetaDesc(e.target.value)}
                  className="w-full px-4 py-2.5 bg-bone border border-line rounded-xl text-sm outline-none focus:border-terra"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setEditingMeta(false)} className="px-4 py-2 rounded-lg border border-line text-muted text-sm hover:bg-bone transition-colors">Annuler</button>
                <button type="button" onClick={saveMeta} disabled={!metaName.trim() || savingMeta}
                  className="px-4 py-2 rounded-lg bg-terra text-cream text-sm font-semibold hover:opacity-90 disabled:opacity-40 flex items-center gap-2">
                  {savingMeta && <span className="w-3 h-3 border-2 border-cream/40 border-t-cream rounded-full animate-spin" />}
                  Enregistrer
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-display font-bold text-base text-ink">{carousel?.name}</div>
                {carousel?.description && <div className="text-sm text-muted mt-1">{carousel.description}</div>}
              </div>
              <button type="button" onClick={openMeta}
                className="shrink-0 px-3 py-1.5 rounded-lg border border-line text-muted text-xs hover:bg-bone transition-colors font-medium">
                ✏ Renommer
              </button>
            </div>
          )}
        </div>

        {/* Header produits */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display font-bold text-sm text-ink">Produits dans ce carousel</h3>
            <p className="text-xs text-muted mt-0.5">
              {currentProducts.length}/{MAX_CAROUSEL_PRODUCTS} · s&apos;affichent dans cet ordre
            </p>
          </div>
          <button
            type="button"
            onClick={openPicker}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-ink text-cream font-display text-[10px] tracking-widest uppercase font-bold hover:bg-terra transition-colors"
          >
            + Gérer les produits
          </button>
        </div>

        {/* Liste produits actuels */}
        {currentProducts.length === 0 ? (
          <div className="py-12 text-center border-2 border-dashed border-line rounded-2xl">
            <p className="text-muted text-sm mb-4">Ce carousel est vide.</p>
            <button type="button" onClick={openPicker}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-terra text-cream font-display text-[10px] tracking-widest uppercase font-bold hover:opacity-90">
              + Ajouter des produits
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {currentProducts.map((product, idx) => (
              <div key={product.id} className="flex items-center gap-3 p-3 bg-cream border border-line rounded-xl">
                {/* Numéro */}
                <span className="w-7 h-7 rounded-full bg-bone border border-line flex items-center justify-center font-display font-bold text-xs text-muted shrink-0">
                  {idx + 1}
                </span>
                {/* Image */}
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-beige border border-line shrink-0">
                  {product.images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={product.images[0]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-lg">📦</div>
                  )}
                </div>
                {/* Infos */}
                <div className="flex-1 min-w-0">
                  <div className="font-display font-semibold text-sm text-ink truncate">{product.name}</div>
                  <div className="text-[11px] text-muted">{product.subcategory} · <span className="text-terra font-semibold">${product.priceUSD}</span></div>
                </div>
                {/* Flèches */}
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button type="button" onClick={() => handleMove(product.id, 'up')} disabled={idx === 0 || moving === product.id}
                    className="w-6 h-6 rounded border border-line bg-bone hover:bg-cream disabled:opacity-20 flex items-center justify-center text-muted">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m5 15 7-7 7 7"/></svg>
                  </button>
                  <button type="button" onClick={() => handleMove(product.id, 'down')} disabled={idx === currentProducts.length - 1 || moving === product.id}
                    className="w-6 h-6 rounded border border-line bg-bone hover:bg-cream disabled:opacity-20 flex items-center justify-center text-muted">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m19 9-7 7-7-7"/></svg>
                  </button>
                </div>
                {/* Supprimer */}
                <button type="button" onClick={() => handleRemove(product.id)}
                  className="shrink-0 w-7 h-7 rounded-full border border-line bg-bone hover:bg-terra hover:text-cream hover:border-terra text-muted flex items-center justify-center transition-colors">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modal sélection produits (avec coches) ── */}
      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" aria-label="Fermer" onClick={() => setShowPicker(false)}
            className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" />
          <div className="relative bg-cream rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-line">
              <div>
                <h3 className="font-display font-bold text-base">Choisir les produits</h3>
                <p className="text-xs text-muted mt-0.5">
                  <span className={`font-semibold ${atMax ? 'text-terra' : 'text-ink'}`}>{pickerCount}/{MAX_CAROUSEL_PRODUCTS}</span> produits sélectionnés
                  {atMax && ' — limite atteinte'}
                </p>
              </div>
              <button type="button" onClick={() => setShowPicker(false)}
                className="w-8 h-8 rounded-full border border-line flex items-center justify-center text-muted hover:bg-bone">✕</button>
            </div>

            {/* Recherche */}
            <div className="p-4 border-b border-line">
              <input type="text" placeholder="Rechercher un produit…" value={search}
                onChange={(e) => setSearch(e.target.value)} autoFocus
                className="w-full bg-bone border border-line rounded-full px-4 py-2 text-sm outline-none focus:border-terra" />
            </div>

            {/* Liste avec coches */}
            <div className="overflow-y-auto flex-1 p-2">
              {filteredProducts.length === 0 ? (
                <div className="py-10 text-center text-muted text-sm">Aucun résultat.</div>
              ) : (
                filteredProducts.map((p) => {
                  const isChecked = pickerSelected.includes(p.id);
                  const isDisabled = !isChecked && atMax;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => togglePicker(p.id)}
                      disabled={isDisabled}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${
                        isChecked
                          ? 'bg-terra/10 border border-terra/30'
                          : isDisabled
                          ? 'opacity-40 cursor-not-allowed'
                          : 'hover:bg-bone border border-transparent'
                      }`}
                    >
                      {/* Coche */}
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                        isChecked ? 'bg-terra border-terra' : 'border-line bg-bone'
                      }`}>
                        {isChecked && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                      {/* Image */}
                      <div className="w-11 h-11 rounded-lg bg-beige overflow-hidden border border-line shrink-0">
                        {p.images[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.images[0]} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-base">📦</div>
                        )}
                      </div>
                      {/* Infos */}
                      <div className="flex-1 min-w-0">
                        <div className="font-display font-semibold text-sm text-ink truncate">{p.name}</div>
                        <div className="text-[11px] text-muted">{p.subcategory}</div>
                      </div>
                      <div className="font-display font-bold text-sm text-terra shrink-0">${p.priceUSD}</div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer — Enregistrer */}
            <div className="p-4 border-t border-line flex gap-3">
              <button type="button" onClick={() => setShowPicker(false)}
                className="flex-1 py-2.5 rounded-xl border border-line text-muted font-display text-[11px] tracking-widest uppercase font-bold hover:bg-bone transition-colors">
                Annuler
              </button>
              <button type="button" onClick={savePicker} disabled={savingProducts}
                className="flex-1 py-2.5 rounded-xl bg-terra text-cream font-display text-[11px] tracking-widest uppercase font-bold hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-2">
                {savingProducts
                  ? <><span className="w-3.5 h-3.5 border-2 border-cream/40 border-t-cream rounded-full animate-spin" />Enregistrement…</>
                  : `Enregistrer (${pickerCount})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
