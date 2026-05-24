'use client';

import { useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAdmin } from '@/components/admin/AdminProvider';
import { AdminTopBar } from '@/components/admin/AdminTopBar';
import {
  createDraftId,
  saveAdminProduct,
  slugify,
  SUBCATEGORIES,
  DEFAULT_SIZES,
  type ProductCategory,
  type ProductColor,
  type StoredImage,
  type StoredVideo,
  type ImagePipelineStatus,
} from '@/lib/admin/product-store';

// ── Types locaux ──────────────────────────────────────────────────────────────

type Step = 'infos' | 'variantes' | 'medias' | 'pipeline' | 'publication';

const STEPS: { id: Step; label: string; num: number }[] = [
  { id: 'infos', label: 'Infos', num: 1 },
  { id: 'variantes', label: 'Variantes', num: 2 },
  { id: 'medias', label: 'Médias', num: 3 },
  { id: 'pipeline', label: 'Pipeline IA', num: 4 },
  { id: 'publication', label: 'Publication', num: 5 },
];

interface DraftImage extends StoredImage {
  // runtime-only fields (not persisted)
  file?: File;
  upscaleStatus?: ImagePipelineStatus;
}

interface DraftVideo extends StoredVideo {
  file?: File;
}

interface FormState {
  name: string;
  category: ProductCategory;
  subcategory: string;
  priceUSD: string;
  oldPriceUSD: string;
  shortDescription: string;
  description: string;
  stock: string;
  tags: string[];
  sizes: string[];
  colors: ProductColor[];
  images: DraftImage[];
  videos: DraftVideo[];
  status: 'active' | 'inactive' | 'featured';
}

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
  status: 'active',
};

const PRESET_COLORS: ProductColor[] = [
  { label: 'Noir', hex: '#1C1410' },
  { label: 'Blanc', hex: '#FFFCF8' },
  { label: 'Beige', hex: '#E8DDD0' },
  { label: 'Terracotta', hex: '#C8573A' },
  { label: 'Or', hex: '#D4A84B' },
  { label: 'Gris', hex: '#888888' },
  { label: 'Bleu marine', hex: '#1E3A5F' },
  { label: 'Vert kaki', hex: '#5C6B45' },
  { label: 'Bordeaux', hex: '#7C1D2A' },
  { label: 'Rose poudré', hex: '#E8BFAF' },
];

// ── Page principale ───────────────────────────────────────────────────────────

export default function NouveauProduitPage() {
  const { currentAdmin } = useAdmin();
  const router = useRouter();
  const [step, setStep] = useState<Step>('infos');
  const [form, setForm] = useState<FormState>(INITIAL);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);

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

  // ── Publish ────────────────────────────────────────────────────────────────
  const handlePublish = () => {
    setSaving(true);
    const id = createDraftId();
    const now = new Date().toISOString();
    saveAdminProduct({
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
      rating: 0,
      reviewCount: 0,
      createdAt: now,
      updatedAt: now,
    });
    setSaving(false);
    router.push('/admin/produits');
  };

  return (
    <>
      <AdminTopBar
        title="Nouveau produit"
        subtitle="Formulaire de création — 5 étapes"
      />

      <div className="p-8 max-w-4xl">
        {/* ── Stepper ──────────────────────────────────────────────────── */}
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

        {/* ── Step content ─────────────────────────────────────────────── */}
        <div className="bg-cream border border-line rounded-lg p-8">
          {step === 'infos' && (
            <StepInfos form={form} set={set} tagInput={tagInput} setTagInput={setTagInput} />
          )}
          {step === 'variantes' && <StepVariantes form={form} set={set} />}
          {step === 'medias' && <StepMedias form={form} set={set} onGeminiApplied={() => setStep('infos')} />}
          {step === 'pipeline' && <StepPipeline form={form} set={set} />}
          {step === 'publication' && (
            <StepPublication form={form} set={set} onPublish={handlePublish} saving={saving} />
          )}
        </div>

        {/* ── Navigation buttons ───────────────────────────────────────── */}
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
    </>
  );
}

// ── Step 1 : Infos de base ────────────────────────────────────────────────────

