'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAdmin } from '@/components/admin/AdminProvider';
import { AdminTopBar } from '@/components/admin/AdminTopBar';
import {
  getAdminProducts,
  saveAdminProduct,
  SUBCATEGORIES,
  type StoredProduct,
} from '@/lib/admin/product-store';
import { saveProductToFirestore, getProductByIdFirestore } from '@/lib/firebase/products';
import type { Product } from '@/lib/types';
import {
  STEPS,
  type Step,
  type FormState,
  type DraftImage,
  StepInfos,
  StepVariantes,
  StepMedias,
  StepPipeline,
  StepPublication,
  FormSidebar,
} from '../../_components/product-form';

// ── Conversion Product (Firestore) → StoredProduct ───────────────────────────
function firestoreProductToStoredProduct(p: Product): StoredProduct {
  const now = new Date().toISOString();
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    category: p.category as StoredProduct['category'],
    subcategory: p.subcategory ?? '',
    priceUSD: p.priceUSD,
    oldPriceUSD: p.oldPriceUSD,
    shortDescription: p.shortDescription ?? '',
    description: p.description ?? '',
    stock: p.stock ?? 0,
    tags: p.tags ?? [],
    sizes: p.sizes ?? [],
    colors: (p.colors ?? []).map((c) => ({ label: c.name ?? '', hex: c.hex ?? '' })),
    images: (p.images ?? []).map((url, i) => ({
      id: `img-${i}`,
      originalDataUrl: url,
      processedDataUrl: url,
      hasTransparentBg: false,
      pipelineStatus: 'done' as const,
      width: 0,
      height: 0,
      sizeBytes: 0,
    })),
    videos: [],
    colorImages: {},
    brand: p.brand,
    material: p.material,
    ram: p.ram,
    connectivity: p.connectivity,
    genre: p.genre,
    modele: p.modele,
    platform: p.platform,
    deliveryMode: p.deliveryMode,
    rdcAvailability: p.rdcAvailability,
    descriptionTone: p.descriptionTone,
    status: p.status,
    badge: p.badge === 'featured' ? undefined : p.badge,
    rating: p.rating ?? 0,
    reviewCount: p.reviewCount ?? 0,
    createdAt: (p as unknown as { createdAt?: string }).createdAt ?? now,
    updatedAt: now,
  };
}

// ── Conversion StoredProduct → FormState ──────────────────────────────────────

function productToForm(p: StoredProduct): FormState {
  return {
    name: p.name,
    category: p.category,
    subcategory: p.subcategory,
    priceUSD: String(p.priceUSD),
    oldPriceUSD: p.oldPriceUSD != null ? String(p.oldPriceUSD) : '',
    shortDescription: p.shortDescription,
    description: p.description,
    stock: String(p.stock),
    tags: p.tags,
    sizes: p.sizes,
    colors: p.colors,
    // StoredImage est compatible avec DraftImage (DraftImage étend StoredImage)
    images: p.images as DraftImage[],
    videos: p.videos,
    colorImages: p.colorImages ?? {},
    brand: p.brand ?? '',
    material: p.material ?? '',
    ram: p.ram ?? [],
    connectivity: p.connectivity ?? [],
    genre: p.genre,
    modele: p.modele ?? '',
    platform: p.platform ?? '',
    deliveryMode: p.deliveryMode,
    rdcAvailability: p.rdcAvailability,
    descriptionTone: p.descriptionTone ?? 'editorial',
    status: p.status,
    badge: p.badge,
  };
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function ModifierProduitPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { currentAdmin, exchangeRate } = useAdmin();

  const [existingProduct, setExistingProduct] = useState<StoredProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>('infos');
  const [form, setForm] = useState<FormState | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Chargement : localStorage d'abord, fallback Firestore
  useEffect(() => {
    const local = getAdminProducts().find((p) => p.id === id) ?? null;
    if (local) {
      setExistingProduct(local);
      setForm(productToForm(local));
      setLoading(false);
      return;
    }
    // Produit créé sur un autre navigateur : récupérer depuis Firestore
    getProductByIdFirestore(id).then((fp) => {
      const converted = fp ? firestoreProductToStoredProduct(fp) : null;
      setExistingProduct(converted);
      if (converted) setForm(productToForm(converted));
      setLoading(false);
    });
  }, [id]);

  if (!currentAdmin) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted font-display text-sm tracking-widest uppercase">
        Chargement…
      </div>
    );
  }

  if (!existingProduct || !form) {
    return (
      <div className="p-8">
        <p className="text-muted mb-4">Produit introuvable (id : {id}).</p>
        <Link href="/admin/produits" className="text-terra hover:underline text-sm">
          ← Retour au catalogue
        </Link>
      </div>
    );
  }

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
    setForm((f) => (f ? { ...f, [key]: val } : f));

  // ── Enregistrement ─────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form) return;
    setSaving(true);
    setSaveError('');

    const now = new Date().toISOString();
    const updatedProduct: StoredProduct = {
      id: existingProduct.id,       // Conserver l'ID d'origine
      slug: existingProduct.slug,   // Conserver le slug pour ne pas casser les URLs
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
      rating: existingProduct.rating,
      reviewCount: existingProduct.reviewCount,
      createdAt: existingProduct.createdAt,
      updatedAt: now,
    };

    // 1. Mise à jour localStorage
    saveAdminProduct(updatedProduct);

    // 2. Upload images (nouvelles + re-upload des existantes) + mise à jour Firestore
    try {
      await saveProductToFirestore(updatedProduct);
      setSaving(false);
      router.push(`/admin/produits/${existingProduct.id}`);
    } catch (err: unknown) {
      const message = (err as { message?: string })?.message ?? '';
      console.error('[handleSave] Firestore save failed:', err);

      if (message.startsWith('STORAGE_UPLOAD_FAILED')) {
        const detail = message.split(':').slice(1).join(':');
        setSaveError(
          `⚠ Upload des images échoué.\n\nCause : ${detail}\n\n` +
          `Solution : déploie les règles Firebase Storage dans Firebase Console → Storage → Rules.`
        );
      } else {
        setSaveError(`Erreur lors de l'enregistrement : ${message || 'inconnue'}`);
      }
      setSaving(false);
    }
  };

  return (
    <>
      <AdminTopBar
        title={`Modifier — ${existingProduct.name}`}
        subtitle="Modifier les informations du produit"
      />

      <div className="p-8 max-w-6xl">
        {/* Lien retour */}
        <Link
          href={`/admin/produits/${existingProduct.id}`}
          className="inline-flex items-center gap-2 font-display text-[11px] tracking-widest uppercase font-semibold text-muted hover:text-ink transition-colors mb-8"
        >
          ← Retour aux détails
        </Link>

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
              {step === 'medias' && (
                <StepMedias form={form} set={set} onGeminiApplied={() => setStep('infos')} />
              )}
              {step === 'pipeline' && <StepPipeline form={form} set={set} />}
              {step === 'publication' && (
                <>
                  {saveError && (
                    <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-700 leading-relaxed whitespace-pre-line">
                      {saveError}
                    </div>
                  )}
                  <StepPublication
                    form={form}
                    set={set}
                    onPublish={handleSave}
                    saving={saving}
                    publishLabel="✓ Enregistrer les modifications"
                  />
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
                    href={`/admin/produits/${existingProduct.id}`}
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
