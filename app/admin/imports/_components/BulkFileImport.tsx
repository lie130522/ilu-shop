'use client';

import { useState, useRef, useCallback } from 'react';
import { ref as storageRef, uploadString, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase/client';
import {
  saveAdminProduct,
  slugify,
  type StoredProduct,
  type ProductCategory,
  type ProductColor,
} from '@/lib/admin/product-store';
import { saveProductToFirestore } from '@/lib/firebase/products';

// ── Constantes ────────────────────────────────────────────────────────────────

const CATEGORIES: { value: ProductCategory; label: string }[] = [
  { value: 'mode',        label: 'Mode' },
  { value: 'technologie', label: 'Technologie' },
  { value: 'hybrides',    label: 'Hybrides' },
  { value: 'services',    label: 'Services' },
];

const SUBCATEGORIES: Record<ProductCategory, string[]> = {
  mode:        ['Vêtements', 'Chaussures', 'Bijoux & accessoires classiques', 'Maroquinerie', 'Parfums & beauté'],
  technologie: ['Téléphonie', 'Informatique', 'Accessoires tech'],
  hybrides:    ['Wearables / accessoires connectés'],
  services:    ['Abonnements plateformes', 'Forfaits data'],
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface ColorVariant {
  sourceId:   string;
  label:      string;    // ex: "Marine"
  hex:        string;    // ex: "#1B2A4A"
  previewUrl: string;
  base64?:    string;
  file:       File;
}

interface ImportedFile {
  id:           string;
  file:         File;
  previewUrl:   string;
  base64?:      string;
  status:       'pending' | 'analyzing' | 'ready' | 'error' | 'saving' | 'saved' | 'merged';
  error?:       string;
  // Champs produit
  name:             string;
  category:         ProductCategory;
  subcategory:      string;
  shortDescription: string;
  description:      string;
  priceUSD:         number;
  tags:             string;
  genre:            string;
  // Variantes couleur (quand cet item est le "primaire" d'un groupe fusionné)
  colorVariants?:   ColorVariant[];
  // Groupe de similarité (détecté automatiquement après analyse)
  similarGroup?:    string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function nameFromFilename(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, '')
    .replace(/whatsapp image \d{4}-\d{2}-\d{2} at .+/i, '')
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    || 'Nouveau produit';
}

function defaultFile(file: File): ImportedFile {
  return {
    id: genId(), file,
    previewUrl: URL.createObjectURL(file),
    status: 'pending',
    name: nameFromFilename(file.name),
    category: 'mode', subcategory: 'Vêtements',
    shortDescription: '', description: '', priceUSD: 0, tags: '', genre: 'mixte',
  };
}

/** Après analyse, recalcule les groupes de similarité dans le tableau complet */
function recomputeSimilarity(files: ImportedFile[]): ImportedFile[] {
  const groups: Record<string, string[]> = {};
  files.forEach((f) => {
    if (f.status !== 'ready' && f.status !== 'merged') return;
    const key = `${f.category}::${f.subcategory}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(f.id);
  });
  return files.map((f) => {
    const key = `${f.category}::${f.subcategory}`;
    const group = groups[key];
    return { ...f, similarGroup: group && group.length >= 2 ? key : undefined };
  });
}

// ── Composant principal ───────────────────────────────────────────────────────

export function BulkFileImport() {
  const [files, setFiles]           = useState<ImportedFile[]>([]);
  const [dragging, setDragging]     = useState(false);
  const [importingAll, setImporting]= useState(false);
  const [importProgress, setProgress] = useState({ done: 0, total: 0 });
  // Sélection pour fusion
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showMergeModal, setShowMergeModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Mise à jour d'un fichier ───────────────────────────────────────────────

  const updateFile = useCallback(<K extends keyof ImportedFile>(
    id: string, key: K, val: ImportedFile[K],
  ) => {
    setFiles((prev) => prev.map((f) => f.id === id ? { ...f, [key]: val } : f));
  }, []);

  // ── Analyse Gemini ─────────────────────────────────────────────────────────

  const analyzeFile = useCallback(async (item: ImportedFile) => {
    updateFile(item.id, 'status', 'analyzing');
    try {
      const base64 = await fileToBase64(item.file);
      const res = await fetch('/api/admin/imports/analyze-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, filename: item.file.name, mimeType: item.file.type }),
      });
      const data = await res.json() as Record<string, unknown>;
      if (!res.ok || data.error) throw new Error(String(data.error ?? 'Gemini error'));

      const cat = (['mode','technologie','hybrides','services'] as const).find((c) => c === data.category) ?? 'mode';
      const sub = typeof data.subcategory === 'string' && SUBCATEGORIES[cat].includes(data.subcategory)
        ? data.subcategory : SUBCATEGORIES[cat][0];

      setFiles((prev) => {
        const updated = prev.map((f) => f.id === item.id ? {
          ...f, base64, status: 'ready' as const,
          name:             typeof data.name === 'string'             ? data.name             : f.name,
          category:         cat,
          subcategory:      sub,
          shortDescription: typeof data.shortDescription === 'string' ? data.shortDescription : '',
          description:      typeof data.description === 'string'      ? data.description      : '',
          priceUSD:         typeof data.priceUSD === 'number'         ? data.priceUSD         : f.priceUSD,
          tags:             Array.isArray(data.tags)                  ? (data.tags as string[]).join(', ') : f.tags,
          genre:            typeof data.genre === 'string'            ? data.genre            : 'mixte',
        } : f);
        return recomputeSimilarity(updated);
      });
    } catch (err) {
      setFiles((prev) => prev.map((f) =>
        f.id === item.id ? { ...f, status: 'error', error: err instanceof Error ? err.message : 'Erreur' } : f,
      ));
    }
  }, [updateFile]);

  // ── Ajout de fichiers ──────────────────────────────────────────────────────

  const addFiles = useCallback((rawFiles: File[]) => {
    const imgs = rawFiles.filter((f) => f.type.startsWith('image/'));
    if (imgs.length === 0) return;
    const items = imgs.map(defaultFile);
    setFiles((prev) => [...prev, ...items]);
    // Lots de 3 + délai pour éviter le rate-limiting Gemini
    const BATCH = 3;
    (async () => {
      for (let i = 0; i < items.length; i += BATCH) {
        await Promise.allSettled(items.slice(i, i + BATCH).map((it) => analyzeFile(it)));
        if (i + BATCH < items.length) await new Promise((r) => setTimeout(r, 800));
      }
    })();
  }, [analyzeFile]);

  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setDragging(false); addFiles(Array.from(e.dataTransfer.files)); };
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files) addFiles(Array.from(e.target.files)); e.target.value = ''; };

  const removeFile = (id: string) => {
    setFiles((prev) => {
      const f = prev.find((x) => x.id === id);
      if (f) URL.revokeObjectURL(f.previewUrl);
      // Libérer les variantes fusionnées aussi
      f?.colorVariants?.forEach((v) => URL.revokeObjectURL(v.previewUrl));
      return recomputeSimilarity(prev.filter((x) => x.id !== id && x.status !== 'merged' || x.id !== id));
    });
    setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
  };

  const retryAnalyze = (item: ImportedFile) => analyzeFile({ ...item, status: 'pending' });

  // ── Sélection ─────────────────────────────────────────────────────────────

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const cancelSelect = () => { setSelectMode(false); setSelectedIds(new Set()); };

  // Sélectionner tous les items d'un groupe similaire
  const selectSimilarGroup = (group: string) => {
    setSelectMode(true);
    const ids = files.filter((f) => f.similarGroup === group && f.status !== 'merged').map((f) => f.id);
    setSelectedIds(new Set(ids));
  };

  // ── Fusion ────────────────────────────────────────────────────────────────

  const handleMerge = (primaryId: string, variants: { sourceId: string; label: string; hex: string }[]) => {
    setFiles((prev) => {
      const variantIds = new Set(variants.map((v) => v.sourceId));
      const colorVariants: ColorVariant[] = variants.map((v) => {
        const src = prev.find((f) => f.id === v.sourceId)!;
        return { sourceId: v.sourceId, label: v.label, hex: v.hex, previewUrl: src.previewUrl, base64: src.base64, file: src.file };
      });
      return recomputeSimilarity(prev.map((f) => {
        if (f.id === primaryId) return { ...f, colorVariants };
        if (variantIds.has(f.id) && f.id !== primaryId) return { ...f, status: 'merged' as const };
        return f;
      }));
    });
    setSelectedIds(new Set());
    setSelectMode(false);
    setShowMergeModal(false);
  };

  const unmerge = (primaryId: string) => {
    setFiles((prev) => {
      const primary = prev.find((f) => f.id === primaryId);
      const variantIds = new Set(primary?.colorVariants?.map((v) => v.sourceId) ?? []);
      return recomputeSimilarity(prev.map((f) => {
        if (f.id === primaryId) return { ...f, colorVariants: undefined };
        if (variantIds.has(f.id)) return { ...f, status: 'ready' as const };
        return f;
      }));
    });
  };

  // ── Import ────────────────────────────────────────────────────────────────

  const importAll = async () => {
    const toImport = files.filter((f) => f.status === 'ready');
    if (toImport.length === 0) return;
    setImporting(true);
    setProgress({ done: 0, total: toImport.length });

    for (const item of toImport) {
      updateFile(item.id, 'status', 'saving');
      try {
        const id = genId();
        const base64 = item.base64 ?? await fileToBase64(item.file);
        const slug = slugify(item.name) + '-' + id.slice(-6);
        const now = new Date().toISOString();

        // Upload image principale
        const imgRef = storageRef(storage, `products/${id}/image-0`);
        await uploadString(imgRef, base64, 'data_url', { contentType: item.file.type || 'image/jpeg' });
        const imageUrl = await getDownloadURL(imgRef);

        // Upload images par couleur (si produit fusionné)
        const colors: ProductColor[] = [];
        const colorImageUrls: Record<string, string> = {};
        if (item.colorVariants && item.colorVariants.length > 0) {
          for (const variant of item.colorVariants) {
            const vBase64 = variant.base64 ?? await fileToBase64(variant.file);
            const vRef = storageRef(storage, `products/${id}/color-${variant.hex.replace('#', '')}`);
            await uploadString(vRef, vBase64, 'data_url');
            const vUrl = await getDownloadURL(vRef);
            colors.push({ label: variant.label, hex: variant.hex });
            colorImageUrls[variant.hex] = vUrl;
          }
        }

        const product: StoredProduct = {
          id, slug,
          name: item.name,
          category: item.category,
          subcategory: item.subcategory,
          priceUSD: item.priceUSD,
          shortDescription: item.shortDescription,
          description: item.description,
          stock: 10,
          tags: item.tags.split(',').map((t) => t.trim()).filter(Boolean),
          sizes: [],
          colors,
          colorImages: colorImageUrls,
          images: [{
            id: 'bulk-0',
            originalDataUrl: imageUrl,
            processedDataUrl: imageUrl,
            hasTransparentBg: false,
            pipelineStatus: 'done',
            width: 0, height: 0, sizeBytes: 0,
          }],
          videos: [],
          genre: item.genre as StoredProduct['genre'],
          status: 'active',
          rating: 0, reviewCount: 0,
          createdAt: now, updatedAt: now,
        };

        saveAdminProduct(product);
        await saveProductToFirestore(product);
        updateFile(item.id, 'status', 'saved');
        setProgress((p) => ({ ...p, done: p.done + 1 }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Import échoué';
        setFiles((prev) => prev.map((f) => f.id === item.id ? { ...f, status: 'error', error: msg } : f));
      }
    }
    setImporting(false);
  };

  // ── Stats (items visibles uniquement, pas les merged) ──────────────────────

  const visible = files.filter((f) => f.status !== 'merged');
  const stats = {
    total:     visible.length,
    analyzing: visible.filter((f) => f.status === 'analyzing').length,
    ready:     visible.filter((f) => f.status === 'ready').length,
    error:     visible.filter((f) => f.status === 'error').length,
    saved:     visible.filter((f) => f.status === 'saved').length,
  };
  const allDone = stats.total > 0 && stats.saved === stats.total;
  const selectedItems = visible.filter((f) => selectedIds.has(f.id));

  // ── Render zone vide ──────────────────────────────────────────────────────

  if (files.length === 0) {
    return (
      <>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl py-20 flex flex-col items-center gap-4 cursor-pointer transition-all select-none ${
            dragging ? 'border-terra bg-terra/5 scale-[1.01]' : 'border-line hover:border-terra/50 hover:bg-terra/3'
          }`}
        >
          <span className="text-5xl">📁</span>
          <div className="text-center">
            <p className="font-display font-bold text-lg text-ink">Dépose tes images ici</p>
            <p className="text-sm text-muted mt-1">ou clique pour parcourir — JPG, PNG, WEBP — sélection multiple</p>
          </div>
          <span className="text-xs text-muted/60 bg-bone px-3 py-1.5 rounded-full">
            ✨ Gemini analyse + détecte automatiquement les variantes similaires
          </span>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileInput} />
      </>
    );
  }

  // ── Render liste ──────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── Barre de statut ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="font-display font-bold text-ink">{stats.total}</span>
          <span className="text-sm text-muted">image{stats.total > 1 ? 's' : ''}</span>
        </div>

        {stats.analyzing > 0 && (
          <span className="flex items-center gap-1.5 text-xs text-muted bg-bone px-3 py-1.5 rounded-full">
            <span className="w-2.5 h-2.5 border-2 border-terra/40 border-t-terra rounded-full animate-spin" />
            {stats.analyzing} en cours
          </span>
        )}
        {stats.ready > 0 && !selectMode && (
          <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-full font-display font-semibold uppercase tracking-widest">
            ✓ {stats.ready} prêt{stats.ready > 1 ? 's' : ''}
          </span>
        )}
        {stats.error > 0 && (
          <span className="text-xs bg-terra/10 text-terra border border-terra/30 px-3 py-1.5 rounded-full font-display font-semibold">
            ⚠ {stats.error} erreur{stats.error > 1 ? 's' : ''}
          </span>
        )}
        {stats.saved > 0 && (
          <span className="text-xs bg-ink text-cream px-3 py-1.5 rounded-full font-display font-semibold uppercase tracking-widest">
            ✓ {stats.saved} importé{stats.saved > 1 ? 's' : ''}
          </span>
        )}
        {selectMode && selectedIds.size > 0 && (
          <span className="text-xs bg-terra text-cream px-3 py-1.5 rounded-full font-display font-semibold">
            {selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''}
          </span>
        )}

        <div className="flex-1" />

        {/* Mode sélection — bouton fusionner */}
        {selectMode ? (
          <>
            {selectedIds.size >= 2 && (
              <button type="button" onClick={() => setShowMergeModal(true)}
                className="font-display text-[10px] tracking-widest uppercase font-bold bg-terra text-cream px-4 py-2 rounded-full hover:bg-terra-dark transition-colors flex items-center gap-1.5">
                🔗 Fusionner {selectedIds.size} articles
              </button>
            )}
            <button type="button" onClick={cancelSelect}
              className="font-display text-[10px] tracking-widest uppercase font-semibold border border-line px-4 py-2 rounded-full text-muted hover:border-ink hover:text-ink transition-colors">
              Annuler
            </button>
          </>
        ) : (
          <>
            {stats.ready >= 2 && (
              <button type="button" onClick={() => setSelectMode(true)}
                className="font-display text-[10px] tracking-widest uppercase font-semibold border border-line px-4 py-2 rounded-full text-muted hover:border-terra hover:text-terra transition-colors">
                🔗 Sélectionner
              </button>
            )}
            <button type="button" onClick={() => fileInputRef.current?.click()}
              className="font-display text-[10px] tracking-widest uppercase font-semibold border border-line px-4 py-2 rounded-full text-muted hover:border-ink hover:text-ink transition-colors">
              + Ajouter
            </button>
            {stats.ready > 0 && (
              <button type="button" onClick={importAll} disabled={importingAll}
                className="font-display text-[10px] tracking-widest uppercase font-semibold bg-terra text-cream px-5 py-2 rounded-full hover:bg-terra-dark disabled:opacity-60 transition-colors flex items-center gap-2">
                {importingAll ? (
                  <><span className="w-3 h-3 border-2 border-cream/40 border-t-cream rounded-full animate-spin" />{importProgress.done}/{importProgress.total}</>
                ) : `→ Importer ${stats.ready} produit${stats.ready > 1 ? 's' : ''}`}
              </button>
            )}
          </>
        )}

        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileInput} />
      </div>

      {/* ── Cards ── */}
      <div className="space-y-3">
        {visible.map((item) => (
          <ProductImportCard
            key={item.id}
            item={item}
            selectMode={selectMode}
            selected={selectedIds.has(item.id)}
            onToggleSelect={() => toggleSelect(item.id)}
            onSelectGroup={selectSimilarGroup}
            onUpdate={updateFile}
            onRemove={removeFile}
            onRetry={retryAnalyze}
            onUnmerge={unmerge}
          />
        ))}
      </div>

      {/* ── Succès global ── */}
      {allDone && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center">
          <div className="text-4xl mb-3">🎉</div>
          <p className="font-display font-bold text-emerald-800 text-lg">
            {stats.saved} produit{stats.saved > 1 ? 's' : ''} importé{stats.saved > 1 ? 's' : ''} !
          </p>
          <p className="text-sm text-emerald-600 mt-1 mb-4">Visible dans le catalogue.</p>
          <a href="/admin/produits"
            className="inline-block font-display text-[10px] tracking-widest uppercase font-bold bg-emerald-700 text-white px-6 py-2.5 rounded-full hover:bg-emerald-800 transition-colors">
            Voir le catalogue →
          </a>
        </div>
      )}

      {/* ── Modal de fusion ── */}
      {showMergeModal && (
        <MergeModal
          items={selectedItems}
          onMerge={handleMerge}
          onClose={() => setShowMergeModal(false)}
        />
      )}
    </div>
  );
}

