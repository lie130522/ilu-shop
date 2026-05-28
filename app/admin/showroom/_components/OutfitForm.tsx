'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAdmin } from '@/components/admin/AdminProvider';
import { saveOutfitToFirestore, deleteOutfitFromFirestore } from '@/lib/firebase/outfits';
import { ProductPicker } from './ProductPicker';
import { formatUSD } from '@/lib/currency';
import type { Outfit, OutfitItem, OutfitDot, OutfitCategory, OutfitBadgeType } from '@/lib/showroom/types';
import { OUTFIT_CATEGORY_LABEL, OUTFIT_ITEM_CATEGORY_EMOJI } from '@/lib/showroom/types';

// ── Types internes ────────────────────────────────────────────────────────────

interface FormState {
  name: string;
  season: string;
  cat: OutfitCategory;
  badge: string;
  badgeType: OutfitBadgeType | '';
  status: 'published' | 'draft';
}

interface DotPending {
  x: number;
  y: number;
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface OutfitFormProps {
  initialOutfit?: Outfit; // si fourni → mode édition
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Composant ─────────────────────────────────────────────────────────────────

export function OutfitForm({ initialOutfit }: OutfitFormProps) {
  const router = useRouter();
  const { currentAdmin, exchangeRate } = useAdmin();
  const isEdit = !!initialOutfit;

  // ── État du formulaire ─────────────────────────────────────────────────────
  const [form, setForm] = useState<FormState>({
    name: initialOutfit?.name ?? '',
    season: initialOutfit?.season ?? '',
    cat: initialOutfit?.cat ?? 'casual',
    badge: initialOutfit?.badge ?? '',
    badgeType: initialOutfit?.badgeType ?? '',
    status: initialOutfit?.status ?? 'draft',
  });

  const [photos, setPhotos] = useState<string[]>(initialOutfit?.photos ?? []);
  const [items, setItems] = useState<OutfitItem[]>(initialOutfit?.items ?? []);
  const [dots, setDots] = useState<OutfitDot[]>(initialOutfit?.dots ?? []);

  // UI states
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [dotPending, setDotPending] = useState<DotPending | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLDivElement>(null);

  // ── Photos ─────────────────────────────────────────────────────────────────

  const handlePhotoFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (result) setPhotos((prev) => [...prev, result]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (i: number) => {
    setPhotos((prev) => prev.filter((_, idx) => idx !== i));
    // Supprimer les dots qui référencent la photo (on n'a qu'une photo pour les dots)
    if (i === 0) setDots([]);
  };

  const movePhoto = (from: number, to: number) => {
    setPhotos((prev) => {
      const arr = [...prev];
      const [item] = arr.splice(from, 1);
      arr.splice(to, 0, item);
      return arr;
    });
  };

  // ── Items ─────────────────────────────────────────────────────────────────

  const addItem = (partial: Omit<OutfitItem, 'id'>) => {
    setItems((prev) => [...prev, { ...partial, id: genId() }]);
  };

  const updateItem = <K extends keyof OutfitItem>(id: string, key: K, val: OutfitItem[K]) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, [key]: val } : it)));
  };

  const removeItem = (id: string) => {
    const idx = items.findIndex((it) => it.id === id);
    // Supprimer les dots qui pointaient vers cet item
    setDots((prev) =>
      prev
        .filter((d) => d.itemIndex !== idx)
        .map((d) => ({ ...d, itemIndex: d.itemIndex > idx ? d.itemIndex - 1 : d.itemIndex })),
    );
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const totalUSD = items.reduce((s, it) => s + (it.priceUSD || 0), 0);

  // ── Dot placement ──────────────────────────────────────────────────────────

  const handleImageClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (items.length === 0) return;
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setDotPending({ x, y });
    },
    [items.length],
  );

  const confirmDot = (itemIndex: number) => {
    if (!dotPending) return;
    setDots((prev) => [...prev, { x: dotPending.x, y: dotPending.y, itemIndex }]);
    setDotPending(null);
  };

  const removeDot = (i: number) => {
    setDots((prev) => prev.filter((_, idx) => idx !== i));
  };

  // ── Sauvegarde ─────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form.name.trim()) {
      setSaveError('Le nom de l\'outfit est requis.');
      return;
    }
    if (photos.length === 0) {
      setSaveError('Ajoutez au moins une photo.');
      return;
    }
    if (items.length === 0) {
      setSaveError('Ajoutez au moins un article.');
      return;
    }

    setSaving(true);
    setSaveError('');

    const now = new Date().toISOString();
    const outfit: Outfit = {
      id: initialOutfit?.id ?? genId(),
      name: form.name.trim(),
      season: form.season.trim() || 'Collection 2026',
      cat: form.cat,
      badge: form.badge || undefined,
      badgeType: (form.badgeType || undefined) as OutfitBadgeType | undefined,
      status: form.status,
      photos,
      items,
      dots,
      createdAt: initialOutfit?.createdAt ?? now,
      updatedAt: now,
    };

    try {
      await saveOutfitToFirestore(outfit);
      router.push('/admin/showroom');
    } catch (err: unknown) {
      setSaveError(`Erreur : ${(err as { message?: string })?.message ?? 'inconnue'}`);
      setSaving(false);
    }
  };

  // ── Suppression ────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!initialOutfit) return;
    setDeleting(true);
    await deleteOutfitFromFirestore(initialOutfit.id);
    router.push('/admin/showroom');
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!currentAdmin) return null;

  return (
    <div className="p-8 max-w-6xl space-y-10">
      {/* ── Erreur globale ── */}
      {saveError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          {saveError}
        </div>
      )}

      {/* ── Section 1 : Infos générales ── */}
      <section className="bg-cream border border-line rounded-xl p-6">
        <h2 className="font-display font-bold text-base mb-5 pb-3 border-b border-line">
          1 — Informations générales
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block font-display text-[10px] tracking-widest uppercase font-semibold text-muted mb-1.5">
              Nom de l'outfit <span className="text-terra">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="ex: Look Terracotta Cargo"
              className="w-full bg-bone border border-line rounded-lg px-4 py-2.5 text-sm outline-none focus:border-terra"
            />
          </div>
          <div>
            <label className="block font-display text-[10px] tracking-widest uppercase font-semibold text-muted mb-1.5">
              Saison / Collection
            </label>
            <input
              type="text"
              value={form.season}
              onChange={(e) => setForm((f) => ({ ...f, season: e.target.value }))}
              placeholder="ex: Automne 2026"
              className="w-full bg-bone border border-line rounded-lg px-4 py-2.5 text-sm outline-none focus:border-terra"
            />
          </div>
          <div>
            <label className="block font-display text-[10px] tracking-widest uppercase font-semibold text-muted mb-1.5">
              Catégorie
            </label>
            <select
              value={form.cat}
              onChange={(e) => setForm((f) => ({ ...f, cat: e.target.value as OutfitCategory }))}
              className="w-full bg-bone border border-line rounded-lg px-4 py-2.5 text-sm outline-none focus:border-terra"
            >
              {(Object.entries(OUTFIT_CATEGORY_LABEL) as [OutfitCategory, string][]).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-display text-[10px] tracking-widest uppercase font-semibold text-muted mb-1.5">
              Badge affiché
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={form.badge}
                onChange={(e) => setForm((f) => ({ ...f, badge: e.target.value }))}
                placeholder="ex: Nouveau, Tendance…"
                className="flex-1 bg-bone border border-line rounded-lg px-4 py-2.5 text-sm outline-none focus:border-terra"
              />
              <select
                value={form.badgeType}
                onChange={(e) => setForm((f) => ({ ...f, badgeType: e.target.value as OutfitBadgeType | '' }))}
                className="bg-bone border border-line rounded-lg px-3 py-2.5 text-sm outline-none focus:border-terra"
              >
                <option value="">Style</option>
                <option value="new">Noir (new)</option>
                <option value="promo">Terra (promo)</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block font-display text-[10px] tracking-widest uppercase font-semibold text-muted mb-1.5">
              Statut
            </label>
            <div className="flex gap-2">
              {(['draft', 'published'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, status: s }))}
                  className={`flex-1 py-2.5 rounded-lg border text-xs font-display font-semibold tracking-widest uppercase transition-colors ${
                    form.status === s
                      ? s === 'published'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-ink text-cream border-ink'
                      : 'bg-bone border-line text-muted hover:border-ink'
                  }`}
                >
                  {s === 'draft' ? 'Brouillon' : 'Publié'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 2 : Photos ── */}
      <section className="bg-cream border border-line rounded-xl p-6">
        <h2 className="font-display font-bold text-base mb-5 pb-3 border-b border-line">
          2 — Photos <span className="text-terra font-normal text-sm">*</span>
          <span className="ml-2 font-normal text-xs text-muted">(la 1re photo est utilisée pour les points chauds)</span>
        </h2>

        {/* Grille de prévisualisation */}
        {photos.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            {photos.map((src, i) => (
              <div key={i} className="relative aspect-[3/4] rounded-xl overflow-hidden bg-bone border border-line group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`photo ${i + 1}`} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-ink/0 group-hover:bg-ink/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                  {i > 0 && (
                    <button
                      type="button"
                      onClick={() => movePhoto(i, i - 1)}
                      className="w-8 h-8 bg-cream rounded-full flex items-center justify-center text-sm hover:bg-bone"
                      title="Monter"
                    >←</button>
                  )}
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="w-8 h-8 bg-terra text-cream rounded-full flex items-center justify-center text-sm"
                    title="Supprimer"
                  >✕</button>
                  {i < photos.length - 1 && (
                    <button
                      type="button"
                      onClick={() => movePhoto(i, i + 1)}
                      className="w-8 h-8 bg-cream rounded-full flex items-center justify-center text-sm hover:bg-bone"
                      title="Descendre"
                    >→</button>
                  )}
                </div>
                {i === 0 && (
                  <span className="absolute top-2 left-2 bg-terra text-cream text-[9px] font-display font-bold tracking-widest uppercase px-2 py-0.5 rounded">
                    Principale
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Zone d'upload */}
        <button
          type="button"
          onClick={() => photoInputRef.current?.click()}
          className="w-full border-2 border-dashed border-line rounded-xl py-8 flex flex-col items-center gap-2 hover:border-terra hover:bg-terra/5 transition-colors"
        >
          <span className="text-3xl">📸</span>
          <span className="font-display text-sm font-semibold text-muted">
            {photos.length === 0 ? 'Ajouter des photos' : 'Ajouter d\'autres photos'}
          </span>
          <span className="text-xs text-muted/60">JPG, PNG, WEBP — plusieurs fichiers acceptés</span>
        </button>
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handlePhotoFiles(e.target.files)}
        />
      </section>

      {/* ── Section 3 : Articles ── */}
      <section className="bg-cream border border-line rounded-xl p-6">
        <div className="flex items-center justify-between mb-5 pb-3 border-b border-line">
          <div>
            <h2 className="font-display font-bold text-base">
              3 — Articles de l'outfit <span className="text-terra font-normal text-sm">*</span>
            </h2>
            {items.length > 0 && (
              <p className="text-xs text-muted mt-0.5">
                {items.length} article{items.length > 1 ? 's' : ''} •{' '}
                <strong className="text-terra">{formatUSD(totalUSD)}</strong>
                {' '}≈ {(totalUSD * exchangeRate).toLocaleString('fr-FR')} FC
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowPicker(true)}
            className="font-display text-[10px] tracking-widest uppercase font-semibold bg-terra text-cream px-4 py-2 rounded-full hover:bg-terra-dark transition-colors"
          >
            + Ajouter un article
          </button>
        </div>

        {items.length === 0 ? (
          <div className="py-8 text-center text-muted text-sm">
            <div className="text-3xl mb-2">👗</div>
            Aucun article ajouté. Cliquez sur &laquo; Ajouter un article &raquo; pour commencer.
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={item.id} className="flex items-center gap-3 bg-bone rounded-xl p-3">
                {/* Numéro */}
                <div className="w-7 h-7 rounded-full bg-terra text-cream text-[11px] font-display font-bold flex items-center justify-center shrink-0">
                  {idx + 1}
                </div>

                {/* Image produit (si liée) */}
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageUrl}
                    alt=""
                    className="w-10 h-10 rounded-lg object-cover border border-line shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-beige flex items-center justify-center text-lg shrink-0 border border-line">
                    {OUTFIT_ITEM_CATEGORY_EMOJI[item.category] ?? '📦'}
                  </div>
                )}

                {/* Nom */}
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                  placeholder="Nom de l'article"
                  className="flex-1 bg-cream border border-line rounded-lg px-3 py-1.5 text-sm outline-none focus:border-terra min-w-0"
                />

                {/* Catégorie */}
                <select
                  value={item.category}
                  onChange={(e) => updateItem(item.id, 'category', e.target.value)}
                  className="bg-cream border border-line rounded-lg px-2 py-1.5 text-xs outline-none focus:border-terra"
                >
                  {Object.keys(OUTFIT_ITEM_CATEGORY_EMOJI).map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>

                {/* Prix */}
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-xs text-muted">$</span>
                  <input
                    type="number"
                    value={item.priceUSD || ''}
                    onChange={(e) => updateItem(item.id, 'priceUSD', parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-16 bg-cream border border-line rounded-lg px-2 py-1.5 text-sm font-display font-bold text-terra outline-none focus:border-terra text-right"
                  />
                </div>

                {/* Badge lié */}
                {item.productSlug && (
                  <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded font-display font-bold tracking-widest uppercase shrink-0">
                    Lié
                  </span>
                )}

                {/* Supprimer */}
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="text-muted hover:text-terra transition-colors shrink-0 w-7 h-7 rounded flex items-center justify-center hover:bg-terra/10"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Section 4 : Points chauds ── */}
      <section className="bg-cream border border-line rounded-xl p-6">
        <h2 className="font-display font-bold text-base mb-1">4 — Points chauds sur la photo</h2>
        <p className="text-xs text-muted mb-5 pb-3 border-b border-line">
          {items.length === 0
            ? 'Ajoutez d\'abord des articles pour pouvoir placer des points.'
            : photos.length === 0
              ? 'Ajoutez d\'abord une photo pour placer des points.'
              : 'Cliquez sur la photo pour placer un point, puis associez-le à un article.'}
        </p>

        {photos[0] && items.length > 0 && (
          <div className="grid md:grid-cols-[1fr_260px] gap-6">
            {/* Photo avec dots */}
            <div>
              <div
                ref={imgRef}
                className="relative rounded-xl overflow-hidden bg-bone border border-line cursor-crosshair"
                onClick={handleImageClick}
                style={{ aspectRatio: '3/4' }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photos[0]}
                  alt="outfit"
                  className="w-full h-full object-cover"
                  draggable={false}
                />

                {/* Dots existants */}
                {dots.map((dot, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeDot(i); }}
                    className="absolute flex items-center justify-center w-7 h-7 rounded-full bg-cream/95 border-2 border-ink text-[10px] font-display font-bold hover:bg-terra hover:border-terra hover:text-cream transition-colors z-10"
                    style={{
                      left: `calc(${dot.x}% - 14px)`,
                      top: `calc(${dot.y}% - 14px)`,
                    }}
                    title={`Article ${dot.itemIndex + 1} — cliquer pour supprimer`}
                  >
                    {dot.itemIndex + 1}
                  </button>
                ))}

                {/* Dot en attente de confirmation */}
                {dotPending && (
                  <div
                    className="absolute flex items-center justify-center w-7 h-7 rounded-full bg-terra text-cream border-2 border-cream z-20 animate-pulse"
                    style={{
                      left: `calc(${dotPending.x}% - 14px)`,
                      top: `calc(${dotPending.y}% - 14px)`,
                    }}
                  >
                    ?
                  </div>
                )}

                <div className="absolute bottom-2 left-2 right-2 bg-ink/70 text-cream text-[10px] px-2 py-1 rounded-lg font-display tracking-widest uppercase text-center">
                  Cliquez pour placer un point · Cliquez sur un point pour le supprimer
                </div>
              </div>
            </div>

            {/* Panneau latéral */}
            <div className="space-y-4">
              {/* Sélecteur d'article pour dot en attente */}
              {dotPending && (
                <div className="bg-terra/10 border border-terra/30 rounded-xl p-4">
                  <p className="font-display text-[10px] tracking-widest uppercase font-semibold text-terra mb-3">
                    Quel article ?
                  </p>
                  <div className="space-y-1">
                    {items.map((item, idx) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => confirmDot(idx)}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-terra/20 transition-colors text-left text-sm"
                      >
                        <span className="w-5 h-5 rounded-full bg-terra text-cream text-[9px] font-display font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span className="flex-1 truncate font-medium">{item.name || `Article ${idx + 1}`}</span>
                        <span className="text-terra text-xs font-bold shrink-0">${item.priceUSD}</span>
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setDotPending(null)}
                    className="mt-3 w-full text-xs text-muted hover:text-ink transition-colors"
                  >
                    Annuler
                  </button>
                </div>
              )}

              {/* Liste des dots existants */}
              {dots.length > 0 && (
                <div className="bg-bone rounded-xl p-4">
                  <p className="font-display text-[10px] tracking-widest uppercase font-semibold text-muted mb-3">
                    Points placés ({dots.length})
                  </p>
                  <div className="space-y-1">
                    {dots.map((dot, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="w-5 h-5 rounded-full bg-cream border border-ink text-[9px] font-display font-bold flex items-center justify-center shrink-0">
                          {dot.itemIndex + 1}
                        </span>
                        <span className="flex-1 truncate text-ink">
                          {items[dot.itemIndex]?.name || `Article ${dot.itemIndex + 1}`}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeDot(i)}
                          className="text-muted hover:text-terra"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {dots.length === 0 && !dotPending && (
                <div className="text-center py-6 text-muted text-xs">
                  <div className="text-2xl mb-2">🎯</div>
                  Aucun point placé. Cliquez sur la photo pour commencer.
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ── Actions finales ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="font-display text-xs tracking-widest uppercase font-semibold bg-terra text-cream px-8 py-3 rounded-full hover:bg-terra-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Enregistrement…' : isEdit ? '✓ Enregistrer les modifications' : '✓ Publier l\'outfit'}
        </button>

        <button
          type="button"
          onClick={() => router.push('/admin/showroom')}
          disabled={saving}
          className="font-display text-xs tracking-widest uppercase font-semibold border border-line px-6 py-3 rounded-full text-muted hover:text-ink hover:border-ink transition-colors"
        >
          Annuler
        </button>

        {/* Suppression — mode édition seulement */}
        {isEdit && (
          <div className="ml-auto">
            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="font-display text-[10px] tracking-widest uppercase font-semibold text-terra hover:underline"
              >
                Supprimer cet outfit
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-terra font-semibold">Confirmer ?</span>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="font-display text-[10px] tracking-widest uppercase font-semibold bg-terra text-cream px-3 py-1.5 rounded-lg hover:bg-terra-dark disabled:opacity-50 transition-colors"
                >
                  {deleting ? '…' : 'Oui'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="font-display text-[10px] tracking-widest uppercase font-semibold border border-line px-3 py-1.5 rounded-lg hover:bg-bone transition-colors"
                >
                  Non
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Product Picker Modal ── */}
      {showPicker && (
        <ProductPicker
          onSelect={addItem}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}
