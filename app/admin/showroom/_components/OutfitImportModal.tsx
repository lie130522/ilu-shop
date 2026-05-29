'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { OUTFIT_ITEM_CATEGORY_EMOJI } from '@/lib/showroom/types';

interface DetectedItem {
  name: string;
  category: string;
  estimatedPriceUSD: number;
}

interface OutfitImportModalProps {
  onClose: () => void;
}

type Phase = 'upload' | 'analyzing' | 'review' | 'error';

export function OutfitImportModal({ onClose }: OutfitImportModalProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>('upload');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState('image/jpeg');
  const [items, setItems] = useState<DetectedItem[]>([]);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);

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
      const data = await res.json() as { items?: DetectedItem[]; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? 'Analyse échouée');
      setItems(data.items ?? []);
      setPhase('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
      setPhase('error');
    }
  };

  const updateItem = (idx: number, key: keyof DetectedItem, value: string | number) => {
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, [key]: value } : it));
  };

  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const handleRetry = () => {
    if (imageBase64) {
      analyzeImage(imageBase64, imageMime);
    } else {
      setPhase('upload');
      setImagePreview(null);
      setImageBase64(null);
      setItems([]);
    }
  };

  const handleNewPhoto = () => {
    setPhase('upload');
    setImagePreview(null);
    setImageBase64(null);
    setItems([]);
    setError('');
  };

  const handleContinue = () => {
    sessionStorage.setItem('ilu_outfit_import', JSON.stringify({
      photo: imageBase64,
      items: items.map((it) => ({
        name: it.name,
        category: it.category,
        priceUSD: it.estimatedPriceUSD,
        emoji: OUTFIT_ITEM_CATEGORY_EMOJI[it.category] ?? '📦',
      })),
    }));
    router.push('/admin/showroom/nouveau');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
      />

      <div className="relative bg-cream rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-line">
          <div>
            <h3 className="font-display font-bold text-base">✨ Import outfit depuis photo</h3>
            <p className="text-xs text-muted mt-0.5">
              Gemini analyse la photo et détecte les articles automatiquement
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

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5">

          {/* Phase upload / error */}
          {(phase === 'upload' || phase === 'error') && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault(); setDragging(false);
                  const f = e.dataTransfer.files[0];
                  if (f) handleFile(f);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl py-14 flex flex-col items-center gap-3 cursor-pointer transition-colors ${
                  dragging
                    ? 'border-terra bg-terra/5'
                    : 'border-line hover:border-terra hover:bg-terra/5'
                }`}
              >
                <span className="text-5xl">👗</span>
                <span className="font-display text-sm font-semibold text-muted">
                  Déposer une photo d'outfit
                </span>
                <span className="text-xs text-muted/60">
                  ou cliquer pour parcourir — JPG, PNG, WEBP
                </span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = '';
                }}
              />

              {phase === 'error' && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700 flex items-start gap-2">
                  <span className="shrink-0">⚠</span>
                  <div>
                    <p className="font-semibold mb-1">Analyse échouée</p>
                    <p>{error}</p>
                    <button
                      type="button"
                      onClick={handleRetry}
                      className="mt-2 underline hover:text-red-900 transition-colors"
                    >
                      Réessayer avec la même photo
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Phase analyzing */}
          {phase === 'analyzing' && (
            <div className="flex gap-6 items-start">
              {imagePreview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imagePreview}
                  alt="outfit"
                  className="w-32 h-40 object-cover rounded-xl border border-line shrink-0"
                />
              )}
              <div className="flex-1 flex flex-col items-center justify-center py-8">
                <div className="w-12 h-12 border-2 border-terra/30 border-t-terra rounded-full animate-spin mb-5" />
                <p className="font-display text-sm font-semibold text-ink">Analyse en cours…</p>
                <p className="text-xs text-muted mt-1">
                  Gemini identifie les articles de l'outfit
                </p>
              </div>
            </div>
          )}

          {/* Phase review */}
          {phase === 'review' && (
            <div className="space-y-5">
              {/* Aperçu + résumé */}
              <div className="flex gap-4 items-start">
                {imagePreview && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imagePreview}
                    alt="outfit"
                    className="w-24 h-32 object-cover rounded-xl border border-line shrink-0"
                  />
                )}
                <div>
                  <p className="font-display font-bold text-sm text-ink">
                    {items.length} article{items.length > 1 ? 's' : ''} détecté{items.length > 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-muted mt-1 leading-relaxed">
                    Vérifiez et ajustez les informations avant de continuer.
                    Ces articles seront pré-remplis dans le formulaire d'outfit.
                  </p>
                  <button
                    type="button"
                    onClick={handleNewPhoto}
                    className="mt-2 text-[10px] font-display font-bold tracking-widest uppercase text-terra hover:underline"
                  >
                    ↺ Utiliser une autre photo
                  </button>
                </div>
              </div>

              {/* Liste articles éditables */}
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-bone rounded-xl p-3">
                    <span className="text-lg shrink-0 w-7 text-center">
                      {OUTFIT_ITEM_CATEGORY_EMOJI[item.category] ?? '📦'}
                    </span>
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => updateItem(idx, 'name', e.target.value)}
                      placeholder="Nom de l'article"
                      className="flex-1 bg-cream border border-line rounded-lg px-3 py-1.5 text-sm outline-none focus:border-terra min-w-0"
                    />
                    <select
                      value={item.category}
                      onChange={(e) => updateItem(idx, 'category', e.target.value)}
                      className="bg-cream border border-line rounded-lg px-2 py-1.5 text-xs outline-none focus:border-terra shrink-0"
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
                        onChange={(e) => updateItem(idx, 'estimatedPriceUSD', parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="w-16 bg-cream border border-line rounded-lg px-2 py-1.5 text-sm font-display font-bold text-terra outline-none focus:border-terra text-right"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="text-muted hover:text-terra transition-colors w-6 h-6 flex items-center justify-center shrink-0"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <p className="text-[10px] text-muted text-center">
                Les articles non liés au catalogue pourront être créés depuis le formulaire d'outfit
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        {phase === 'review' && (
          <div className="p-5 border-t border-line">
            <button
              type="button"
              onClick={handleContinue}
              disabled={items.length === 0}
              className="w-full py-3 bg-terra text-cream font-display text-[10px] tracking-widest uppercase font-bold rounded-xl hover:bg-terra-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              ✓ Continuer vers le formulaire d'outfit ({items.length} article{items.length > 1 ? 's' : ''})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