// ── Modal de fusion ───────────────────────────────────────────────────────────

function MergeModal({
  items,
  onMerge,
  onClose,
}: {
  items: ImportedFile[];
  onMerge: (primaryId: string, variants: { sourceId: string; label: string; hex: string }[]) => void;
  onClose: () => void;
}) {
  const [primaryId, setPrimaryId] = useState(items[0]?.id ?? '');
  const [variants, setVariants] = useState<{ sourceId: string; label: string; hex: string }[]>(
    items.map((item, i) => ({
      sourceId: item.id,
      label: '',
      hex: ['#1A1A1A','#4B3B2A','#2A3F5F','#FFFFFF','#8B0000','#D4A017','#2E5E2E','#6B4C8A'][i] ?? '#888888',
    }))
  );

  const updateVariant = (sourceId: string, field: 'label' | 'hex', val: string) => {
    setVariants((prev) => prev.map((v) => v.sourceId === sourceId ? { ...v, [field]: val } : v));
  };

  const handleConfirm = () => {
    const filled = variants.filter((v) => v.label.trim());
    if (filled.length < 2) return;
    // Retire le primary des variants (les variants = les "autres")
    const variantsWithoutPrimary = filled.filter((v) => v.sourceId !== primaryId);
    // Le primary garde sa propre image, les variants lui sont attachés
    const allVariants = filled; // on inclut le primary dans les variants aussi
    onMerge(primaryId, allVariants);
  };

  return (
    <div className="fixed inset-0 bg-ink/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-cream rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-line">
          <div>
            <h3 className="font-display font-bold text-lg text-ink">
              Fusionner {items.length} articles en 1 produit
            </h3>
            <p className="text-sm text-muted mt-0.5">
              Attribue un nom de couleur à chaque variante
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-muted hover:text-ink w-8 h-8 flex items-center justify-center rounded-full hover:bg-bone transition-colors text-lg">✕</button>
        </div>

        {/* Variants list */}
        <div className="p-6 space-y-3">
          {items.map((item, i) => {
            const variant = variants.find((v) => v.sourceId === item.id)!;
            return (
              <div key={item.id} className={`flex items-center gap-4 p-3 rounded-xl border-2 transition-all ${
                primaryId === item.id ? 'border-terra bg-terra/5' : 'border-line bg-bone'
              }`}>
                {/* Thumbnail */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.previewUrl} alt="" className="w-16 h-16 object-cover rounded-lg border border-line shrink-0" />

                {/* Numéro */}
                <div className="w-6 h-6 rounded-full bg-ink text-cream text-[10px] font-display font-bold flex items-center justify-center shrink-0">{i + 1}</div>

                {/* Nom de couleur */}
                <div className="flex-1 min-w-0">
                  <label className="block font-display text-[9px] tracking-widest uppercase text-muted mb-1">Couleur</label>
                  <input
                    type="text"
                    value={variant.label}
                    onChange={(e) => updateVariant(item.id, 'label', e.target.value)}
                    placeholder="ex: Marine, Bordeaux, Noir…"
                    className="w-full bg-cream border border-line rounded-lg px-3 py-1.5 text-sm outline-none focus:border-terra"
                  />
                </div>

                {/* Hex picker */}
                <div className="shrink-0">
                  <label className="block font-display text-[9px] tracking-widest uppercase text-muted mb-1">Teinte</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={variant.hex}
                      onChange={(e) => updateVariant(item.id, 'hex', e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer border border-line"
                    />
                    <span className="text-[10px] font-mono text-muted">{variant.hex}</span>
                  </div>
                </div>

                {/* Primary radio */}
                <div className="shrink-0 text-center">
                  <label className="block font-display text-[9px] tracking-widest uppercase text-muted mb-1">Principal</label>
                  <input
                    type="radio"
                    name="primary"
                    checked={primaryId === item.id}
                    onChange={() => setPrimaryId(item.id)}
                    className="w-4 h-4 accent-terra cursor-pointer"
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Info primary */}
        <div className="mx-6 mb-4 bg-bone rounded-xl p-3 text-xs text-muted">
          <span className="font-semibold text-ink">Produit principal (⬤)</span> : le nom, prix et description de cet article seront utilisés pour la fiche produit. Les autres deviennent des variantes de couleur.
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-6 pt-0">
          <button type="button" onClick={onClose}
            className="flex-1 py-3 border border-line rounded-xl font-display text-[10px] tracking-widest uppercase font-semibold text-muted hover:border-ink hover:text-ink transition-colors">
            Annuler
          </button>
          <button type="button" onClick={handleConfirm}
            disabled={variants.filter((v) => v.label.trim()).length < 2}
            className="flex-1 py-3 bg-terra text-cream rounded-xl font-display text-[10px] tracking-widest uppercase font-bold hover:bg-terra-dark disabled:opacity-50 transition-colors">
            🔗 Fusionner en 1 produit
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Card produit ──────────────────────────────────────────────────────────────

interface CardProps {
  item:            ImportedFile;
  selectMode:      boolean;
  selected:        boolean;
  onToggleSelect:  () => void;
  onSelectGroup:   (group: string) => void;
  onUpdate:        <K extends keyof ImportedFile>(id: string, key: K, val: ImportedFile[K]) => void;
  onRemove:        (id: string) => void;
  onRetry:         (item: ImportedFile) => void;
  onUnmerge:       (id: string) => void;
}

function ProductImportCard({ item, selectMode, selected, onToggleSelect, onSelectGroup, onUpdate, onRemove, onRetry, onUnmerge }: CardProps) {
  const disabled   = item.status === 'saved' || item.status === 'saving';
  const isMergedPrimary = !!item.colorVariants?.length;

  const borderClass =
    selected           ? 'border-terra bg-terra/3' :
    isMergedPrimary    ? 'border-terra/40 bg-terra/2' :
    item.status === 'saved'  ? 'border-emerald-200 bg-emerald-50/30' :
    item.status === 'saving' ? 'border-terra/20 bg-terra/3' :
    item.status === 'error'  ? 'border-terra/30 bg-terra/3' :
    'border-line';

  return (
    <div className={`bg-cream border rounded-xl overflow-hidden transition-all ${borderClass}`}>
      <div className="flex gap-4 p-4">

        {/* ── Vignette ── */}
        <div className="relative shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.previewUrl} alt="" className="w-28 h-28 object-cover rounded-lg border border-line" />

          {/* Checkbox en mode sélection */}
          {selectMode && !disabled && (
            <button type="button" onClick={onToggleSelect}
              className={`absolute top-1.5 left-1.5 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                selected ? 'bg-terra border-terra text-cream' : 'bg-cream/90 border-line hover:border-terra'
              }`}>
              {selected && <span className="text-[10px] font-bold">✓</span>}
            </button>
          )}

          {/* Overlays statut */}
          {item.status === 'analyzing' && (
            <div className="absolute inset-0 bg-ink/50 rounded-lg flex flex-col items-center justify-center gap-1">
              <span className="w-5 h-5 border-2 border-cream/30 border-t-cream rounded-full animate-spin" />
              <span className="text-cream text-[9px] font-display font-bold tracking-widest uppercase">Gemini…</span>
            </div>
          )}
          {item.status === 'saving' && (
            <div className="absolute inset-0 bg-terra/50 rounded-lg flex items-center justify-center">
              <span className="w-5 h-5 border-2 border-cream/30 border-t-cream rounded-full animate-spin" />
            </div>
          )}
          {item.status === 'saved' && (
            <div className="absolute inset-0 bg-emerald-600/60 rounded-lg flex items-center justify-center">
              <span className="text-white text-2xl">✓</span>
            </div>
          )}

          {/* Miniatures des variantes fusionnées */}
          {isMergedPrimary && (
            <div className="absolute -bottom-1 left-0 right-0 flex justify-center gap-0.5">
              {item.colorVariants!.slice(0, 5).map((v) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={v.sourceId} src={v.previewUrl} alt="" className="w-7 h-7 object-cover rounded border-2 border-cream shadow-sm" style={{ outline: `2px solid ${v.hex}` }} />
              ))}
              {(item.colorVariants!.length > 5) && (
                <div className="w-7 h-7 bg-ink text-cream text-[9px] font-bold rounded border-2 border-cream flex items-center justify-center">+{item.colorVariants!.length - 5}</div>
              )}
            </div>
          )}
        </div>

        {/* ── Champs éditables ── */}
        <div className={`flex-1 min-w-0 space-y-2.5 ${isMergedPrimary ? 'mt-0' : ''}`}>

          {/* Badge fusionné */}
          {isMergedPrimary && (
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[9px] bg-terra text-cream px-2 py-0.5 rounded-full font-display font-bold tracking-widest uppercase">
                🔗 {item.colorVariants!.length + 1} variantes
              </span>
              <div className="flex gap-1">
                {item.colorVariants!.map((v) => (
                  <div key={v.sourceId} title={v.label}
                    className="w-3.5 h-3.5 rounded-full border border-line/30"
                    style={{ backgroundColor: v.hex }} />
                ))}
              </div>
              {!disabled && (
                <button type="button" onClick={() => onUnmerge(item.id)}
                  className="text-[9px] text-muted hover:text-terra font-display font-semibold ml-auto">
                  Défaire
                </button>
              )}
            </div>
          )}

          {/* Badge similarité */}
          {item.similarGroup && !isMergedPrimary && !selectMode && item.status === 'ready' && (
            <button type="button" onClick={() => onSelectGroup(item.similarGroup!)}
              className="text-[9px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-display font-semibold hover:bg-amber-100 transition-colors">
              🔗 Similaire à d'autres — cliquer pour sélectionner le groupe
            </button>
          )}

          {/* Nom */}
          <input type="text" value={item.name}
            onChange={(e) => onUpdate(item.id, 'name', e.target.value)}
            placeholder="Nom du produit" disabled={disabled}
            className="w-full bg-bone border border-line rounded-lg px-3 py-2 text-sm font-semibold text-ink outline-none focus:border-terra disabled:opacity-60"
          />

          {/* Catégorie + Sous-catégorie + Prix + Genre */}
          <div className="flex gap-2 flex-wrap">
            <select value={item.category}
              onChange={(e) => { const cat = e.target.value as ProductCategory; onUpdate(item.id, 'category', cat); onUpdate(item.id, 'subcategory', SUBCATEGORIES[cat][0]); }}
              disabled={disabled} className="bg-bone border border-line rounded-lg px-2 py-1.5 text-xs outline-none focus:border-terra disabled:opacity-60">
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <select value={item.subcategory} onChange={(e) => onUpdate(item.id, 'subcategory', e.target.value)}
              disabled={disabled} className="flex-1 min-w-0 bg-bone border border-line rounded-lg px-2 py-1.5 text-xs outline-none focus:border-terra disabled:opacity-60">
              {SUBCATEGORIES[item.category].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <div className="flex items-center gap-1 bg-bone border border-line rounded-lg px-3 py-1.5">
              <span className="text-xs text-muted font-display">$</span>
              <input type="number" value={item.priceUSD || ''} onChange={(e) => onUpdate(item.id, 'priceUSD', parseFloat(e.target.value) || 0)}
                placeholder="0" disabled={disabled} className="w-16 bg-transparent text-sm font-display font-bold text-terra outline-none disabled:opacity-60" />
            </div>
            <select value={item.genre} onChange={(e) => onUpdate(item.id, 'genre', e.target.value)}
              disabled={disabled} className="bg-bone border border-line rounded-lg px-2 py-1.5 text-xs outline-none focus:border-terra disabled:opacity-60">
              {['homme','femme','mixte','enfant'].map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          <input type="text" value={item.shortDescription}
            onChange={(e) => onUpdate(item.id, 'shortDescription', e.target.value)}
            placeholder="Description courte (80 car. max)" maxLength={100} disabled={disabled}
            className="w-full bg-bone border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none focus:border-terra disabled:opacity-60"
          />
          <textarea value={item.description} onChange={(e) => onUpdate(item.id, 'description', e.target.value)}
            placeholder="Description complète…" disabled={disabled} rows={2}
            className="w-full bg-bone border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none focus:border-terra resize-none disabled:opacity-60"
          />
          <input type="text" value={item.tags} onChange={(e) => onUpdate(item.id, 'tags', e.target.value)}
            placeholder="Tags séparés par virgule" disabled={disabled}
            className="w-full bg-bone border border-line rounded-lg px-3 py-1.5 text-[11px] text-muted outline-none focus:border-terra disabled:opacity-60"
          />
        </div>

        {/* ── Statut + actions ── */}
        <div className="flex flex-col items-end justify-between gap-2 shrink-0 w-24">
          <span className={`text-[9px] font-display font-bold tracking-widest uppercase px-2 py-1 rounded-full text-center whitespace-nowrap ${
            item.status === 'analyzing' ? 'bg-bone text-muted' :
            item.status === 'ready'     ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
            item.status === 'error'     ? 'bg-terra/10 text-terra border border-terra/30' :
            item.status === 'saving'    ? 'bg-terra/10 text-terra' :
            item.status === 'saved'     ? 'bg-emerald-600 text-white' :
            'bg-bone text-muted'
          }`}>
            {item.status === 'pending'   && '— Attente'}
            {item.status === 'analyzing' && '⏳ Analyse'}
            {item.status === 'ready'     && '✓ Prêt'}
            {item.status === 'error'     && '⚠ Erreur'}
            {item.status === 'saving'    && '⏳ Import'}
            {item.status === 'saved'     && '✓ Importé'}
          </span>
          {item.status === 'error' && (
            <button type="button" onClick={() => onRetry(item)}
              className="text-[9px] text-terra hover:underline font-display font-bold tracking-widest uppercase">
              Réessayer
            </button>
          )}
          {!disabled && (
            <button type="button" onClick={() => onRemove(item.id)}
              className="text-muted hover:text-terra transition-colors w-7 h-7 rounded-lg hover:bg-terra/10 flex items-center justify-center text-sm">
              ✕
            </button>
          )}
        </div>
      </div>

      {item.status === 'error' && item.error && (
        <div className="mx-4 mb-3 text-xs text-terra bg-terra/5 rounded-lg px-3 py-2">{item.error}</div>
      )}
    </div>
  );
}
