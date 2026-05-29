'use client';

import { useState, useRef, useCallback } from 'react';
import { ref as storageRef, uploadString, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase/client';
import {
  saveAdminProduct,
  slugify,
  type StoredProduct,
  type ProductCategory,
} from '@/lib/admin/product-store';
import { saveProductToFirestore } from '@/lib/firebase/products';

// ── Constantes catégories (miroir de product-store.ts) ─────────────────────────

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

interface ImportedFile {
  id: string;
  file: File;
  previewUrl: string;         // blob URL pour affichage
  base64?: string;            // data URL stocké après lecture
  status: 'pending' | 'analyzing' | 'ready' | 'error' | 'saving' | 'saved';
  error?: string;
  // Champs éditables pré-remplis par Gemini
  name: string;
  category: ProductCategory;
  subcategory: string;
  shortDescription: string;
  description: string;
  priceUSD: number;
  tags: string;               // CSV éditable
  genre: string;
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

/** Nettoie le nom de fichier pour en faire un nom produit lisible */
function nameFromFilename(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, '')                                    // enlève l'extension
    .replace(/whatsapp image \d{4}-\d{2}-\d{2} at .+/i, '')    // nettoie noms WhatsApp
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())                   // Title Case
    || 'Nouveau produit';
}

function defaultFile(file: File): ImportedFile {
  return {
    id: genId(),
    file,
    previewUrl: URL.createObjectURL(file),
    status: 'pending',
    name: nameFromFilename(file.name),
    category: 'mode',
    subcategory: 'Vêtements',
    shortDescription: '',
    description: '',
    priceUSD: 0,
    tags: '',
    genre: 'mixte',
  };
}

// ── Composant principal ───────────────────────────────────────────────────────

