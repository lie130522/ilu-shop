'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAdmin } from '@/components/admin/AdminProvider';
import { AdminTopBar } from '@/components/admin/AdminTopBar';
import {
  createDraftId,
  saveAdminProduct,
  slugify,
  SUBCATEGORIES,
} from '@/lib/admin/product-store';
import { saveProductToFirestore } from '@/lib/firebase/products';
import {
  STEPS,
  type Step,
  type FormState,
  StepInfos,
  StepVariantes,
  StepMedias,
  StepPipeline,
  StepPublication,
  FormSidebar,
} from '../_components/product-form';

// ── Types ─────────────────────────────────────────────────────────────────────

type Phase = 'choice' | 'gemini-upload' | 'gemini-select' | 'form';

interface DetectedArticle {
  name: string;
  category: string;
  subcategory: string;
  position: string;
  priceEstimate: number;
}

interface OutfitContext {
  itemId: string;
  itemName: string;
  itemCategory: string;
  itemPriceUSD: number;
  outfitPhoto: string | null;
  outfitState: unknown;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function outfitCatToProductCat(outfitCat: string): FormState['category'] {
  if (outfitCat === 'Tech') return 'technologie';
  if (outfitCat === 'Wearable') return 'hybrides';
  if (outfitCat === 'Service') return 'services';
  return 'mode';
}

const INITIAL: FormState = {
  name: '', category: 'mode', subcategory: '',
  priceUSD: '', oldPriceUSD: '', shortDescription: '', description: '',
  stock: '', tags: [], sizes: [], colors: [], images: [], videos: [],
  colorImages: {}, brand: '', material: '', ram: [], connectivity: [],
  genre: undefined, modele: '', platform: '', deliveryMode: undefined,
  rdcAvailability: undefined, descriptionTone: 'editorial',
  status: 'active', badge: undefined,
};

// ── Page principale ───────────────────────────────────────────────────────────

export default function NouveauProduitPage() {
  const { currentAdmin, exchangeRate } = useAdmin();
  const router = useRouter();

  // ── Phase ─────────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>('choice');

  // ── Form (phase 'form') ───────────────────────────────────────────────────
  const [step, setStep] = useState<Step>('infos');
  const [form, setForm] = useState<FormState>(INITIAL);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [publishError, setPublishError] = useState('');

  // ── Gemini (phases 'gemini-*') ────────────────────────────────────────────
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState('image/jpeg');
  const [instructions, setInstructions] = useState('');
  const [detecting, setDetecting] = useState(false);
  const [describing, setDescribing] = useState(false);
  const [detectedArticles, setDetectedArticles] = useState<DetectedArticle[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [geminiError, setGeminiError] = useState('');

  // ── Contexte outfit (depuis ItemLinkModal) ────────────────────────────────
  const [outfitContext, setOutfitContext] = useState<OutfitContext | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Init depuis sessionStorage + URL params ───────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const from = params.get('from');
    const mode = params.get('mode');

    // Contexte outfit (depuis ItemLinkModal)
    const outfitCtxRaw = sessionStorage.getItem('ilu_outfit_context');
    if (outfitCtxRaw && from === 'outfit') {
      try {
        const ctx = JSON.parse(outfitCtxRaw) as OutfitContext;
        setOutfitContext(ctx);

        if (mode === 'manual') {
          setForm((f) => ({
            ...f,
            name: ctx.itemName ?? '',
            category: outfitCatToProductCat(ctx.itemCategory ?? ''),
            subcategory: '',
            priceUSD: ctx.itemPriceUSD ? String(ctx.itemPriceUSD) : '',
            stock: '10',
          }));
          setPhase('form');
          return;
        }

        if (mode === 'gemini') {
          if (ctx.outfitPhoto) {
            setImageBase64(ctx.outfitPhoto);
            setImagePreview(ctx.outfitPhoto);
          }
          setInstructions(
            `Décris en détail l'article suivant présent dans cet outfit : "${ctx.itemName}" (catégorie : ${ctx.itemCategory}). Ignore les autres articles.`,
          );
          setPhase('gemini-upload');
          return;
        }
      } catch { /* ignore */ }
    }

    // Préfill Gemini via sessionStorage (ancien flow)
    const raw = sessionStorage.getItem('ilu_product_prefill');
    if (raw) {
      sessionStorage.removeItem('ilu_product_prefill');
      try {
        applyGeminiDataToForm(JSON.parse(raw) as Record<string, unknown>, null);
        setPhase('form');
        return;
      } catch { /* ignore */ }
    }

    // Fallback URL params
    const name = params.get('name');
    const price = params.get('price');
    const outfitCategory = params.get('outfitCategory');
    if (name || price || outfitCategory) {
      setForm((f) => ({
        ...f,
        ...(name ? { name } : {}),
        ...(price ? { priceUSD: price } : {}),
        ...(outfitCategory ? { category: outfitCatToProductCat(outfitCategory) } : {}),
      }));
      setPhase('form');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Helpers Gemini ────────────────────────────────────────────────────────

  function applyGeminiDataToForm(data: Record<string, unknown>, base64: string | null) {
    const validCats = ['mode', 'technologie', 'hybrides', 'services'];
    const validGenres = ['femme', 'homme', 'mixte', 'enfant'];

    const newImage = base64
      ? [{
          id: `gemini-${Date.now()}`,
          originalDataUrl: base64,
          processedDataUrl: base64,
          hasTransparentBg: false,
          confidenceScore: undefined,
          pipelineStatus: 'idle' as const,
          errorMessage: undefined,
          width: 0, height: 0, sizeBytes: 0,
        }]
      : undefined;

    setForm((f) => ({
      ...f,
      ...(typeof data.name === 'string' && data.name               ? { name: data.name }                                  : {}),
      ...(validCats.includes(data.category as string)              ? { category: data.category as FormState['category'] } : {}),
      ...(typeof data.subcategory === 'string'                     ? { subcategory: data.subcategory }                    : {}),
      ...(typeof data.shortDescription === 'string'                ? { shortDescription: data.shortDescription }          : {}),
      ...(typeof data.description === 'string'                     ? { description: data.description }                    : {}),
      ...(Array.isArray(data.tags)                                 ? { tags: data.tags as string[] }                      : {}),
      ...(validGenres.includes(data.genre as string)               ? { genre: data.genre as FormState['genre'] }          : {}),
      ...(typeof data.material === 'string' && data.material       ? { material: data.material }                          : {}),
      ...(typeof data.brand === 'string' && data.brand             ? { brand: data.brand }                                : {}),
      ...(typeof data.priceUSD === 'number' && data.priceUSD > 0   ? { priceUSD: String(data.priceUSD) }                  : {}),
      stock: '10',
      ...(Array.isArray(data.sizes)                                ? { sizes: data.sizes as string[] }                    : {}),
      ...(Array.isArray(data.colors)                               ? {
            colors: (data.colors as Array<{ name: string; hex: string }>)
              .map((c) => ({ label: c.name, hex: c.hex })),
          }                                                                                                                : {}),
      ...(newImage                                                 ? { images: newImage }                                  : {}),
    }));
  }

  const handleImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setImageMime(file.type);
    const reader = new FileReader();
    reader.onload = (e) => {
      const b64 = e.target?.result as string;
      setImageBase64(b64);
      setImagePreview(b64);
    };
    reader.readAsDataURL(file);
  };

  const handleDetect = async () => {
    if (!imageBase64) return;
    setDetecting(true);
    setGeminiError('');
    try {
      const res = await fetch('/api/admin/imports/detect-articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'detect',
          imageBase64,
          mimeType: imageMime,
          instructions: instructions || undefined,
        }),
      });
      const data = await res.json() as { articles?: DetectedArticle[]; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? 'Erreur Gemini');

      const articles = data.articles ?? [];
      if (articles.length === 1) {
        await handleDescribe(articles[0]);
      } else {
        setDetectedArticles(articles);
        setSelectedIdx(0);
        setPhase('gemini-select');
      }
    } catch (err) {
      setGeminiError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setDetecting(false);
    }
  };

  const handleDescribe = async (article: DetectedArticle) => {
    setDescribing(true);
    setGeminiError('');
    try {
      const res = await fetch('/api/admin/imports/detect-articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'describe',
          imageBase64,
          mimeType: imageMime,
          instructions: instructions || undefined,
          selectedArticle: { name: article.name, category: article.category, position: article.position },
        }),
      });
      const data = await res.json() as Record<string, unknown> & { error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? 'Erreur Gemini');
      applyGeminiDataToForm(data, imageBase64);
      setPhase('form');
    } catch (err) {
      setGeminiError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setDescribing(false);
    }
  };

  // ── handlePublish ─────────────────────────────────────────────────────────

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  const handlePublish = async () => {
    setSaving(true);
    setPublishError('');
    const id = createDraftId();
    const now = new Date().toISOString();
    const product = {
      id,
      slug: slugify(form.name) + '-' + id.split('-')[1],
      name: form.name,
      category: form.category,
      subcategory: form.subcategory || SUBCATEGORIES[form.category][0],
      priceUSD: parseFloat(form.priceUSD) || 0,
      oldPriceUSD: form.oldPriceUSD ? parseFloat(form.oldPriceUSD) : undefined,
      shortDescription: form.shortDescription,
      description: form.description,
      stock: parseInt(form.stock) || 0,
      tags: form.tags,
      sizes: form.sizes,
      colors: form.colors,
      status: form.status,
      badge: form.badge,
      images: form.images.map((img) => ({
        id: img.id,
        originalDataUrl: img.originalDataUrl,
        processedDataUrl: img.processedDataUrl || img.originalDataUrl,
        hasTransparentBg: img.hasTransparentBg,
        confidenceScore: img.confidenceScore,
        pipelineStatus: img.pipelineStatus,
        errorMessage: img.errorMessage,
        width: img.width,
        height: img.height,
        sizeBytes: img.sizeBytes,
      })),
      videos: form.videos.map((v) => ({ id: v.id, name: v.name, sizeBytes: v.sizeBytes })),
      colorImages: form.colorImages,
      brand: form.brand || undefined,
      material: form.material || undefined,
      ram: form.ram.length > 0 ? form.ram : undefined,
      connectivity: form.connectivity.length > 0 ? form.connectivity : undefined,
      genre: form.genre,
      modele: form.modele || undefined,
      platform: form.platform || undefined,
      deliveryMode: form.deliveryMode,
      rdcAvailability: form.rdcAvailability,
      descriptionTone: form.descriptionTone || undefined,
      rating: 0, reviewCount: 0,
      createdAt: now, updatedAt: now,
    };

    saveAdminProduct(product);

    try {
      await saveProductToFirestore(product);
      setSaving(false);

      // Retour vers l'outfit si création depuis le showroom
      const outfitCtxRaw = sessionStorage.getItem('ilu_outfit_context');
      if (outfitCtxRaw) {
        sessionStorage.removeItem('ilu_outfit_context');
        try {
          const ctx = JSON.parse(outfitCtxRaw) as OutfitContext;
          sessionStorage.setItem('ilu_outfit_return', JSON.stringify({
            newProductId: product.id,
            newProductSlug: product.slug,
            newProductName: product.name,
            newProductImageUrl: product.images[0]?.processedDataUrl ?? '',
            linkedItemId: ctx.itemId,
            savedState: ctx.outfitState,
          }));
          router.push('/admin/showroom/nouveau');
          return;
        } catch { /* ignore, redirect to produits */ }
      }

      router.push('/admin/produits');
    } catch (err: unknown) {
      const message = (err as { message?: string })?.message ?? '';
      console.error('[handlePublish] Firestore save failed:', err);
      if (message.startsWith('STORAGE_UPLOAD_FAILED')) {
        const detail = message.split(':').slice(1).join(':');
        setPublishError(
          `⚠ Upload des images échoué.\n\nCause : ${detail}\n\n` +
          `Solution : va dans Firebase Console → Storage → Rules et assure-toi que les règles sont déployées.`,
        );
      } else {
        setPublishError(`Erreur lors de la publication : ${message || 'inconnue'}`);
      }
      setSaving(false);
    }
  };

  if (!currentAdmin) return null;

  // ─────────────────────────────────────────────────────────────────────────
  // ── Phase : choice ────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────
  if (phase === 'choice') {
    return (
      <>
        <AdminTopBar title="Nouveau produit" subtitle="Choisissez votre méthode de création" />
        <div className="p-8 max-w-3xl">
          {outfitContext && (
            <div className="mb-6 bg-terra/5 border border-terra/20 rounded-xl px-4 py-3 text-sm text-ink">
              <span className="font-semibold">Depuis l'outfit :</span>{' '}
              Création de l'article <span className="text-terra font-semibold">"{outfitContext.itemName}"</span> —
              vous serez redirigé vers l'outfit après la publication.
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-5">
            {/* Créer manuellement */}
            <button
              type="button"
              onClick={() => {
                if (outfitContext) {
                  setForm((f) => ({
                    ...f,
                    name: outfitContext.itemName ?? '',
                    category: outfitCatToProductCat(outfitContext.itemCategory ?? ''),
                    priceUSD: outfitContext.itemPriceUSD ? String(outfitContext.itemPriceUSD) : '',
                    stock: '10',
                  }));
                }
                setPhase('form');
              }}
              className="flex flex-col gap-4 p-8 bg-cream border-2 border-line rounded-2xl hover:border-ink transition-all text-left group"
            >
              <div className="w-14 h-14 bg-bone rounded-xl flex items-center justify-center text-2xl">📝</div>
              <div>
                <h3 className="font-display font-bold text-lg text-ink mb-1">Créer manuellement</h3>
                <p className="text-sm text-muted font-light leading-relaxed">
                  Remplissez vous-même les 5 étapes du formulaire.
                  {outfitContext && (
                    <span className="block mt-1 text-ink/70">
                      Nom, catégorie et prix pré-remplis depuis l'outfit.
                    </span>
                  )}
                </p>
              </div>
              <span className="font-display text-[10px] tracking-widest uppercase font-semibold text-muted group-hover:text-ink transition-colors">
                Formulaire vierge →
              </span>
            </button>

            {/* Créer avec Gemini */}
            <button
              type="button"
              onClick={() => {
                if (outfitContext?.outfitPhoto) {
                  setImageBase64(outfitContext.outfitPhoto);
                  setImagePreview(outfitContext.outfitPhoto);
                  setInstructions(
                    `Décris en détail l'article suivant présent dans cet outfit : "${outfitContext.itemName}" (catégorie : ${outfitContext.itemCategory}). Ignore les autres articles.`,
                  );
                }
                setPhase('gemini-upload');
              }}
              className="flex flex-col gap-4 p-8 bg-ink border-2 border-ink rounded-2xl hover:bg-terra hover:border-terra transition-all text-left group"
            >
              <div className="w-14 h-14 bg-white/10 rounded-xl flex items-center justify-center text-2xl">✨</div>
              <div>
                <h3 className="font-display font-bold text-lg text-cream mb-1">Créer avec Gemini</h3>
                <p className="text-sm text-cream/70 font-light leading-relaxed">
                  Importez une photo — Gemini détecte l'article et pré-remplit tout le formulaire automatiquement.
                  {outfitContext && (
                    <span className="block mt-1 text-cream/90">
                      La photo de l'outfit sera pré-chargée.
                    </span>
                  )}
                </p>
              </div>
              <span className="font-display text-[10px] tracking-widest uppercase font-semibold text-cream/70 group-hover:text-cream transition-colors">
                Analyser une photo →
              </span>
            </button>
          </div>
        </div>
      </>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ── Phase : gemini-upload ─────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────
  if (phase === 'gemini-upload') {
    return (
      <>
        <AdminTopBar title="Analyser avec Gemini" subtitle="Importez une photo puis validez l'analyse" />
        <div className="p-8 max-w-2xl space-y-6">

          <button
            type="button"
            onClick={() => { setGeminiError(''); setPhase('choice'); }}
            className="font-display text-[11px] tracking-widest uppercase font-semibold text-muted hover:text-ink transition-colors"
          >
            ← Retour
          </button>

          {/* Upload zone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleImageFile(f); }}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-line rounded-2xl overflow-hidden cursor-pointer hover:border-terra hover:bg-terra/5 transition-colors"
          >
            {imagePreview ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagePreview} alt="aperçu" className="w-full max-h-64 object-contain bg-bone" />
                <div className="absolute inset-0 bg-ink/0 hover:bg-ink/20 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
                  <span className="bg-cream rounded-full px-4 py-2 font-display text-[10px] tracking-widest uppercase font-bold text-ink">
                    Changer la photo
                  </span>
                </div>
              </div>
            ) : (
              <div className="py-14 flex flex-col items-center gap-3">
                <span className="text-4xl">📷</span>
                <span className="font-display text-sm font-semibold text-muted">
                  Déposer une photo du produit
                </span>
                <span className="text-xs text-muted/60">JPG, PNG, WEBP — ou cliquer pour parcourir</span>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageFile(f); e.target.value = ''; }}
          />

          {/* Instructions */}
          <div>
            <label className="block font-display text-[10px] tracking-widest uppercase font-semibold text-muted mb-2">
              Instructions à Gemini <span className="text-muted/50 font-normal normal-case tracking-normal">(optionnel)</span>
            </label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Ex: Focus sur la veste bleue, ignore les chaussures. C'est un vêtement homme haut de gamme."
              rows={3}
              className="w-full bg-cream border border-line rounded-xl px-4 py-3 text-sm outline-none focus:border-terra resize-none placeholder:text-muted/50"
            />
          </div>

          {geminiError && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700 flex gap-2 items-start">
              <span className="shrink-0">⚠</span>
              <div>
                <p className="font-semibold mb-0.5">Analyse échouée</p>
                <p>{geminiError}</p>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleDetect}
            disabled={!imageBase64 || detecting}
            className="w-full py-4 bg-ink text-cream font-display text-[11px] tracking-widest uppercase font-bold rounded-xl hover:bg-terra disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-3"
          >
            {detecting ? (
              <>
                <span className="w-4 h-4 border-2 border-cream/30 border-t-cream rounded-full animate-spin" />
                Analyse en cours…
              </>
            ) : (
              '✨ Analyser avec Gemini →'
            )}
          </button>

          <p className="text-[10px] text-muted text-center">
            Si la photo contient plusieurs articles, Gemini vous demandera lequel cibler.
          </p>
        </div>
      </>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ── Phase : gemini-select ─────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────
  if (phase === 'gemini-select') {
    return (
      <>
        <AdminTopBar
          title={`${detectedArticles.length} articles détectés`}
          subtitle="Sélectionnez l'article que vous souhaitez créer"
        />
        <div className="p-8 max-w-2xl space-y-6">

          <button
            type="button"
            onClick={() => { setGeminiError(''); setPhase('gemini-upload'); }}
            className="font-display text-[11px] tracking-widest uppercase font-semibold text-muted hover:text-ink transition-colors"
          >
            ← Retour
          </button>

          {/* Aperçu de la photo */}
          {imagePreview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imagePreview} alt="photo analysée" className="w-full max-h-48 object-contain rounded-xl border border-line bg-bone" />
          )}

          {/* Liste des articles */}
          <div className="space-y-2">
            {detectedArticles.map((article, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedIdx(idx)}
                className={`w-full flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                  selectedIdx === idx
                    ? 'border-terra bg-terra/5'
                    : 'border-line bg-cream hover:border-ink/40'
                }`}
              >
                {/* Radio indicator */}
                <div className={`mt-0.5 w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
                  selectedIdx === idx ? 'border-terra' : 'border-line'
                }`}>
                  {selectedIdx === idx && (
                    <div className="w-2.5 h-2.5 rounded-full bg-terra" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-display font-bold text-sm text-ink">{article.name}</span>
                    <span className="text-[10px] text-muted font-display tracking-widest uppercase">
                      {article.category} · {article.subcategory}
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-1 italic">📍 {article.position}</p>
                  <p className="text-xs text-terra font-display font-bold mt-0.5">
                    ~${article.priceEstimate}
                  </p>
                </div>
              </button>
            ))}
          </div>

          {geminiError && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700">
              ⚠ {geminiError}
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              if (selectedIdx !== null) handleDescribe(detectedArticles[selectedIdx]);
            }}
            disabled={selectedIdx === null || describing}
            className="w-full py-4 bg-terra text-cream font-display text-[11px] tracking-widest uppercase font-bold rounded-xl hover:bg-terra-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-3"
          >
            {describing ? (
              <>
                <span className="w-4 h-4 border-2 border-cream/30 border-t-cream rounded-full animate-spin" />
                Génération de la fiche…
              </>
            ) : (
              '✓ Créer cet article →'
            )}
          </button>
        </div>
      </>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ── Phase : form (5 étapes) ───────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────
  const stepIndex = STEPS.findIndex((s) => s.id === step);

  const goNext = () => { const next = STEPS[stepIndex + 1]; if (next) setStep(next.id); };
  const goPrev = () => { const prev = STEPS[stepIndex - 1]; if (prev) setStep(prev.id); };

  return (
    <>
      <AdminTopBar
        title="Nouveau produit"
        subtitle={outfitContext ? `Création pour l'outfit · ${outfitContext.itemName}` : 'Formulaire de création — 5 étapes'}
      />

      <div className="p-8 max-w-6xl">
        {outfitContext && (
          <div className="mb-6 bg-terra/5 border border-terra/20 rounded-xl px-4 py-2.5 text-xs text-ink flex items-center gap-2">
            <span>🔗</span>
            <span>
              Après publication, vous serez redirigé vers l'outfit et l'article sera automatiquement lié.
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-8 items-start">
          <div>
            {/* Stepper */}
            <div className="flex items-center gap-0 mb-10">
              {STEPS.map((s, i) => (
                <div key={s.id} className="flex items-center flex-1 last:flex-none">
                  <button type="button" onClick={() => setStep(s.id)} className="flex flex-col items-center gap-1 group">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-display font-bold text-sm transition-colors ${
                      s.id === step ? 'bg-terra text-cream' : stepIndex > i ? 'bg-ink text-cream' : 'bg-bone border border-line text-muted'
                    }`}>
                      {stepIndex > i ? '✓' : s.num}
                    </div>
                    <span className={`font-display text-[10px] tracking-widest uppercase font-semibold ${
                      s.id === step ? 'text-terra' : stepIndex > i ? 'text-ink' : 'text-muted'
                    }`}>
                      {s.label}
                    </span>
                  </button>
                  {i < STEPS.length - 1 && (
                    <div className={`flex-1 h-px mx-2 mb-5 transition-colors ${stepIndex > i ? 'bg-ink' : 'bg-line'}`} />
                  )}
                </div>
              ))}
            </div>

            {/* Step content */}
            <div className="bg-cream border border-line rounded-lg p-8">
              {step === 'infos' && (
                <StepInfos form={form} set={set} tagInput={tagInput} setTagInput={setTagInput} exchangeRate={exchangeRate} />
              )}
              {step === 'variantes' && <StepVariantes form={form} set={set} />}
              {step === 'medias' && <StepMedias form={form} set={set} onGeminiApplied={() => setStep('infos')} />}
              {step === 'pipeline' && <StepPipeline form={form} set={set} />}
              {step === 'publication' && (
                <>
                  {publishError && (
                    <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-700 leading-relaxed whitespace-pre-line">
                      {publishError}
                    </div>
                  )}
                  <StepPublication form={form} set={set} onPublish={handlePublish} saving={saving} />
                </>
              )}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between mt-6">
              <div>
                {stepIndex > 0 ? (
                  <button type="button" onClick={goPrev}
                    className="font-display text-[11px] tracking-widest uppercase font-semibold px-6 py-2.5 rounded-full border border-line text-muted hover:text-ink hover:border-ink transition-colors">
                    ← Précédent
                  </button>
                ) : (
                  <button type="button" onClick={() => setPhase('choice')}
                    className="font-display text-[11px] tracking-widest uppercase font-semibold text-muted hover:text-ink transition-colors">
                    ← Retour au choix
                  </button>
                )}
              </div>
              {step !== 'publication' && (
                <button type="button" onClick={goNext}
                  disabled={step === 'infos' && (!form.name || !form.priceUSD)}
                  className="font-display text-[11px] tracking-widest uppercase font-semibold px-6 py-2.5 rounded-full bg-ink text-cream hover:bg-terra disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  Suivant →
                </button>
              )}
            </div>
          </div>

          <FormSidebar form={form} stepIndex={stepIndex} />
        </div>
      </div>
    </>
  );
}
