'use client';

import { useState, useEffect } from 'react';
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

// ── Map catégorie outfit → catégorie produit ──────────────────────────────────

function outfitCatToProductCat(outfitCat: string): FormState['category'] {
  if (outfitCat === 'Tech') return 'technologie';
  if (outfitCat === 'Wearable') return 'hybrides';
  if (outfitCat === 'Service') return 'services';
  return 'mode';
}

// ── Valeur initiale ───────────────────────────────────────────────────────────

const INITIAL: FormState = {
  name: '',
  category: 'mode',
  subcategory: '',
  priceUSD: '',
  oldPriceUSD: '',
  shortDescription: '',
  description: '',
  stock: '',
  tags: [],
  sizes: [],
  colors: [],
  images: [],
  videos: [],
  colorImages: {},
  brand: '',
  material: '',
  ram: [],
  connectivity: [],
  genre: undefined,
  modele: '',
  platform: '',
  deliveryMode: undefined,
  rdcAvailability: undefined,
  descriptionTone: 'editorial',
  status: 'active',
  badge: undefined,
};

// ── Page principale ───────────────────────────────────────────────────────────

export default function NouveauProduitPage() {
  const { currentAdmin, exchangeRate } = useAdmin();
  const router = useRouter();
  const [step, setStep] = useState<Step>('infos');
  const [form, setForm] = useState<FormState>(INITIAL);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [publishError, setPublishError] = useState('');

  useEffect(() => {
    // Préfill depuis Gemini (via sessionStorage — ItemLinkModal ou OutfitImportModal)
    const raw = sessionStorage.getItem('ilu_product_prefill');
    if (raw) {
      sessionStorage.removeItem('ilu_product_prefill');
      try {
        const data = JSON.parse(raw) as Record<string, unknown>;
        const validCats = ['mode', 'technologie', 'hybrides', 'services'];
        const validGenres = ['femme', 'homme', 'mixte', 'enfant'];
        setForm((f) => ({
          ...f,
          ...(typeof data.name === 'string' && data.name         ? { name: data.name }                                  : {}),
          ...(validCats.includes(data.category as string)        ? { category: data.category as FormState['category'] } : {}),
          ...(typeof data.subcategory === 'string'               ? { subcategory: data.subcategory }                    : {}),
          ...(typeof data.shortDescription === 'string'          ? { shortDescription: data.shortDescription }          : {}),
          ...(typeof data.description === 'string'               ? { description: data.description }                    : {}),
          ...(Array.isArray(data.tags)                           ? { tags: (data.tags as string[]) }                    : {}),
          ...(validGenres.includes(data.genre as string)         ? { genre: data.genre as FormState['genre'] }          : {}),
          ...(typeof data.material === 'string' && data.material ? { material: data.material }                          : {}),
          ...(typeof data.priceUSD === 'number' && data.priceUSD ? { priceUSD: String(data.priceUSD) }                  : {}),
        }));
        return; // préfill sessionStorage a priorité — on ignore les URL params
      } catch { /* ignore */ }
    }

    // Fallback : URL params (outfitCategory uniquement pour les anciens liens)
    const params = new URLSearchParams(window.location.search);
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
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!currentAdmin) return null;

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  const goNext = () => {
    const next = STEPS[stepIndex + 1];
    if (next) setStep(next.id);
  };
  const goPrev = () => {
    const prev = STEPS[stepIndex - 1];
    if (prev) setStep(prev.id);
  };

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
      videos: form.videos.map((v) => ({
        id: v.id,
        name: v.name,
        sizeBytes: v.sizeBytes,
      })),
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
      rating: 0,
      reviewCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    // 1. Sauvegarde locale immédiate
    saveAdminProduct(product);

    // 2. Upload images + Firestore
    try {
      await saveProductToFirestore(product);
      setSaving(false);
      router.push('/admin/produits');
    } catch (err: unknown) {
      const message = (err as { message?: string })?.message ?? '';
      console.error('[handlePublish] Firestore save failed:', err);
      if (message.startsWith('STORAGE_UPLOAD_FAILED')) {
        const detail = message.split(':').slice(1).join(':');
        setPublishError(
          `⚠ Upload des images échoué.\n\n` +
          `Cause : ${detail}\n\n` +
          `Solution : va dans Firebase Console → Storage → Rules et assure-toi que les règles sont déployées. ` +
          `Copie le contenu du fichier storage.rules de ton projet et colle-le dans Firebase Console.`
        );
      } else {
        setPublishError(`Erreur lors de la publication : ${message || 'inconnue'}`);
      }
      setSaving(false);
    }
  };

  return (
    <>
      <AdminTopBar
        title="Nouveau produit"
        subtitle="Formulaire de création — 5 étapes"
      />

      <div className="p-8 max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-8 items-start">

          {/* ── Colonne principale ─────────────────────────────────────── */}
          <div>
            {/* Stepper */}
            <div className="flex items-center gap-0 mb-10">
              {STEPS.map((s, i) => (
                <div key={s.id} className="flex items-center flex-1 last:flex-none">
                  <button
                    type="button"
                    onClick={() => setStep(s.id)}
                    className="flex flex-col items-center gap-1 group"
                  >
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center font-display font-bold text-sm transition-colors ${
                        s.id === step
                          ? 'bg-terra text-cream'
                          : stepIndex > i
                            ? 'bg-ink text-cream'
                            : 'bg-bone border border-line text-muted'
                      }`}
                    >
                      {stepIndex > i ? '✓' : s.num}
                    </div>
                    <span
                      className={`font-display text-[10px] tracking-widest uppercase font-semibold ${
                        s.id === step ? 'text-terra' : stepIndex > i ? 'text-ink' : 'text-muted'
                      }`}
                    >
                      {s.label}
                    </span>
                  </button>
                  {i < STEPS.length - 1 && (
                    <div
                      className={`flex-1 h-px mx-2 mb-5 transition-colors ${stepIndex > i ? 'bg-ink' : 'bg-line'}`}
                    />
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

            {/* Navigation buttons */}
            <div className="flex items-center justify-between mt-6">
              <div>
                {stepIndex > 0 ? (
                  <button
                    type="button"
                    onClick={goPrev}
                    className="font-display text-[11px] tracking-widest uppercase font-semibold px-6 py-2.5 rounded-full border border-line text-muted hover:text-ink hover:border-ink transition-colors"
                  >
                    ← Précédent
                  </button>
                ) : (
                  <Link
                    href="/admin/produits"
                    className="font-display text-[11px] tracking-widest uppercase font-semibold text-muted hover:text-ink transition-colors"
                  >
                    ← Annuler
                  </Link>
                )}
              </div>
              {step !== 'publication' && (
                <button
                  type="button"
                  onClick={goNext}
                  disabled={step === 'infos' && (!form.name || !form.priceUSD)}
                  className="font-display text-[11px] tracking-widest uppercase font-semibold px-6 py-2.5 rounded-full bg-ink text-cream hover:bg-terra disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Suivant →
                </button>
              )}
            </div>
          </div>

          {/* ── Sidebar ────────────────────────────────────────────────── */}
          <FormSidebar form={form} stepIndex={stepIndex} />

        </div>
      </div>
    </>
  );
}
