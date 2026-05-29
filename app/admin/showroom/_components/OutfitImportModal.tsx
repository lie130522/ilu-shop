'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { subscribeFirestoreProducts } from '@/lib/firebase/products';
import { getAdminProducts } from '@/lib/admin/product-store';
import type { Product } from '@/lib/types';
import { OUTFIT_ITEM_CATEGORY_EMOJI } from '@/lib/showroom/types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CatalogEntry {
  id: string;
  name: string;
  slug: string;
  priceUSD: number;
  category: string;
  images: string[];
}

type MatchStatus = 'found' | 'close' | 'absent';

interface DetectedItem {
  name: string;
  category: string;
  estimatedPriceUSD: number;
  matchStatus: MatchStatus;
  suggestion?: CatalogEntry;
  suggestionConfirmed?: boolean; // true = admin a confirmé le lien PROCHE
}

interface OutfitImportModalProps {
  onClose: () => void;
}

type Phase = 'upload' | 'analyzing' | 'matching' | 'review' | 'error';

// ── Helpers similarité ────────────────────────────────────────────────────────

function normalize(s: string) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, '').trim();
}

function jaccard(a: string, b: string): number {
  const setA = new Set(normalize(a).split(/\s+/).filter((w) => w.length > 2));
  const setB = new Set(normalize(b).split(/\s+/).filter((w) => w.length > 2));
  if (setA.size === 0 || setB.size === 0) return 0;
  const intersection = [...setA].filter((w) => setB.has(w)).length;
  const union = new Set([...setA, ...setB]).size;
  return intersection / union;
}

function outfitCatToProductCat(c: string): string {
  if (c === 'Tech') return 'technologie';
  if (c === 'Wearable') return 'hybrides';
  if (c === 'Service') return 'services';
  return 'mode';
}

function findMatch(
  name: string,
  category: string,
  catalog: CatalogEntry[],
): { status: MatchStatus; entry?: CatalogEntry } {
  const productCat = outfitCatToProductCat(category);
  let bestScore = 0;
  let bestEntry: CatalogEntry | undefined;
  for (const entry of catalog) {
    const score = jaccard(name, entry.name);
    if (score > bestScore) { bestScore = score; bestEntry = entry; }
  }
  if (bestScore >= 0.65 && bestEntry) return { status: 'found', entry: bestEntry };
  if (bestScore >= 0.35 && bestEntry?.category === productCat) {
    return { status: 'close', entry: bestEntry };
  }
  return { status: 'absent' };
}

// ── Composant principal ───────────────────────────────────────────────────────