function StepInfos({
  form,
  set,
  tagInput,
  setTagInput,
}: {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  tagInput: string;
  setTagInput: (v: string) => void;
}) {
  const addTag = (tag: string) => {
    const t = tag.trim().toLowerCase();
    if (t && !form.tags.includes(t)) set('tags', [...form.tags, t]);
    setTagInput('');
  };

  return (
    <div className="space-y-6">
      <SectionTitle>Informations de base</SectionTitle>

      <FieldRow label="Nom du produit *">
        <input
          type="text"
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="ex: Veste Cargo Beige Sable"
          className={Input}
        />
      </FieldRow>

      <div className="grid grid-cols-2 gap-4">
        <FieldRow label="Catégorie *">
          <select
            value={form.category}
            onChange={(e) => {
              set('category', e.target.value as ProductCategory);
              set('subcategory', '');
              set('sizes', []);
            }}
            className={Select}
          >
            <option value="mode">Mode</option>
            <option value="telephones">Téléphones</option>
            <option value="ordinateurs">Ordinateurs</option>
            <option value="tablettes">Tablettes</option>
          </select>
        </FieldRow>

        <FieldRow label="Sous-catégorie">
          <select
            value={form.subcategory}
            onChange={(e) => set('subcategory', e.target.value)}
            className={Select}
          >
            <option value="">-- Choisir --</option>
            {SUBCATEGORIES[form.category].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </FieldRow>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FieldRow label="Prix USD *">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted font-semibold">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.priceUSD}
              onChange={(e) => set('priceUSD', e.target.value)}
              placeholder="89.00"
              className={Input + ' pl-8'}
            />
          </div>
        </FieldRow>

        <FieldRow label="Ancien prix USD (optionnel)">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted font-semibold">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.oldPriceUSD}
              onChange={(e) => set('oldPriceUSD', e.target.value)}
              placeholder="119.00"
              className={Input + ' pl-8'}
            />
          </div>
        </FieldRow>
      </div>

      <FieldRow label="Stock *">
        <input
          type="number"
          min="0"
          value={form.stock}
          onChange={(e) => set('stock', e.target.value)}
          placeholder="ex: 12"
          className={Input}
        />
      </FieldRow>

      <FieldRow label="Description courte">
        <input
          type="text"
          maxLength={120}
          value={form.shortDescription}
          onChange={(e) => set('shortDescription', e.target.value)}
          placeholder="1-2 lignes qui apparaissent sur la carte produit"
          className={Input}
        />
        <p className="text-[11px] text-muted mt-1">{form.shortDescription.length}/120</p>
      </FieldRow>

      <FieldRow label="Description complète">
        <textarea
          rows={5}
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder="Description détaillée du produit (matière, entretien, conseils de taille…)"
          className={Input}
        />
      </FieldRow>

      <FieldRow label="Tags">
        <div className="flex flex-wrap gap-2 mb-2">
          {form.tags.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1.5 text-[11px] font-medium px-3 py-1 rounded-full bg-bone border border-line"
            >
              {tag}
              <button
                type="button"
                onClick={() => set('tags', form.tags.filter((t) => t !== tag))}
                className="text-muted hover:text-terra"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                addTag(tagInput);
              }
            }}
            placeholder="Ajouter un tag (Entrée pour valider)"
            className={Input}
          />
          <button
            type="button"
            onClick={() => addTag(tagInput)}
            className="px-4 py-2 bg-bone border border-line rounded-lg text-sm hover:bg-beige transition-colors"
          >
            +
          </button>
        </div>
      </FieldRow>
    </div>
  );
}

// ── Step 2 : Variantes ────────────────────────────────────────────────────────

