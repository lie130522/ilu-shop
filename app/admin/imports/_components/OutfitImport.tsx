'use client';

import { useState, useRef, useCallback } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { ref as storageRef, uploadString, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase/client';
import { saveOutfitToFirestore } from '@/lib/firebase/outfits';
import { saveAdminProduct, slugify, type StoredProduct } from '@/lib/admin/product-store';
import { saveProductToFirestore } from '@/lib/firebase/products';
import type { Product } from '@/lib/types';
import type { Outfit, OutfitCategory, OutfitItem } from '@/lib/showroom/types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DetectedItem {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  priceUSD: number;
  description: string;
  brand?: string;
  searchKeywords: string[];
}

interface LinkedItem extends DetectedItem {
  linkedProduct: Product | null;   // null = non lié
  linkScore: number;               // 0 = aucune correspondance
  isPreorder: boolean;             // vrai si non lié au catalogue
}

interface QuickCreateState {
  itemId: string;
  name: string;
  category: string;
  subcategory: string;
  priceUSD: number;
  description: string;
  brand: string;
  saving: boolean;
}

// ── Fuzzy match ───────────────────────────────────────────────────────────────

function computeMatchScore(detected: DetectedItem, product: Product): number {
  const normalize = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ');

  const detWords = new Set(normalize(detected.name + ' ' + detected.searchKeywords.join(' ')).split(/\s+/).filter((w) => w.length > 2));
  const prodWords = normalize(product.name).split(/\s+/).filter((w) => w.length > 2);

  let score = 0;
  for (const w of prodWords) {
    if (detWords.has(w)) score += 2;
  }
  if (normalize(detected.category) === normalize(product.category)) score += 1;
  if (product.subcategory && normalize(detected.subcategory).includes(normalize(product.subcategory).slice(0, 5))) score += 1;

  return score;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Composant principal ───────────────────────────────────────────────────────

export function OutfitImport() {
  const [phase, setPhase]           = useState<'drop' | 'analyzing' | 'review' | 'publishing' | 'done'>('drop');
  const [dragging, setDragging]     = useState(false);
  const [error, setError]           = useState<string | null>(null);

  // Image flat lay
  const [flatLayBase64, setFlatLayBase64] = useState<string>('');
  const [flatLayPreview, setFlatLayPreview] = useState<string>('');

  // Données Gemini + catalogue
  const [outfitName, setOutfitName]       = useState('');
  const [outfitCategory, setOutfitCategory] = useState<OutfitCategory>('casual');
  const [outfitSeason, setOutfitSeason]   = useState('Toutes saisons');
  const [items, setItems]                 = useState<LinkedItem[]>([]);
  const [catalog, setCatalog]             = useState<Product[]>([]);

  // Modals
  const [searchModal, setSearchModal]   = useState<string | null>(null); // itemId
  const [searchQuery, setSearchQuery]   = useState('');
  const [quickCreate, setQuickCreate]   = useState<QuickCreateState | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Chargement catalogue Firestore ─────────────────────────────────────────

  const loadCatalog = useCallback(async (): Promise<Product[]> => {
    if (catalog.length > 0) return catalog;
    try {
      const snap = await getDocs(collection(db, 'products'));
      const products = snap.docs.map((d) => ({ ...(d.data() as Product), id: d.id }));
      setCatalog(products);
      return products;
    } catch {
      return [];
    }
  }, [catalog]);

  // ── Auto-matching ──────────────────────────────────────────────────────────

  const autoMatch = useCallback((detected: DetectedItem[], products: Product[]): LinkedItem[] => {
    return detected.map((item) => {
      let best: Product | null = null;
      let bestScore = 0;
      for (const product of products) {
        const score = computeMatchScore(item, product);
        if (score > bestScore) { bestScore = score; best = product; }
      }
      const linked = bestScore >= 3 ? best : null;
      return { ...item, linkedProduct: linked, linkScore: bestScore, isPreorder: !linked };
    });
  }, []);

  // ── Analyse flat lay ───────────────────────────────────────────────────────

  const analyzeOutfit = useCallback(async (file: File) => {
    setPhase('analyzing');
    setError(null);
    try {
      const base64 = await fileToBase64(file);
      setFlatLayBase64(base64);
      setFlatLayPreview(URL.createObjectURL(file));

      const res = await fetch('/api/admin/imports/analyze-outfit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, filename: file.name, mimeType: file.type }),
      });
      const data = await res.json() as {
        outfitName?: string; outfitCategory?: string; season?: string;
        items?: DetectedItem[]; error?: string;
      };
      if (!res.ok || data.error) throw new Error(data.error ?? 'Analyse échouée');

      setOutfitName(data.outfitName ?? 'Nouveau look');
      setOutfitCategory((data.outfitCategory as OutfitCategory) ?? 'casual');
      setOutfitSeason(data.season ?? 'Toutes saisons');

      const products = await loadCatalog();
      const linked = autoMatch(data.items ?? [], products);
      setItems(linked);
      setPhase('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
      setPhase('drop');
    }
  }, [loadCatalog, autoMatch]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith('image/'));
    if (file) analyzeOutfit(file);
  };

  // ── Lier un article à un produit ──────────────────────────────────────────

  const linkItem = (itemId: string, product: Product | null) => {
    setItems((prev) => prev.map((it) =>
      it.id === itemId
        ? { ...it, linkedProduct: product, linkScore: product ? 10 : 0, isPreorder: !product }
        : it,
    ));
    setSearchModal(null);
    setSearchQuery('');
  };

  // ── Quick-create produit ──────────────────────────────────────────────────

  const openQuickCreate = (item: LinkedItem) => {
    setQuickCreate({
      itemId: item.id,
      name: item.name,
      category: item.category,
      subcategory: item.subcategory,
      priceUSD: item.priceUSD,
      description: item.description,
      brand: item.brand ?? '',
      saving: false,
    });
  };

  const saveQuickCreate = async () => {
    if (!quickCreate) return;
    setQuickCreate((prev) => prev ? { ...prev, saving: true } : prev);
    try {
      const id = genId();
      const now = new Date().toISOString();
      const slug = slugify(quickCreate.name) + '-' + id.slice(-6);

      const product: StoredProduct = {
        id, slug,
        name: quickCreate.name,
        category: quickCreate.category as StoredProduct['category'],
        subcategory: quickCreate.subcategory,
        priceUSD: quickCreate.priceUSD,
        shortDescription: quickCreate.description.slice(0, 80),
        description: quickCreate.description,
        stock: 0,
        tags: [],
        sizes: [],
        colors: [],
        colorImages: {},
        images: [],
        videos: [],
        brand: quickCreate.brand || undefined,
        genre: 'mixte',
        status: 'active',
        rating: 0, reviewCount: 0,
        createdAt: now, updatedAt: now,
      };

      saveAdminProduct(product);
      await saveProductToFirestore(product);

      // Recharger le catalogue pour inclure le nouveau produit
      const snap = await getDocs(collection(db, 'products'));
      const products = snap.docs.map((d) => ({ ...(d.data() as Product), id: d.id }));
      setCatalog(products);

      const created = products.find((p) => p.id === id) ?? { id, slug, name: quickCreate.name } as Product;
      linkItem(quickCreate.itemId, created);
      setQuickCreate(null);
    } catch (err) {
      setQuickCreate((prev) => prev ? { ...prev, saving: false } : prev);
      alert(err instanceof Error ? err.message : 'Erreur création produit');
    }
  };

  // ── Publication outfit ─────────────────────────────────────────────────────

  const linkedCount = items.filter((it) => it.linkedProduct).length;
  const canPublish = linkedCount >= 1;

  const publishOutfit = async () => {
    if (!canPublish) return;
    setPhase('publishing');
    try {
      const id = genId();
      const now = new Date().toISOString();

      // Upload flat lay image
      let photoUrl = flatLayPreview;
      if (flatLayBase64) {
        const imgRef = storageRef(storage, `outfits/${id}/flat-lay`);
        await uploadString(imgRef, flatLayBase64, 'data_url', { contentType: 'image/jpeg' });
        photoUrl = await getDownloadURL(imgRef);
      }

      const outfitItems: OutfitItem[] = items.map((it, i) => ({
        id: `item-${i}`,
        name: it.name,
        priceUSD: it.priceUSD,
        category: it.subcategory || it.category,
        emoji: it.category === 'mode' ? '👕' : it.category === 'technologie' ? '📱' : '👟',
        productId: it.linkedProduct?.id,
        productSlug: it.linkedProduct?.slug,
        imageUrl: it.linkedProduct?.images?.[0],
      }));

      const outfit: Outfit = {
        id, name: outfitName,
        season: outfitSeason,
        cat: outfitCategory,
        status: 'published',
        creationMode: 'ai',
        photos: [photoUrl],
        items: outfitItems,
        dots: [],
        createdAt: now, updatedAt: now,
      };

      await saveOutfitToFirestore(outfit);
      setPhase('done');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur publication');
      setPhase('review');
    }
  };

  // ── Résultats de recherche catalogue ──────────────────────────────────────

  const searchResults = catalog.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.subcategory?.toLowerCase().includes(q);
  }).slice(0, 12);

  // ── Rendu ─────────────────────────────────────────────────────────────────

  if (phase === 'done') {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-10 text-center">
        <div className="text-5xl mb-4">🎉</div>
        <p className="font-display font-bold text-emerald-800 text-xl mb-2">Outfit publié !</p>
        <p className="text-sm text-emerald-600 mb-6">
          {linkedCount} article{linkedCount > 1 ? 's' : ''} du catalogue lié{linkedCount > 1 ? 's' : ''} •{' '}
          {items.length - linkedCount} en précommande
        </p>
        <div className="flex gap-3 justify-center">
          <a href="/admin/showroom"
            className="inline-block font-display text-[10px] tracking-widest uppercase font-bold bg-emerald-700 text-white px-6 py-2.5 rounded-full hover:bg-emerald-800 transition-colors">
            Voir le showroom →
          </a>
          <button type="button" onClick={() => { setPhase('drop'); setItems([]); setFlatLayPreview(''); setFlatLayBase64(''); }}
            className="font-display text-[10px] tracking-widest uppercase font-semibold border border-emerald-300 text-emerald-700 px-5 py-2.5 rounded-full hover:bg-emerald-100 transition-colors">
            Importer un autre outfit
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'drop' || phase === 'analyzing') {
    return (
      <>
        {error && (
          <div className="mb-4 bg-terra/10 border border-terra/30 rounded-xl px-4 py-3 text-sm text-terra">{error}</div>
        )}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => phase === 'drop' && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl py-20 flex flex-col items-center gap-4 cursor-pointer transition-all select-none ${
            dragging ? 'border-terra bg-terra/5 scale-[1.01]' :
            phase === 'analyzing' ? 'border-terra/40 bg-terra/3' :
            'border-line hover:border-terra/50 hover:bg-terra/3'
          }`}
        >
          {phase === 'analyzing' ? (
            <>
              <span className="w-10 h-10 border-4 border-terra/30 border-t-terra rounded-full animate-spin" />
              <div className="text-center">
                <p className="font-display font-bold text-lg text-ink">Gemini analyse le look…</p>
                <p className="text-sm text-muted mt-1">Détection des articles + matching catalogue</p>
              </div>
            </>
          ) : (
            <>
              <span className="text-5xl">👗</span>
              <div className="text-center">
                <p className="font-display font-bold text-lg text-ink">Dépose ton image outfit ici</p>
                <p className="text-sm text-muted mt-1">Flat lay ou look porté — JPG, PNG, WEBP</p>
              </div>
              <span className="text-xs text-muted/60 bg-bone px-3 py-1.5 rounded-full">
                ✨ Gemini détecte chaque article et les relie à ton catalogue
              </span>
            </>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { if (e.target.files?.[0]) analyzeOutfit(e.target.files[0]); e.target.value = ''; }} />
      </>
    );
  }

  // ── Phase review ──────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Aperçu flat lay + infos outfit */}
      <div className="flex gap-5 items-start">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={flatLayPreview} alt="Outfit" className="w-40 h-40 object-cover rounded-xl border border-line shrink-0" />
        <div className="flex-1 space-y-3">
          <div>
            <label className="font-display text-[9px] tracking-widest uppercase text-muted block mb-1">Nom du look</label>
            <input type="text" value={outfitName} onChange={(e) => setOutfitName(e.target.value)}
              className="w-full bg-bone border border-line rounded-lg px-3 py-2 text-sm font-semibold text-ink outline-none focus:border-terra" />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="font-display text-[9px] tracking-widest uppercase text-muted block mb-1">Catégorie</label>
              <select value={outfitCategory} onChange={(e) => setOutfitCategory(e.target.value as OutfitCategory)}
                className="w-full bg-bone border border-line rounded-lg px-2 py-1.5 text-xs outline-none focus:border-terra">
                {(['casual','business','soiree','streetwear','tech'] as const).map((c) => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="font-display text-[9px] tracking-widest uppercase text-muted block mb-1">Saison</label>
              <select value={outfitSeason} onChange={(e) => setOutfitSeason(e.target.value)}
                className="w-full bg-bone border border-line rounded-lg px-2 py-1.5 text-xs outline-none focus:border-terra">
                {['Toutes saisons','Été','Hiver','Mi-saison'].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Résumé de liaison */}
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-display font-semibold ${
        linkedCount === 0 ? 'bg-terra/10 text-terra border border-terra/30' :
        linkedCount === items.length ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
        'bg-amber-50 text-amber-700 border border-amber-200'
      }`}>
        <span className="text-lg">{linkedCount === 0 ? '⚠️' : linkedCount === items.length ? '✅' : '🔗'}</span>
        <span>
          {linkedCount}/{items.length} article{items.length > 1 ? 's' : ''} lié{linkedCount > 1 ? 's' : ''} au catalogue
          {linkedCount === 0 && ' — liez au moins 1 article pour publier'}
          {linkedCount > 0 && items.length - linkedCount > 0 && ` · ${items.length - linkedCount} en précommande`}
        </span>
      </div>

      {/* Liste des articles détectés */}
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className={`bg-cream border rounded-xl p-4 transition-all ${
            item.linkedProduct ? 'border-emerald-200' : 'border-terra/30'
          }`}>
            <div className="flex items-start gap-4">

              {/* Image produit lié ou placeholder */}
              <div className="shrink-0 w-16 h-16 rounded-lg border border-line overflow-hidden bg-bone flex items-center justify-center">
                {item.linkedProduct?.images?.[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.linkedProduct.images[0]} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl">{item.category === 'technologie' ? '📱' : item.subcategory?.toLowerCase().includes('chaussure') ? '👟' : '👕'}</span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                {/* Statut */}
                <div className="flex items-center gap-2 mb-1">
                  {item.linkedProduct ? (
                    <span className="text-[9px] bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-display font-bold tracking-widest uppercase">
                      ✓ Lié au catalogue
                    </span>
                  ) : (
                    <span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-display font-bold tracking-widest uppercase">
                      ⚠ Non trouvé — précommande
                    </span>
                  )}
                  <span className="text-[9px] text-muted font-mono">{item.subcategory}</span>
                </div>

                {/* Nom détecté */}
                <p className="font-display font-semibold text-sm text-ink leading-tight">{item.name}</p>

                {/* Produit lié */}
                {item.linkedProduct && (
                  <p className="text-xs text-muted mt-0.5 truncate">
                    → {item.linkedProduct.name}
                    {item.linkedProduct.priceUSD && <span className="text-terra ml-1">${item.linkedProduct.priceUSD}</span>}
                  </p>
                )}
                {!item.linkedProduct && item.description && (
                  <p className="text-xs text-muted mt-0.5 line-clamp-1">{item.description}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-1.5 shrink-0 items-end">
                <button type="button" onClick={() => { setSearchModal(item.id); setSearchQuery(''); }}
                  className="text-[9px] font-display font-bold tracking-widest uppercase border border-line px-3 py-1.5 rounded-full text-muted hover:border-terra hover:text-terra transition-colors">
                  {item.linkedProduct ? '🔄 Changer' : '🔗 Lier'}
                </button>
                {!item.linkedProduct && (
                  <button type="button" onClick={() => openQuickCreate(item)}
                    className="text-[9px] font-display font-bold tracking-widest uppercase bg-ink text-cream px-3 py-1.5 rounded-full hover:bg-terra transition-colors">
                    ✨ Créer
                  </button>
                )}
                {item.linkedProduct && (
                  <button type="button" onClick={() => linkItem(item.id, null)}
                    className="text-[9px] text-muted hover:text-terra font-display font-semibold">
                    Délier
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Barre de publication */}
      <div className="flex items-center gap-4 pt-4 border-t border-line">
        <button type="button" onClick={() => { setPhase('drop'); setItems([]); setFlatLayPreview(''); }}
          className="font-display text-[10px] tracking-widest uppercase font-semibold border border-line px-4 py-2.5 rounded-full text-muted hover:border-ink hover:text-ink transition-colors">
          ← Recommencer
        </button>
        <div className="flex-1" />
        {!canPublish && (
          <p className="text-xs text-muted">Liez au moins 1 article pour publier</p>
        )}
        <button type="button" onClick={publishOutfit} disabled={!canPublish || phase === 'publishing'}
          className="font-display text-[10px] tracking-widest uppercase font-bold bg-terra text-cream px-6 py-2.5 rounded-full hover:bg-terra-dark disabled:opacity-50 transition-colors flex items-center gap-2">
          {phase === 'publishing' ? (
            <><span className="w-3.5 h-3.5 border-2 border-cream/40 border-t-cream rounded-full animate-spin" /> Publication…</>
          ) : '→ Publier l\'outfit'}
        </button>
      </div>

      {/* ── Modal recherche catalogue ── */}
      {searchModal && (
        <div className="fixed inset-0 bg-ink/60 z-50 flex items-center justify-center p-4" onClick={() => { setSearchModal(null); setSearchQuery(''); }}>
          <div className="bg-cream rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-line flex items-center justify-between">
              <h3 className="font-display font-bold text-base text-ink">Lier à un produit du catalogue</h3>
              <button type="button" onClick={() => { setSearchModal(null); setSearchQuery(''); }}
                className="text-muted hover:text-ink w-8 h-8 flex items-center justify-center rounded-full hover:bg-bone">✕</button>
            </div>
            <div className="p-4 border-b border-line">
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un produit…" autoFocus
                className="w-full bg-bone border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-terra" />
            </div>
            <div className="overflow-y-auto flex-1 p-3 space-y-2">
              {searchResults.length === 0 ? (
                <p className="text-center text-muted text-sm py-8">Aucun produit trouvé</p>
              ) : searchResults.map((p) => (
                <button key={p.id} type="button" onClick={() => linkItem(searchModal, p)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-line hover:border-terra hover:bg-terra/3 transition-all text-left">
                  <div className="w-12 h-12 rounded-lg border border-line overflow-hidden bg-bone shrink-0">
                    {p.images?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.images[0]} alt="" className="w-full h-full object-cover" />
                    ) : <span className="w-full h-full flex items-center justify-center text-xl">👕</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-semibold text-sm text-ink truncate">{p.name}</p>
                    <p className="text-xs text-muted">{p.subcategory} · <span className="text-terra">${p.priceUSD}</span></p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal quick-create ── */}
      {quickCreate && (
        <div className="fixed inset-0 bg-ink/60 z-50 flex items-center justify-center p-4" onClick={() => !quickCreate.saving && setQuickCreate(null)}>
          <div className="bg-cream rounded-2xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-display font-bold text-base text-ink">Créer l'article dans le catalogue</h3>
                <p className="text-xs text-muted mt-0.5">Pré-rempli par Gemini · corrige si besoin</p>
              </div>
              {!quickCreate.saving && (
                <button type="button" onClick={() => setQuickCreate(null)}
                  className="text-muted hover:text-ink w-8 h-8 flex items-center justify-center rounded-full hover:bg-bone">✕</button>
              )}
            </div>
            <div className="space-y-3">
              <div>
                <label className="font-display text-[9px] tracking-widest uppercase text-muted block mb-1">Nom *</label>
                <input type="text" value={quickCreate.name}
                  onChange={(e) => setQuickCreate((p) => p ? { ...p, name: e.target.value } : p)}
                  className="w-full bg-bone border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-terra" />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="font-display text-[9px] tracking-widest uppercase text-muted block mb-1">Prix USD</label>
                  <input type="number" value={quickCreate.priceUSD}
                    onChange={(e) => setQuickCreate((p) => p ? { ...p, priceUSD: parseFloat(e.target.value) || 0 } : p)}
                    className="w-full bg-bone border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-terra" />
                </div>
                <div className="flex-1">
                  <label className="font-display text-[9px] tracking-widest uppercase text-muted block mb-1">Marque</label>
                  <input type="text" value={quickCreate.brand}
                    onChange={(e) => setQuickCreate((p) => p ? { ...p, brand: e.target.value } : p)}
                    placeholder="ex: Zara"
                    className="w-full bg-bone border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-terra" />
                </div>
              </div>
              <div>
                <label className="font-display text-[9px] tracking-widest uppercase text-muted block mb-1">Description</label>
                <textarea value={quickCreate.description} rows={2}
                  onChange={(e) => setQuickCreate((p) => p ? { ...p, description: e.target.value } : p)}
                  className="w-full bg-bone border border-line rounded-lg px-3 py-2 text-xs outline-none focus:border-terra resize-none" />
              </div>
            </div>
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
              <strong>Stock = 0</strong> — ce produit sera visible dans le catalogue mais en précommande jusqu'à ce que tu ajoutes un stock.
            </div>
            <div className="flex gap-3 mt-5">
              <button type="button" onClick={() => setQuickCreate(null)} disabled={quickCreate.saving}
                className="flex-1 py-2.5 border border-line rounded-xl font-display text-[10px] tracking-widest uppercase font-semibold text-muted hover:bg-bone disabled:opacity-50">
                Annuler
              </button>
              <button type="button" onClick={saveQuickCreate} disabled={quickCreate.saving || !quickCreate.name.trim()}
                className="flex-1 py-2.5 bg-terra text-cream rounded-xl font-display text-[10px] tracking-widest uppercase font-bold hover:bg-terra-dark disabled:opacity-50 flex items-center justify-center gap-2">
                {quickCreate.saving ? (
                  <><span className="w-3.5 h-3.5 border-2 border-cream/40 border-t-cream rounded-full animate-spin" /> Création…</>
                ) : '✨ Créer et lier'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