export function OutfitImportModal({ onClose }: OutfitImportModalProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Catalog
  const [firestoreProducts, setFirestoreProducts] = useState<Product[]>([]);
  useEffect(() => subscribeFirestoreProducts(setFirestoreProducts), []);

  // Phase & data
  const [phase, setPhase] = useState<Phase>('upload');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState('image/jpeg');
  const [items, setItems] = useState<DetectedItem[]>([]);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);

  // Catalogue fusionné localStorage + Firestore
  const getCatalog = (): CatalogEntry[] => {
    const local = typeof window !== 'undefined' ? getAdminProducts() : [];
    const localIds = new Set(local.map((p) => p.id));
    return [
      ...local.map((p) => ({
        id: p.id, name: p.name, slug: p.slug, priceUSD: p.priceUSD,
        category: p.category,
        images: p.images.map((img) => img.processedDataUrl || img.originalDataUrl),
      })),
      ...firestoreProducts.filter((p) => !localIds.has(p.id)).map((p) => ({
        id: p.id, name: p.name, slug: p.slug, priceUSD: p.priceUSD,
        category: p.category, images: p.images,
      })),
    ];
  };

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setImageMime(file.type);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      setImagePreview(base64);
      setImageBase64(base64);
      await analyzeImage(base64, file.type);
    };
    reader.readAsDataURL(file);
  };

  const analyzeImage = async (base64: string, mime: string) => {
    setPhase('analyzing');
    setError('');
    try {
      const res = await fetch('/api/admin/showroom/analyze-outfit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: mime }),
      });
      const data = await res.json() as {
        items?: Array<{ name: string; category: string; estimatedPriceUSD: number }>;
        error?: string;
      };
      if (!res.ok || data.error) throw new Error(data.error ?? 'Analyse échouée');

      // Matching catalogue
      setPhase('matching');
      const catalog = getCatalog();
      const matched: DetectedItem[] = (data.items ?? []).map((item) => {
        const { status, entry } = findMatch(item.name, item.category, catalog);
        return { ...item, matchStatus: status, suggestion: entry };
      });
      setItems(matched);
      setPhase('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
      setPhase('error');
    }
  };

  const updateItem = (idx: number, patch: Partial<DetectedItem>) => {
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
  };

  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const handleRetry = () => imageBase64
    ? analyzeImage(imageBase64, imageMime)
    : resetToUpload();

  const resetToUpload = () => {
    setPhase('upload'); setImagePreview(null);
    setImageBase64(null); setItems([]); setError('');
  };

  const handleContinue = () => {
    const exportItems = items.map((item) => {
      const linked =
        item.matchStatus === 'found' ||
        (item.matchStatus === 'close' && item.suggestionConfirmed);
      return {
        name: item.name,
        category: item.category,
        priceUSD: item.estimatedPriceUSD,
        emoji: OUTFIT_ITEM_CATEGORY_EMOJI[item.category] ?? '📦',
        ...(linked && item.suggestion ? {
          productId: item.suggestion.id,
          productSlug: item.suggestion.slug,
          imageUrl: item.suggestion.images[0] ?? '',
        } : {}),
      };
    });
    sessionStorage.setItem('ilu_outfit_import', JSON.stringify({
      photo: imageBase64,
      items: exportItems,
    }));
    router.push('/admin/showroom/nouveau');
    onClose();
  };

  // ── Stats badges ──────────────────────────────────────────────────────────
  const foundCount  = items.filter((i) => i.matchStatus === 'found').length;
  const closeCount  = items.filter((i) => i.matchStatus === 'close').length;
  const absentCount = items.filter((i) => i.matchStatus === 'absent').length;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="Fermer" onClick={onClose}
        className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" />

      <div className="relative bg-cream rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-line">
          <div>
            <h3 className="font-display font-bold text-base">✨ Import outfit depuis photo</h3>
            <p className="text-xs text-muted mt-0.5">
              Gemini analyse la photo · Vérification automatique dans le catalogue
            </p>
          </div>
          <button type="button" onClick={onClose}
            className="w-8 h-8 rounded-full border border-line flex items-center justify-center text-muted hover:bg-bone transition-colors">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5">

          {/* Upload / Error */}
          {(phase === 'upload' || phase === 'error') && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl py-14 flex flex-col items-center gap-3 cursor-pointer transition-colors ${
                  dragging ? 'border-terra bg-terra/5' : 'border-line hover:border-terra hover:bg-terra/5'
                }`}
              >
                <span className="text-5xl">👗</span>
                <span className="font-display text-sm font-semibold text-muted">
                  Déposer une photo d'outfit
                </span>
                <span className="text-xs text-muted/60">JPG, PNG, WEBP</span>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
              {phase === 'error' && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700 flex items-start gap-2">
                  <span className="shrink-0">⚠</span>
                  <div>
                    <p className="font-semibold mb-0.5">Analyse échouée</p>
                    <p>{error}</p>
                    <button type="button" onClick={handleRetry} className="mt-1.5 underline">
                      Réessayer
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Analyzing / Matching */}
          {(phase === 'analyzing' || phase === 'matching') && (
            <div className="flex gap-6 items-start">
              {imagePreview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imagePreview} alt="outfit"
                  className="w-32 h-40 object-cover rounded-xl border border-line shrink-0" />
              )}
              <div className="flex-1 flex flex-col items-center justify-center py-8">
                <div className="w-12 h-12 border-2 border-terra/30 border-t-terra rounded-full animate-spin mb-5" />
                <p className="font-display text-sm font-semibold text-ink">
                  {phase === 'analyzing' ? 'Analyse Gemini…' : 'Vérification catalogue…'}
                </p>
                <p className="text-xs text-muted mt-1">
                  {phase === 'analyzing'
                    ? 'Identification des articles de l\'outfit'
                    : 'Recherche de correspondances dans votre catalogue'}
                </p>
              </div>
            </div>
          )}

          {/* Review */}
          {phase === 'review' && (
            <div className="space-y-5">
              {/* Aperçu + stats */}
              <div className="flex gap-4 items-start">
                {imagePreview && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imagePreview} alt="outfit"
                    className="w-24 h-32 object-cover rounded-xl border border-line shrink-0" />
                )}
                <div className="flex-1">
                  <p className="font-display font-bold text-sm text-ink">
                    {items.length} article{items.length > 1 ? 's' : ''} détecté{items.length > 1 ? 's' : ''}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {foundCount > 0 && (
                      <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-display font-bold tracking-widest uppercase">
                        ✓ {foundCount} trouvé{foundCount > 1 ? 's' : ''}
                      </span>
                    )}
                    {closeCount > 0 && (
                      <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-display font-bold tracking-widest uppercase">
                        ~ {closeCount} suggestion{closeCount > 1 ? 's' : ''}
                      </span>
                    )}
                    {absentCount > 0 && (
                      <span className="text-[10px] bg-orange-50 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-full font-display font-bold tracking-widest uppercase">
                        ⚠ {absentCount} à créer
                      </span>
                    )}
                  </div>
                  <button type="button" onClick={resetToUpload}
                    className="mt-2 text-[10px] font-display font-bold tracking-widest uppercase text-terra hover:underline">
                    ↺ Autre photo
                  </button>
                </div>
              </div>

              {/* Liste articles */}
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={idx} className={`rounded-xl border p-3 space-y-2 ${
                    item.matchStatus === 'found'
                      ? 'bg-emerald-50 border-emerald-200'
                      : item.matchStatus === 'close'
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-orange-50 border-orange-200'
                  }`}>
                    {/* Ligne principale */}
                    <div className="flex items-center gap-2">
                      <span className="text-lg shrink-0 w-7 text-center">
                        {OUTFIT_ITEM_CATEGORY_EMOJI[item.category] ?? '📦'}
                      </span>
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => updateItem(idx, { name: e.target.value })}
                        className="flex-1 bg-white border border-line rounded-lg px-3 py-1.5 text-sm outline-none focus:border-terra min-w-0"
                      />
                      <select
                        value={item.category}
                        onChange={(e) => updateItem(idx, { category: e.target.value, matchStatus: 'absent', suggestion: undefined })}
                        className="bg-white border border-line rounded-lg px-2 py-1.5 text-xs outline-none focus:border-terra shrink-0"
                      >
                        {Object.keys(OUTFIT_ITEM_CATEGORY_EMOJI).map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-xs text-muted">$</span>
                        <input
                          type="number"
                          value={item.estimatedPriceUSD || ''}
                          onChange={(e) => updateItem(idx, { estimatedPriceUSD: parseFloat(e.target.value) || 0 })}
                          className="w-16 bg-white border border-line rounded-lg px-2 py-1.5 text-sm font-display font-bold text-terra outline-none focus:border-terra text-right"
                        />
                      </div>
                      <button type="button" onClick={() => removeItem(idx)}
                        className="text-muted hover:text-terra transition-colors w-6 h-6 flex items-center justify-center shrink-0">
                        ✕
                      </button>
                    </div>

                    {/* Badge statut */}
                    {item.matchStatus === 'found' && item.suggestion && (
                      <div className="flex items-center gap-2 text-xs text-emerald-700">
                        <span className="font-bold">✓ Lié au catalogue :</span>
                        <span className="truncate">{item.suggestion.name}</span>
                        <span className="text-emerald-500 shrink-0">${item.suggestion.priceUSD}</span>
                      </div>
                    )}

                    {item.matchStatus === 'close' && item.suggestion && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-amber-700 font-semibold shrink-0">
                          ~ Suggestion :
                        </span>
                        <span className="text-xs text-amber-800 truncate flex-1">
                          {item.suggestion.name} (${item.suggestion.priceUSD})
                        </span>
                        {!item.suggestionConfirmed ? (
                          <div className="flex gap-1.5 shrink-0">
                            <button type="button"
                              onClick={() => updateItem(idx, { suggestionConfirmed: true })}
                              className="text-[10px] bg-emerald-600 text-white px-2.5 py-1 rounded-full font-display font-bold hover:bg-emerald-700 transition-colors">
                              Confirmer
                            </button>
                            <button type="button"
                              onClick={() => updateItem(idx, { matchStatus: 'absent', suggestion: undefined })}
                              className="text-[10px] border border-amber-300 text-amber-700 px-2.5 py-1 rounded-full font-display font-bold hover:bg-amber-100 transition-colors">
                              Refuser
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-display font-bold shrink-0">
                            ✓ Confirmé
                          </span>
                        )}
                      </div>
                    )}

                    {item.matchStatus === 'absent' && (
                      <p className="text-[10px] text-orange-700 font-semibold">
                        ⚠ Absent du catalogue — sera proposé en pré-commande ou à créer depuis le formulaire
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <p className="text-[10px] text-muted text-center">
                Les articles non liés pourront être créés depuis le formulaire d'outfit
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        {phase === 'review' && (
          <div className="p-5 border-t border-line">
            <button type="button" onClick={handleContinue} disabled={items.length === 0}
              className="w-full py-3 bg-terra text-cream font-display text-[10px] tracking-widest uppercase font-bold rounded-xl hover:bg-terra-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              ✓ Continuer vers le formulaire ({items.length} article{items.length > 1 ? 's' : ''})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
