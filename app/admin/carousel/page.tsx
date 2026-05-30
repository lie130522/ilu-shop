'use client';

import { useState, useEffect } from 'react';
import { useAdmin } from '@/components/admin/AdminProvider';
import { AdminTopBar } from '@/components/admin/AdminTopBar';
import { subscribeFirestoreProducts } from '@/lib/firebase/products';
import {
  subscribeCarousel,
  addSlideToCarousel,
  toggleSlideActif,
  moveSlide,
  removeSlide,
  type CarouselSlide,
} from '@/lib/firebase/carousel';
import type { Product } from '@/lib/types';

export default function CarouselAdminPage() {
  const { currentAdmin } = useAdmin();
  const [slides, setSlides] = useState<CarouselSlide[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [moving, setMoving] = useState<string | null>(null);

  useEffect(() => {
    const unsub1 = subscribeCarousel(setSlides);
    const unsub2 = subscribeFirestoreProducts(setProducts);
    return () => { unsub1(); unsub2(); };
  }, []);

  if (!currentAdmin) return null;

  // Produits déjà dans le carousel (pour éviter doublons)
  const inCarouselIds = new Set(slides.map((s) => s.productId));

  // Produits disponibles à ajouter (filtrés par recherche)
  const available = products.filter((p) => {
    if (inCarouselIds.has(p.id)) return false;
    if (!search) return true;
    return p.name.toLowerCase().includes(search.toLowerCase());
  });

  const handleAdd = async (productId: string) => {
    setAdding(productId);
    try {
      await addSlideToCarousel(productId, slides);
      setShowPicker(false);
      setSearch('');
    } finally {
      setAdding(null);
    }
  };

  const handleToggle = async (slide: CarouselSlide) => {
    await toggleSlideActif(slide);
  };

  const handleMove = async (slideId: string, dir: 'up' | 'down') => {
    setMoving(slideId);
    try {
      await moveSlide(slides, slideId, dir);
    } finally {
      setMoving(null);
    }
  };

  const handleRemove = async (slideId: string) => {
    if (!confirm('Retirer ce slide du carousel ?')) return;
    setRemoving(slideId);
    try {
      await removeSlide(slideId);
    } finally {
      setRemoving(null);
    }
  };

  // Trouver le produit correspondant à un slide
  const getProduct = (productId: string) =>
    products.find((p) => p.id === productId);

  const activeCount = slides.filter((s) => s.actif).length;

  return (
    <>
      <AdminTopBar
        title="Carousel Hero"
        subtitle={`${slides.length} slide${slides.length > 1 ? 's' : ''} — ${activeCount} actif${activeCount > 1 ? 's' : ''}`}
      />
      <div className="px-6 pt-4 flex justify-end">
        <button
          type="button"
          onClick={() => setShowPicker(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-terra text-cream font-display text-[11px] tracking-widest uppercase font-bold hover:opacity-90 transition-opacity"
        >
          + Ajouter un produit
        </button>
      </div>

      <div className="p-6 max-w-3xl">

        {/* Info banner */}
        <div className="mb-6 bg-terra/5 border border-terra/20 rounded-xl px-4 py-3">
          <p className="text-sm text-ink">
            <span className="font-semibold">Comment ça marche :</span> les slides actifs
            s&apos;affichent sur la page d&apos;accueil dans l&apos;ordre défini ci-dessous.
            Désactiver un slide le masque sans le supprimer.
          </p>
        </div>

        {/* Liste des slides */}
        {slides.length === 0 ? (
          <div className="py-20 text-center border-2 border-dashed border-line rounded-2xl">
            <div className="text-5xl mb-4">🎠</div>
            <p className="font-display font-semibold text-ink mb-2">Carousel vide</p>
            <p className="text-sm text-muted mb-6">
              Ajoutez des produits pour les afficher en bannière sur la page d&apos;accueil.
            </p>
            <button
              type="button"
              onClick={() => setShowPicker(true)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-ink text-cream font-display text-[11px] tracking-widest uppercase font-bold hover:bg-terra transition-colors"
            >
              + Ajouter un premier produit
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {slides.map((slide, idx) => {
              const product = getProduct(slide.productId);
              const isMoving = moving === slide.id;
              const isRemoving = removing === slide.id;

              return (
                <div
                  key={slide.id}
                  className={`group flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                    slide.actif
                      ? 'bg-cream border-line'
                      : 'bg-bone border-line opacity-60'
                  }`}
                >
                  {/* Numéro d'ordre */}
                  <div className="w-8 h-8 rounded-full bg-bone border border-line flex items-center justify-center font-display font-bold text-sm text-muted shrink-0">
                    {idx + 1}
                  </div>

                  {/* Aperçu image */}
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-beige border border-line shrink-0">
                    {product?.images[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={product.images[0]}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xl">📦</div>
                    )}
                  </div>

                  {/* Infos produit */}
                  <div className="flex-1 min-w-0">
                    {product ? (
                      <>
                        <div className="font-display font-semibold text-sm text-ink truncate">
                          {product.name}
                        </div>
                        <div className="text-[11px] text-muted mt-0.5">
                          {product.subcategory} · <span className="font-semibold text-terra">${product.priceUSD}</span>
                        </div>
                      </>
                    ) : (
                      <div className="text-sm text-muted italic">Produit introuvable (ID: {slide.productId})</div>
                    )}
                  </div>

                  {/* Statut actif/inactif */}
                  <button
                    type="button"
                    onClick={() => handleToggle(slide)}
                    title={slide.actif ? 'Désactiver' : 'Activer'}
                    className={`shrink-0 px-3 py-1.5 rounded-full font-display text-[9px] font-bold tracking-widest uppercase transition-colors ${
                      slide.actif
                        ? 'bg-emerald-100 text-emerald-700 hover:bg-red-100 hover:text-red-600'
                        : 'bg-bone text-muted border border-line hover:bg-emerald-100 hover:text-emerald-700'
                    }`}
                  >
                    {slide.actif ? 'Actif' : 'Inactif'}
                  </button>

                  {/* Flèches réordonnement */}
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleMove(slide.id, 'up')}
                      disabled={idx === 0 || isMoving}
                      className="w-7 h-7 rounded-md border border-line bg-bone hover:bg-cream disabled:opacity-20 flex items-center justify-center text-muted transition-colors"
                      title="Monter"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m5 15 7-7 7 7"/></svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMove(slide.id, 'down')}
                      disabled={idx === slides.length - 1 || isMoving}
                      className="w-7 h-7 rounded-md border border-line bg-bone hover:bg-cream disabled:opacity-20 flex items-center justify-center text-muted transition-colors"
                      title="Descendre"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m19 9-7 7-7-7"/></svg>
                    </button>
                  </div>

                  {/* Supprimer */}
                  <button
                    type="button"
                    onClick={() => handleRemove(slide.id)}
                    disabled={isRemoving}
                    className="shrink-0 w-8 h-8 rounded-full border border-line bg-bone hover:bg-terra hover:text-cream hover:border-terra text-muted flex items-center justify-center transition-colors disabled:opacity-40"
                    title="Retirer du carousel"
                  >
                    {isRemoving ? (
                      <span className="w-3 h-3 border-2 border-current/40 border-t-current rounded-full animate-spin" />
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {slides.length > 0 && (
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={() => setShowPicker(true)}
              className="flex items-center gap-2 px-6 py-3 rounded-full border-2 border-dashed border-line text-muted font-display text-[11px] tracking-widest uppercase font-bold hover:border-terra hover:text-terra transition-colors"
            >
              + Ajouter un produit
            </button>
          </div>
        )}
      </div>

      {/* ── Modal sélection produit ── */}
      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Fermer"
            onClick={() => { setShowPicker(false); setSearch(''); }}
            className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
          />
          <div className="relative bg-cream rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-line">
              <div>
                <h3 className="font-display font-bold text-base">Ajouter au carousel</h3>
                <p className="text-xs text-muted mt-0.5">Choisissez un produit du catalogue</p>
              </div>
              <button
                type="button"
                onClick={() => { setShowPicker(false); setSearch(''); }}
                className="w-8 h-8 rounded-full border border-line flex items-center justify-center text-muted hover:bg-bone"
              >
                ✕
              </button>
            </div>

            {/* Recherche */}
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

            {/* Liste */}
            <div className="overflow-y-auto flex-1 p-2">
              {available.length === 0 ? (
                <div className="py-10 text-center text-muted text-sm">
                  {products.length === 0
                    ? 'Aucun produit dans le catalogue.'
                    : inCarouselIds.size === products.length
                    ? 'Tous les produits sont déjà dans le carousel.'
                    : 'Aucun résultat pour cette recherche.'}
                </div>
              ) : (
                available.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleAdd(p.id)}
                    disabled={adding === p.id}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-bone transition-colors text-left disabled:opacity-50"
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
                      {adding === p.id ? (
                        <span className="w-4 h-4 border-2 border-terra/40 border-t-terra rounded-full animate-spin" />
                      ) : (
                        <span className="font-display font-bold text-sm text-terra">${p.priceUSD}</span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