export function BulkFileImport() {
  const [files, setFiles]           = useState<ImportedFile[]>([]);
  const [dragging, setDragging]     = useState(false);
  const [importingAll, setImporting]= useState(false);
  const [importProgress, setProgress] = useState({ done: 0, total: 0 });
  const fileInputRef                = useRef<HTMLInputElement>(null);

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
        body: JSON.stringify({
          imageBase64: base64,
          filename: item.file.name,
          mimeType: item.file.type,
        }),
      });
      const data = await res.json() as Record<string, unknown>;
      if (!res.ok || data.error) throw new Error(String(data.error ?? 'Gemini error'));

      const cat = (['mode','technologie','hybrides','services'] as const)
        .find((c) => c === data.category) ?? 'mode';
      const subList = SUBCATEGORIES[cat];
      const sub = typeof data.subcategory === 'string' && subList.includes(data.subcategory)
        ? data.subcategory
        : subList[0];

      setFiles((prev) => prev.map((f) =>
        f.id === item.id ? {
          ...f,
          base64,
          status: 'ready',
          name:             typeof data.name === 'string'             ? data.name             : f.name,
          category:         cat,
          subcategory:      sub,
          shortDescription: typeof data.shortDescription === 'string' ? data.shortDescription : '',
          description:      typeof data.description === 'string'      ? data.description      : '',
          priceUSD:         typeof data.priceUSD === 'number'         ? data.priceUSD         : f.priceUSD,
          tags:             Array.isArray(data.tags)                  ? (data.tags as string[]).join(', ') : f.tags,
          genre:            typeof data.genre === 'string'            ? data.genre            : 'mixte',
        } : f,
      ));
    } catch (err) {
      setFiles((prev) => prev.map((f) =>
        f.id === item.id
          ? { ...f, status: 'error', error: err instanceof Error ? err.message : 'Erreur' }
          : f,
      ));
    }
  }, [updateFile]);

  // ── Ajout de fichiers ──────────────────────────────────────────────────────

  const addFiles = useCallback((rawFiles: File[]) => {
    const imgs = rawFiles.filter((f) => f.type.startsWith('image/'));
    if (imgs.length === 0) return;

    const items = imgs.map(defaultFile);
    setFiles((prev) => [...prev, ...items]);

    // Auto-analyse en lots de 3 pour éviter le rate-limiting Gemini
    const BATCH = 3;
    const runBatches = async () => {
      for (let i = 0; i < items.length; i += BATCH) {
        await Promise.allSettled(items.slice(i, i + BATCH).map((item) => analyzeFile(item)));
        // Petit délai entre les lots pour respecter les limites API
        if (i + BATCH < items.length) await new Promise((r) => setTimeout(r, 800));
      }
    };
    runBatches();
  }, [analyzeFile]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(Array.from(e.target.files));
    e.target.value = '';
  };

  const removeFile = (id: string) => {
    setFiles((prev) => {
      const f = prev.find((x) => x.id === id);
      if (f) URL.revokeObjectURL(f.previewUrl);
      return prev.filter((x) => x.id !== id);
    });
  };

  const retryAnalyze = (item: ImportedFile) => analyzeFile({ ...item, status: 'pending' });

  // ── Import Firestore + localStorage ───────────────────────────────────────

  const importAll = async () => {
    const toImport = files.filter((f) => f.status === 'ready');
    if (toImport.length === 0) return;

    setImporting(true);
    setProgress({ done: 0, total: toImport.length });

    for (const item of toImport) {
      updateFile(item.id, 'status', 'saving');
      try {
        // 1. Lire le base64 si pas encore fait
        const base64 = item.base64 ?? await fileToBase64(item.file);

        // 2. Upload vers Firebase Storage
        const id = genId();
        const imgRef = storageRef(storage, `products/${id}/image-0`);
        await uploadString(imgRef, base64, 'data_url', {
          contentType: item.file.type || 'image/jpeg',
        });
        const imageUrl = await getDownloadURL(imgRef);

        const slug = slugify(item.name) + '-' + id.slice(-6);
        const now  = new Date().toISOString();

        // 3. Construire le StoredProduct
        const product: StoredProduct = {
          id,
          slug,
          name: item.name,
          category: item.category,
          subcategory: item.subcategory,
          priceUSD: item.priceUSD,
          shortDescription: item.shortDescription,
          description: item.description,
          stock: 10,
          tags: item.tags.split(',').map((t) => t.trim()).filter(Boolean),
          sizes: [],
          colors: [],
          images: [{
            id: 'bulk-0',
            originalDataUrl:  imageUrl, // URL Storage (pas base64 → localStorage léger)
            processedDataUrl: imageUrl,
            hasTransparentBg: false,
            pipelineStatus: 'done',
            width: 0, height: 0, sizeBytes: 0,
          }],
          videos: [],
          genre: item.genre as StoredProduct['genre'],
          status: 'active',
          rating: 0,
          reviewCount: 0,
          createdAt: now,
          updatedAt: now,
        };

        // 4. Sauvegarder localStorage + Firestore
        saveAdminProduct(product);
        await saveProductToFirestore(product);

        updateFile(item.id, 'status', 'saved');
        setProgress((p) => ({ ...p, done: p.done + 1 }));

      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Import échoué';
        setFiles((prev) => prev.map((f) =>
          f.id === item.id ? { ...f, status: 'error', error: msg } : f,
        ));
      }
    }

    setImporting(false);
  };

  // ── Stats ──────────────────────────────────────────────────────────────────

  const stats = {
    total:     files.length,
    analyzing: files.filter((f) => f.status === 'analyzing').length,
    ready:     files.filter((f) => f.status === 'ready').length,
    error:     files.filter((f) => f.status === 'error').length,
    saved:     files.filter((f) => f.status === 'saved').length,
  };

  const allDone = stats.total > 0 && stats.saved === stats.total;

  // ── Render : zone de dépôt (vide) ─────────────────────────────────────────

  if (files.length === 0) {
    return (
      <>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl py-20 flex flex-col items-center gap-4 cursor-pointer transition-all select-none ${
            dragging
              ? 'border-terra bg-terra/5 scale-[1.01]'
              : 'border-line hover:border-terra/50 hover:bg-terra/3'
          }`}
        >
          <span className="text-5xl">📁</span>
          <div className="text-center">
            <p className="font-display font-bold text-lg text-ink">
              Dépose tes images ici
            </p>
            <p className="text-sm text-muted mt-1">
              ou clique pour parcourir — JPG, PNG, WEBP — sélection multiple
            </p>
          </div>
          <span className="text-xs text-muted/60 bg-bone px-3 py-1.5 rounded-full">
            ✨ Gemini analyse automatiquement chaque article
          </span>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileInput} />
      </>
    );
  }

  // ── Render : liste de produits ─────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Barre de statut + actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="font-display font-bold text-ink">{stats.total}</span>
          <span className="text-sm text-muted">image{stats.total > 1 ? 's' : ''}</span>
        </div>

        {stats.analyzing > 0 && (
          <span className="flex items-center gap-1.5 text-xs text-muted bg-bone px-3 py-1.5 rounded-full">
            <span className="w-2.5 h-2.5 border-2 border-terra/40 border-t-terra rounded-full animate-spin" />
            {stats.analyzing} en cours d'analyse
          </span>
        )}
        {stats.ready > 0 && (
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

        <div className="flex-1" />

        {/* Ajouter d'autres images */}
        <button type="button" onClick={() => fileInputRef.current?.click()}
          className="font-display text-[10px] tracking-widest uppercase font-semibold border border-line px-4 py-2 rounded-full text-muted hover:border-ink hover:text-ink transition-colors">
          + Ajouter
        </button>

        {/* Importer tout */}
        {stats.ready > 0 && (
          <button type="button" onClick={importAll} disabled={importingAll}
            className="font-display text-[10px] tracking-widest uppercase font-semibold bg-terra text-cream px-5 py-2 rounded-full hover:bg-terra-dark disabled:opacity-60 transition-colors flex items-center gap-2">
            {importingAll ? (
              <>
                <span className="w-3 h-3 border-2 border-cream/40 border-t-cream rounded-full animate-spin" />
                {importProgress.done} / {importProgress.total}
              </>
            ) : (
              `→ Importer ${stats.ready} produit${stats.ready > 1 ? 's' : ''}`
            )}
          </button>
        )}

        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileInput} />
      </div>

      {/* ── Cards produits ── */}
      <div className="space-y-3">
        {files.map((item) => (
          <ProductImportCard
            key={item.id}
            item={item}
            onUpdate={updateFile}
            onRemove={removeFile}
            onRetry={retryAnalyze}
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
          <p className="text-sm text-emerald-600 mt-1 mb-4">
            Visible dans le catalogue. Tu peux compléter les fiches (tailles, couleurs, images supplémentaires).
          </p>
          <a href="/admin/produits"
            className="inline-block font-display text-[10px] tracking-widest uppercase font-bold bg-emerald-700 text-white px-6 py-2.5 rounded-full hover:bg-emerald-800 transition-colors">
            Voir le catalogue →
          </a>
        </div>
      )}
    </div>
  );
}

// ── Card produit individuelle ─────────────────────────────────────────────────

interface CardProps {
  item: ImportedFile;
  onUpdate: <K extends keyof ImportedFile>(id: string, key: K, val: ImportedFile[K]) => void;
  onRemove: (id: string) => void;
  onRetry: (item: ImportedFile) => void;
}

function ProductImportCard({ item, onUpdate, onRemove, onRetry }: CardProps) {
  const disabled = item.status === 'saved' || item.status === 'saving';

  const borderClass =
    item.status === 'saved'    ? 'border-emerald-200 bg-emerald-50/30' :
    item.status === 'saving'   ? 'border-terra/20 bg-terra/3' :
    item.status === 'error'    ? 'border-terra/30 bg-terra/3' :
    item.status === 'ready'    ? 'border-line' :
    'border-line opacity-80';

  return (
    <div className={`bg-cream border rounded-xl overflow-hidden transition-all ${borderClass}`}>
      <div className="flex gap-4 p-4">

        {/* ── Vignette ── */}
        <div className="relative shrink-0 w-28">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.previewUrl}
            alt=""
            className="w-28 h-28 object-cover rounded-lg border border-line"
          />
          {/* Overlay status */}
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
        </div>

        {/* ── Champs éditables ── */}
        <div className="flex-1 min-w-0 space-y-2.5">

          {/* Nom */}
          <input
            type="text"
            value={item.name}
            onChange={(e) => onUpdate(item.id, 'name', e.target.value)}
            placeholder="Nom du produit"
            disabled={disabled}
            className="w-full bg-bone border border-line rounded-lg px-3 py-2 text-sm font-semibold text-ink outline-none focus:border-terra disabled:opacity-60 transition-colors"
          />

          {/* Catégorie + Sous-catégorie + Prix */}
          <div className="flex gap-2 flex-wrap">
            <select
              value={item.category}
              onChange={(e) => {
                const cat = e.target.value as ProductCategory;
                onUpdate(item.id, 'category', cat);
                onUpdate(item.id, 'subcategory', SUBCATEGORIES[cat][0]);
              }}
              disabled={disabled}
              className="bg-bone border border-line rounded-lg px-2 py-1.5 text-xs outline-none focus:border-terra disabled:opacity-60"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>

            <select
              value={item.subcategory}
              onChange={(e) => onUpdate(item.id, 'subcategory', e.target.value)}
              disabled={disabled}
              className="flex-1 min-w-0 bg-bone border border-line rounded-lg px-2 py-1.5 text-xs outline-none focus:border-terra disabled:opacity-60"
            >
              {SUBCATEGORIES[item.category].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            {/* Prix */}
            <div className="flex items-center gap-1 bg-bone border border-line rounded-lg px-3 py-1.5">
              <span className="text-xs text-muted font-display">$</span>
              <input
                type="number"
                value={item.priceUSD || ''}
                onChange={(e) => onUpdate(item.id, 'priceUSD', parseFloat(e.target.value) || 0)}
                placeholder="0"
                disabled={disabled}
                className="w-16 bg-transparent text-sm font-display font-bold text-terra outline-none disabled:opacity-60"
              />
            </div>

            {/* Genre */}
            <select
              value={item.genre}
              onChange={(e) => onUpdate(item.id, 'genre', e.target.value)}
              disabled={disabled}
              className="bg-bone border border-line rounded-lg px-2 py-1.5 text-xs outline-none focus:border-terra disabled:opacity-60"
            >
              {['homme', 'femme', 'mixte', 'enfant'].map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          {/* Description courte */}
          <input
            type="text"
            value={item.shortDescription}
            onChange={(e) => onUpdate(item.id, 'shortDescription', e.target.value)}
            placeholder="Description courte (80 car. max)"
            maxLength={100}
            disabled={disabled}
            className="w-full bg-bone border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none focus:border-terra disabled:opacity-60"
          />

          {/* Description complète */}
          <textarea
            value={item.description}
            onChange={(e) => onUpdate(item.id, 'description', e.target.value)}
            placeholder="Description complète pour la fiche produit…"
            disabled={disabled}
            rows={2}
            className="w-full bg-bone border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none focus:border-terra resize-none disabled:opacity-60"
          />

          {/* Tags */}
          <input
            type="text"
            value={item.tags}
            onChange={(e) => onUpdate(item.id, 'tags', e.target.value)}
            placeholder="Tags séparés par virgule (ex: casual, été, slim)"
            disabled={disabled}
            className="w-full bg-bone border border-line rounded-lg px-3 py-1.5 text-[11px] text-muted outline-none focus:border-terra disabled:opacity-60"
          />
        </div>

        {/* ── Colonne droite : status + actions ── */}
        <div className="flex flex-col items-end justify-between gap-2 shrink-0 w-24">
          {/* Badge statut */}
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

          {/* Bouton réessayer (erreur) */}
          {item.status === 'error' && (
            <button type="button" onClick={() => onRetry(item)}
              className="text-[9px] text-terra hover:underline font-display font-bold tracking-widest uppercase">
              Réessayer
            </button>
          )}

          {/* Supprimer */}
          {!disabled && (
            <button type="button" onClick={() => onRemove(item.id)}
              className="text-muted hover:text-terra transition-colors w-7 h-7 rounded-lg hover:bg-terra/10 flex items-center justify-center text-sm">
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Message d'erreur */}
      {item.status === 'error' && item.error && (
        <div className="mx-4 mb-3 text-xs text-terra bg-terra/5 rounded-lg px-3 py-2">
          {item.error}
        </div>
      )}
    </div>
  );
}