function StepVariantes({
  form,
  set,
}: {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
}) {
  const presetSizes = DEFAULT_SIZES[form.category];
  const [customColor, setCustomColor] = useState({ label: '', hex: '#C8573A' });

  const toggleSize = (size: string) => {
    set(
      'sizes',
      form.sizes.includes(size) ? form.sizes.filter((s) => s !== size) : [...form.sizes, size],
    );
  };

  const toggleColor = (color: ProductColor) => {
    const exists = form.colors.find((c) => c.hex === color.hex);
    set(
      'colors',
      exists ? form.colors.filter((c) => c.hex !== color.hex) : [...form.colors, color],
    );
  };

  const addCustomColor = () => {
    if (customColor.label.trim()) {
      toggleColor({ label: customColor.label.trim(), hex: customColor.hex });
      setCustomColor({ label: '', hex: '#C8573A' });
    }
  };

  return (
    <div className="space-y-8">
      <SectionTitle>Variantes du produit</SectionTitle>

      {/* Tailles */}
      <div>
        <Label>Tailles / Capacités disponibles</Label>
        <div className="flex flex-wrap gap-2 mt-3">
          {presetSizes.map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => toggleSize(size)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                form.sizes.includes(size)
                  ? 'bg-ink text-cream border-ink'
                  : 'bg-bone border-line text-muted hover:text-ink hover:border-ink'
              }`}
            >
              {size}
            </button>
          ))}
        </div>
        {form.sizes.length > 0 && (
          <p className="text-[11px] text-muted mt-2">
            {form.sizes.length} taille{form.sizes.length > 1 ? 's' : ''} sélectionnée{form.sizes.length > 1 ? 's' : ''} : {form.sizes.join(', ')}
          </p>
        )}
      </div>

      {/* Couleurs */}
      <div>
        <Label>Couleurs disponibles</Label>
        <div className="flex flex-wrap gap-3 mt-3">
          {PRESET_COLORS.map((color) => {
            const selected = form.colors.find((c) => c.hex === color.hex);
            return (
              <button
                key={color.hex}
                type="button"
                onClick={() => toggleColor(color)}
                title={color.label}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
                  selected ? 'border-ink bg-ink text-cream' : 'border-line text-muted hover:text-ink'
                }`}
              >
                <span
                  className="w-4 h-4 rounded-full border border-white/20 shrink-0"
                  style={{ backgroundColor: color.hex }}
                />
                {color.label}
              </button>
            );
          })}
        </div>

        {/* Couleur personnalisée */}
        <div className="flex items-center gap-3 mt-4 p-4 bg-bone rounded-lg border border-line">
          <input
            type="color"
            value={customColor.hex}
            onChange={(e) => setCustomColor((c) => ({ ...c, hex: e.target.value }))}
            className="w-10 h-10 rounded cursor-pointer border border-line"
          />
          <input
            type="text"
            value={customColor.label}
            onChange={(e) => setCustomColor((c) => ({ ...c, label: e.target.value }))}
            onKeyDown={(e) => e.key === 'Enter' && addCustomColor()}
            placeholder="Nom de la couleur"
            className="flex-1 bg-cream border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-terra"
          />
          <button
            type="button"
            onClick={addCustomColor}
            disabled={!customColor.label.trim()}
            className="px-4 py-2 bg-terra text-cream text-xs font-medium rounded-lg hover:bg-terra-dark disabled:opacity-40 transition-colors"
          >
            Ajouter
          </button>
        </div>

        {form.colors.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {form.colors.map((c) => (
              <span
                key={c.hex}
                className="flex items-center gap-1.5 text-[11px] px-3 py-1 rounded-full bg-cream border border-line"
              >
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: c.hex }} />
                {c.label}
                <button
                  type="button"
                  onClick={() => toggleColor(c)}
                  className="text-muted hover:text-terra"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Step 3 : Médias ───────────────────────────────────────────────────────────

function StepMedias({
  form,
  set,
  onGeminiApplied,
}: {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  onGeminiApplied?: () => void;
}) {
  const imgInputRef = useRef<HTMLInputElement>(null);
  const vidInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [geminiError, setGeminiError] = useState<string | null>(null);
  const [geminiSuccess, setGeminiSuccess] = useState(false);

  const generateWithGemini = async () => {
    if (!form.images[0]) return;
    setGeminiLoading(true);
    setGeminiError(null);
    setGeminiSuccess(false);
    try {
      const res = await fetch('/api/admin/media/describe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: form.images[0].originalDataUrl,
          category: form.category,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur serveur');
      if (data.name) set('name', data.name);
      if (data.shortDescription) set('shortDescription', data.shortDescription);
      if (data.description) set('description', data.description);
      if (data.tags?.length) set('tags', data.tags);
      setGeminiSuccess(true);
      onGeminiApplied?.();
    } catch (err) {
      setGeminiError(String(err));
    } finally {
      setGeminiLoading(false);
    }
  };

  const readImageFile = (file: File): Promise<DraftImage> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const img = new Image();
        img.onload = () =>
          resolve({
            id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            file,
            originalDataUrl: dataUrl,
            processedDataUrl: dataUrl,
            hasTransparentBg: false,
            pipelineStatus: 'idle',
            width: img.naturalWidth,
            height: img.naturalHeight,
            sizeBytes: file.size,
          });
        img.onerror = reject;
        img.src = dataUrl;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const addImages = useCallback(
    async (files: FileList | File[]) => {
      const newImgs: DraftImage[] = [];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue;
        try {
          const img = await readImageFile(file);
          newImgs.push(img);
        } catch {
          /* skip corrupt files */
        }
      }
      set('images', [...form.images, ...newImgs]);
    },
    [form.images, set],
  );

  const addVideos = (files: FileList) => {
    const newVids: DraftVideo[] = Array.from(files)
      .filter((f) => f.type.startsWith('video/'))
      .map((f) => ({
        id: `vid-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        file: f,
        name: f.name,
        sizeBytes: f.size,
        objectUrl: URL.createObjectURL(f),
      }));
    set('videos', [...form.videos, ...newVids]);
  };

  const removeImage = (id: string) => set('images', form.images.filter((i) => i.id !== id));
  const removeVideo = (id: string) => {
    const v = form.videos.find((v) => v.id === id);
    if (v?.objectUrl) URL.revokeObjectURL(v.objectUrl);
    set('videos', form.videos.filter((v) => v.id !== id));
  };

  const moveImage = (id: string, dir: -1 | 1) => {
    const imgs = [...form.images];
    const idx = imgs.findIndex((i) => i.id === id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= imgs.length) return;
    [imgs[idx], imgs[swapIdx]] = [imgs[swapIdx], imgs[idx]];
    set('images', imgs);
  };

  return (
    <div className="space-y-8">
      <SectionTitle>Médias du produit</SectionTitle>

      {/* Photos */}
      <div>
        <Label>Photos produit (JPG, PNG, WebP)</Label>
        <p className="text-xs text-muted mb-3">
          La 1ère photo est l'image principale. Le pipeline IA (étape 4) supprimera les fonds automatiquement.
        </p>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); addImages(e.dataTransfer.files); }}
          onClick={() => imgInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
            dragging ? 'border-terra bg-terra/5' : 'border-line hover:border-terra/50 hover:bg-bone/50'
          }`}
        >
          <div className="text-4xl mb-3">📸</div>
          <p className="font-display font-semibold text-sm text-ink">
            Glisser-déposer des photos ici
          </p>
          <p className="text-xs text-muted mt-1">ou cliquer pour parcourir — JPG, PNG, WebP</p>
        </div>
        <input
          ref={imgInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && addImages(e.target.files)}
        />

        {/* Gemini auto-generate */}
        {form.images.length > 0 && (
          <div className="mt-4 p-4 bg-gradient-to-r from-terra/5 to-gold/5 border border-terra/20 rounded-xl flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="font-display font-semibold text-sm text-ink">✨ Générer avec Gemini</p>
              <p className="text-xs text-muted mt-0.5">
                Gemini analysera la 1ère photo et remplira automatiquement le nom, les descriptions et les tags.
              </p>
            </div>
            <button
              type="button"
              onClick={generateWithGemini}
              disabled={geminiLoading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-terra text-cream font-display text-[11px] tracking-widest uppercase font-semibold hover:bg-terra-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              {geminiLoading ? (
                <><span className="w-3.5 h-3.5 border-2 border-cream/40 border-t-cream rounded-full animate-spin" />Analyse…</>
              ) : '✨ Générer'}
            </button>
            {geminiSuccess && (
              <p className="w-full text-xs text-emerald-600 font-medium">
                ✓ Nom, descriptions et tags remplis automatiquement ! Vérifie l'étape 1.
              </p>
            )}
            {geminiError && (
              <p className="w-full text-xs text-terra font-medium">⚠ {geminiError}</p>
            )}
          </div>
        )}

        {/* Image grid */}
        {form.images.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mt-4">
            {form.images.map((img, i) => (
              <div key={img.id} className="relative group rounded-lg overflow-hidden bg-bone aspect-square border border-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.originalDataUrl} alt="" className="w-full h-full object-cover" />
                {i === 0 && (
                  <div className="absolute top-1 left-1 bg-terra text-cream text-[9px] font-display font-bold tracking-widest uppercase px-1.5 py-0.5 rounded">
                    Principale
                  </div>
                )}
                <div className="absolute inset-0 bg-ink/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveImage(img.id, -1)}
                    disabled={i === 0}
                    className="w-7 h-7 rounded bg-white/80 text-ink text-xs disabled:opacity-30"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={() => removeImage(img.id)}
                    className="w-7 h-7 rounded bg-terra text-cream text-xs"
                  >
                    ✕
                  </button>
                  <button
                    type="button"
                    onClick={() => moveImage(img.id, 1)}
                    disabled={i === form.images.length - 1}
                    className="w-7 h-7 rounded bg-white/80 text-ink text-xs disabled:opacity-30"
                  >
                    →
                  </button>
                </div>
                <div className="absolute bottom-1 right-1 text-[9px] text-white/70 bg-black/40 px-1 rounded">
                  {img.width}×{img.height}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Vidéos */}
      <div>
        <Label>Vidéos produit (MP4, MOV — optionnel)</Label>
        <p className="text-xs text-muted mb-3">
          Les vidéos s'affichent sur la fiche produit. Stockage temporaire — nécessite Supabase Storage en production.
        </p>
        <button
          type="button"
          onClick={() => vidInputRef.current?.click()}
          className="flex items-center gap-2 px-5 py-3 border border-line rounded-lg text-sm font-medium hover:bg-bone transition-colors"
        >
          🎬 Ajouter une vidéo
        </button>
        <input
          ref={vidInputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/*"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && addVideos(e.target.files)}
        />

        {form.videos.length > 0 && (
          <div className="mt-4 space-y-2">
            {form.videos.map((v) => (
              <div key={v.id} className="flex items-center gap-3 p-3 bg-bone rounded-lg border border-line">
                {v.objectUrl && (
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <video src={v.objectUrl} className="w-16 h-12 rounded object-cover" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{v.name}</p>
                  <p className="text-[11px] text-muted">{(v.sizeBytes / 1024 / 1024).toFixed(1)} MB</p>
                </div>
                <button type="button" onClick={() => removeVideo(v.id)} className="text-muted hover:text-terra">
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Step 4 : Pipeline IA ──────────────────────────────────────────────────────

function StepPipeline({
  form,
  set,
}: {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
}) {
  const [processingAll, setProcessingAll] = useState(false);

  if (form.images.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-4xl mb-3">📸</div>
        <p className="text-muted">Aucune image uploadée. Retournez à l'étape Médias.</p>
      </div>
    );
  }

  const updateImage = (id: string, patch: Partial<DraftImage>) => {
    set(
      'images',
      form.images.map((img) => (img.id === id ? { ...img, ...patch } : img)),
    );
  };

  const runPipeline = async (imgId: string) => {
    const img = form.images.find((i) => i.id === imgId);
    if (!img || img.pipelineStatus === 'upscaling' || img.pipelineStatus === 'removing_bg') return;

    // Étape 1 : Upscale si image petite
    const needsUpscale = img.width < 1000 || img.height < 1000;
    let workingDataUrl = img.originalDataUrl;

    if (needsUpscale) {
      updateImage(imgId, { pipelineStatus: 'upscaling' });
      try {
        const scale = img.width < 500 || img.height < 500 ? 4 : 2;
        const res = await fetch('/api/admin/media/upscale', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: workingDataUrl, scale }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upscale échoué');
        workingDataUrl = data.resultBase64;
      } catch (err) {
        updateImage(imgId, {
          pipelineStatus: 'error',
          errorMessage: 'Upscale : ' + String(err),
        });
        return;
      }
    }

    // Étape 2 : Remove.bg
    updateImage(imgId, { pipelineStatus: 'removing_bg' });
    try {
      const res = await fetch('/api/admin/media/remove-bg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: workingDataUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Détourage échoué');

      updateImage(imgId, {
        pipelineStatus: 'done',
        processedDataUrl: data.resultBase64,
        hasTransparentBg: true,
        confidenceScore: data.confidenceScore,
      });
    } catch (err) {
      updateImage(imgId, {
        pipelineStatus: 'error',
        errorMessage: 'Détourage : ' + String(err),
      });
    }
  };

  const runAll = async () => {
    setProcessingAll(true);
    const pending = form.images.filter((i) => i.pipelineStatus === 'idle' || i.pipelineStatus === 'error');
    for (const img of pending) {
      await runPipeline(img.id);
    }
    setProcessingAll(false);
  };

  const skipImage = (id: string) => updateImage(id, { pipelineStatus: 'skipped' });

  const pendingCount = form.images.filter((i) => i.pipelineStatus === 'idle' || i.pipelineStatus === 'error').length;
  const doneCount = form.images.filter((i) => i.pipelineStatus === 'done' || i.pipelineStatus === 'skipped').length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <SectionTitle>Pipeline IA — Détourage automatique</SectionTitle>
          <p className="text-sm text-muted mt-1">
            Chaque image est upscalée si nécessaire, puis le fond est supprimé via Remove.bg.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted font-display tracking-widest uppercase">
            {doneCount}/{form.images.length} traitées
          </span>
          {pendingCount > 0 && (
            <button
              type="button"
              onClick={runAll}
              disabled={processingAll}
              className="font-display text-[11px] tracking-widest uppercase font-semibold px-5 py-2 rounded-full bg-terra text-cream hover:bg-terra-dark disabled:opacity-60 transition-colors flex items-center gap-2"
            >
              {processingAll ? (
                <>
                  <Spinner /> Traitement en cours…
                </>
              ) : (
                `⚡ Traiter tout (${pendingCount})`
              )}
            </button>
          )}
        </div>
      </div>

      {/* Image cards */}
      <div className="space-y-4">
        {form.images.map((img, i) => (
          <ImagePipelineCard
            key={img.id}
            img={img}
            index={i}
            onRun={() => runPipeline(img.id)}
            onSkip={() => skipImage(img.id)}
            onReset={() => updateImage(img.id, { pipelineStatus: 'idle', processedDataUrl: img.originalDataUrl, hasTransparentBg: false, confidenceScore: undefined })}
          />
        ))}
      </div>
    </div>
  );
}

function ImagePipelineCard({
  img,
  index,
  onRun,
  onSkip,
  onReset,
}: {
  img: DraftImage;
  index: number;
  onRun: () => void;
  onSkip: () => void;
  onReset: () => void;
}) {
  const isProcessing = img.pipelineStatus === 'upscaling' || img.pipelineStatus === 'removing_bg';

  const statusBadge = () => {
    switch (img.pipelineStatus) {
      case 'idle': return <Badge color="muted">En attente</Badge>;
      case 'upscaling': return <Badge color="gold" animate>Upscale IA…</Badge>;
      case 'removing_bg': return <Badge color="gold" animate>Détourage…</Badge>;
      case 'done': return <Badge color="green">✓ Traité ({img.confidenceScore}%)</Badge>;
      case 'skipped': return <Badge color="muted">Ignoré</Badge>;
      case 'error': return <Badge color="red">⚠ Erreur</Badge>;
    }
  };

  return (
    <div className={`rounded-xl border p-4 ${img.pipelineStatus === 'error' ? 'border-terra/40 bg-terra/5' : img.pipelineStatus === 'done' ? 'border-emerald-200 bg-emerald-50/40' : 'border-line bg-bone/40'}`}>
      <div className="flex gap-4 items-start">
        {/* Images côte à côte */}
        <div className="flex gap-3 shrink-0">
          {/* Original */}
          <div className="text-center">
            <div className="w-20 h-20 rounded-lg overflow-hidden bg-beige border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.originalDataUrl} alt="" className="w-full h-full object-cover" />
            </div>
            <p className="text-[9px] text-muted mt-1 font-display uppercase tracking-widest">Original</p>
          </div>

          {/* Arrow */}
          <div className="flex items-center text-muted text-lg mt-3">→</div>

          {/* Processed */}
          <div className="text-center">
            <div className="w-20 h-20 rounded-lg overflow-hidden border border-line"
              style={{ backgroundImage: 'repeating-conic-gradient(#ddd 0% 25%, white 0% 50%)', backgroundSize: '12px 12px' }}>
              {img.processedDataUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img.processedDataUrl} alt="" className="w-full h-full object-contain" />
              )}
              {isProcessing && (
                <div className="w-full h-full flex items-center justify-center">
                  <Spinner />
                </div>
              )}
            </div>
            <p className="text-[9px] text-muted mt-1 font-display uppercase tracking-widest">
              {img.pipelineStatus === 'done' ? 'Sans fond' : 'Résultat'}
            </p>
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            {index === 0 && <span className="text-[9px] font-display font-bold tracking-widest uppercase px-2 py-0.5 rounded bg-terra text-cream">Principale</span>}
            <span className="font-display font-semibold text-sm text-ink">
              Image {index + 1}
            </span>
            {statusBadge()}
          </div>

          <p className="text-[11px] text-muted">
            {img.width}×{img.height}px • {(img.sizeBytes / 1024).toFixed(0)} Ko
          </p>

          {img.pipelineStatus === 'done' && img.confidenceScore && (
            <div className="mt-2">
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-muted">Confiance :</span>
                <div className="flex-1 bg-beige rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full ${img.confidenceScore >= 90 ? 'bg-emerald-500' : img.confidenceScore >= 80 ? 'bg-gold' : 'bg-terra'}`}
                    style={{ width: `${img.confidenceScore}%` }}
                  />
                </div>
                <span className={`font-semibold ${img.confidenceScore >= 90 ? 'text-emerald-600' : img.confidenceScore >= 80 ? 'text-gold' : 'text-terra'}`}>
                  {img.confidenceScore}%
                </span>
              </div>
              {img.confidenceScore < 85 && (
                <p className="text-[10px] text-terra mt-1">⚠ Score inférieur à 85% — retouche manuelle suggérée</p>
              )}
            </div>
          )}

          {img.pipelineStatus === 'error' && (
            <p className="text-[11px] text-terra mt-1">{img.errorMessage}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 shrink-0">
          {(img.pipelineStatus === 'idle' || img.pipelineStatus === 'error') && (
            <>
              <button
                type="button"
                onClick={onRun}
                className="font-display text-[10px] tracking-widest uppercase font-semibold px-3 py-1.5 rounded-lg bg-terra text-cream hover:bg-terra-dark transition-colors"
              >
                ⚡ Traiter
              </button>
              <button
                type="button"
                onClick={onSkip}
                className="font-display text-[10px] tracking-widest uppercase font-semibold px-3 py-1.5 rounded-lg border border-line text-muted hover:text-ink transition-colors"
              >
                Passer
              </button>
            </>
          )}
          {isProcessing && (
            <div className="flex items-center gap-1 text-[10px] text-muted">
              <Spinner size="sm" />
              <span className="font-display tracking-widest uppercase">
                {img.pipelineStatus === 'upscaling' ? 'Upscale…' : 'Détourage…'}
              </span>
            </div>
          )}
          {(img.pipelineStatus === 'done' || img.pipelineStatus === 'skipped') && (
            <button
              type="button"
              onClick={onReset}
              className="font-display text-[10px] tracking-widest uppercase font-semibold px-3 py-1.5 rounded-lg border border-line text-muted hover:text-ink transition-colors"
            >
              Réinitialiser
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Step 5 : Publication ──────────────────────────────────────────────────────

function StepPublication({
  form,
  set,
  onPublish,
  saving,
}: {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  onPublish: () => void;
  saving: boolean;
}) {
  const primaryImage = form.images[0];
  const hasAiImage = form.images.some((img) => img.hasTransparentBg);
  const hasStock = parseInt(form.stock) > 0;
  const canBeFeatured = hasAiImage && hasStock;

  return (
    <div className="space-y-8">
      <SectionTitle>Récapitulatif & publication</SectionTitle>

      {/* Aperçu */}
      <div className="flex gap-6 p-5 bg-bone rounded-xl border border-line">
        {primaryImage ? (
          <div
            className="w-24 h-24 rounded-lg overflow-hidden shrink-0 border border-line"
            style={
              primaryImage.hasTransparentBg
                ? { backgroundImage: 'repeating-conic-gradient(#ddd 0% 25%, white 0% 50%)', backgroundSize: '10px 10px' }
                : {}
            }
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={primaryImage.processedDataUrl || primaryImage.originalDataUrl}
              alt=""
              className="w-full h-full object-contain"
            />
          </div>
        ) : (
          <div className="w-24 h-24 rounded-lg bg-beige border border-line flex items-center justify-center text-3xl shrink-0">
            📦
          </div>
        )}
        <div>
          <h3 className="font-display font-bold text-xl">{form.name || '(sans nom)'}</h3>
          <p className="text-muted text-sm mt-0.5">{form.subcategory || form.category}</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="font-display font-extrabold text-2xl text-terra">
              ${parseFloat(form.priceUSD || '0').toFixed(2)}
            </span>
            {form.oldPriceUSD && (
              <span className="text-muted line-through text-sm">${parseFloat(form.oldPriceUSD).toFixed(2)}</span>
            )}
          </div>
          <div className="flex gap-3 mt-2 text-[11px] text-muted">
            <span>Stock : {form.stock || '0'}</span>
            <span>•</span>
            <span>{form.images.length} photo{form.images.length > 1 ? 's' : ''}</span>
            {form.videos.length > 0 && <><span>•</span><span>{form.videos.length} vidéo{form.videos.length > 1 ? 's' : ''}</span></>}
            {hasAiImage && <><span>•</span><span className="text-emerald-600">✓ Images IA</span></>}
          </div>
        </div>
      </div>

      {/* Statut */}
      <div>
        <Label>Statut de publication</Label>
        <div className="flex flex-col gap-3 mt-3">
          {[
            { value: 'active', label: 'Actif', desc: 'Visible dans le catalogue client.', icon: '✓' },
            { value: 'inactive', label: 'Inactif', desc: 'Masqué dans le catalogue. Brouillon.', icon: '○' },
            {
              value: 'featured',
              label: 'À la une',
              desc: canBeFeatured
                ? 'Mis en avant sur la page d\'accueil.'
                : `Non disponible — nécessite : image sans fond${!hasAiImage ? ' ✕' : ' ✓'}, stock > 0${!hasStock ? ' ✕' : ' ✓'}`,
              icon: '★',
              disabled: !canBeFeatured,
            },
          ].map((opt) => (
            <label
              key={opt.value}
              className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
                (opt as { disabled?: boolean }).disabled
                  ? 'opacity-40 cursor-not-allowed'
                  : form.status === opt.value
                    ? 'border-terra bg-terra/5'
                    : 'border-line hover:border-terra/30'
              }`}
            >
              <input
                type="radio"
                name="status"
                value={opt.value}
                checked={form.status === opt.value}
                disabled={(opt as { disabled?: boolean }).disabled}
                onChange={() => set('status', opt.value as FormState['status'])}
                className="mt-0.5"
              />
              <div>
                <div className="font-display font-semibold text-sm">
                  {opt.icon} {opt.label}
                </div>
                <div className="text-[11px] text-muted mt-0.5">{opt.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Publish button */}
      <button
        type="button"
        onClick={onPublish}
        disabled={saving || !form.name || !form.priceUSD}
        className="w-full py-4 bg-terra text-cream font-display font-bold text-sm tracking-widest uppercase rounded-xl hover:bg-terra-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {saving ? <><Spinner /> Enregistrement…</> : '✓ Publier le produit'}
      </button>

      {(!form.name || !form.priceUSD) && (
        <p className="text-center text-[11px] text-muted">
          Nom et prix requis pour publier.
        </p>
      )}
    </div>
  );
}

// ── Shared UI atoms ───────────────────────────────────────────────────────────

const Input =
  'w-full px-4 py-2.5 bg-bone border border-line rounded-lg text-sm outline-none focus:border-terra transition-colors placeholder:text-muted/60';
const Select =
  'w-full px-4 py-2.5 bg-bone border border-line rounded-lg text-sm outline-none focus:border-terra cursor-pointer';

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display font-bold text-xl text-ink border-b border-line pb-4 mb-6">
      {children}
    </h2>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-display text-[11px] tracking-widest uppercase font-semibold text-muted mb-1.5">
      {children}
    </p>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Badge({
  children,
  color,
  animate,
}: {
  children: React.ReactNode;
  color: 'muted' | 'gold' | 'green' | 'red';
  animate?: boolean;
}) {
  const classes = {
    muted: 'bg-bone text-muted border-line',
    gold: 'bg-gold/15 text-[#7A5A15] border-gold/30',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    red: 'bg-terra/10 text-terra-dark border-terra/30',
  };
  return (
    <span
      className={`text-[10px] font-display font-bold tracking-widest uppercase px-2 py-0.5 rounded border flex items-center gap-1 ${classes[color]}`}
    >
      {animate && <Spinner size="sm" />}
      {children}
    </span>
  );
}

function Spinner({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const s = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
  return (
    <svg
      className={`${s} animate-spin`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

