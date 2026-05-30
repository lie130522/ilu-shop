'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAdmin } from '@/components/admin/AdminProvider';
import { saveOutfitToFirestore, deleteOutfitFromFirestore } from '@/lib/firebase/outfits';
import { ProductPicker } from './ProductPicker';
import { MannequinBuilder } from './MannequinBuilder';
import { formatUSD } from '@/lib/currency';
import type { Outfit, OutfitItem, OutfitDot, OutfitCategory, OutfitBadgeType, OutfitCreationMode } from '@/lib/showroom/types';
import { OUTFIT_CATEGORY_LABEL, OUTFIT_ITEM_CATEGORY_EMOJI } from '@/lib/showroom/types';
import { ItemLinkModal } from './ItemLinkModal';

// ── Types internes ────────────────────────────────────────────────────────────

interface FormState {
  name: string;
  season: string;
  cat: OutfitCategory;
  badge: string;
  badgeType: OutfitBadgeType | '';
  status: 'published' | 'draft';
}

interface DotPending { x: number; y: number; }

interface OutfitFormProps {
  initialOutfit?: Outfit;
}

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Helper canvas ─────────────────────────────────────────────────────────────

function crRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ── Flat Lay Canvas (Option IA) ───────────────────────────────────────────────

interface FlatLayCanvasProps {
  items: OutfitItem[];
  onCapture: (dataUrl: string) => void;
}

function FlatLayCanvas({ items, onCapture }: FlatLayCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [bgColor, setBgColor] = useState<'cream' | 'white' | 'dark'>('cream');
  const [rendering, setRendering] = useState(false);
  const [captured, setCaptured] = useState(false);

  const redraw = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setRendering(true);
    setCaptured(false);

    const W = 600, H = 800;
    const COLS = 2;
    const PAD = 38;
    const GAP = 16;
    const cellW = Math.floor((W - PAD * 2 - GAP * (COLS - 1)) / COLS);

    const BG = { cream: '#F5F0EB', white: '#FAFAFA', dark: '#1C1C1A' };
    ctx.fillStyle = BG[bgColor];
    ctx.fillRect(0, 0, W, H);

    // Dot grid
    if (bgColor !== 'dark') {
      ctx.fillStyle = 'rgba(155, 133, 121, 0.10)';
      for (let x = 25; x < W; x += 32) {
        for (let y = 25; y < H; y += 32) {
          ctx.beginPath(); ctx.arc(x, y, 1.4, 0, Math.PI * 2); ctx.fill();
        }
      }
    }

    // Watermark
    ctx.fillStyle = bgColor === 'dark' ? 'rgba(245,240,235,0.18)' : 'rgba(60,50,44,0.13)';
    ctx.font = '600 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('ILU SHOP', W / 2, H - 16);

    if (items.length === 0) { setRendering(false); return; }

    const rows = Math.ceil(items.length / COLS);
    const availH = H - PAD * 2 - 30;
    const rawCellH = Math.floor((availH - GAP * (rows - 1)) / rows);
    const cellH = Math.min(rawCellH, 300);
    const TEXT_H = 42;
    const imgMaxH = cellH - TEXT_H - 8;
    const startY = PAD + Math.max(0, (availH - (cellH * rows + GAP * (rows - 1))) / 2);

    await Promise.all(
      items.map((item, idx) => new Promise<void>((resolve) => {
        const col = idx % COLS;
        const row = Math.floor(idx / COLS);
        const cellX = PAD + col * (cellW + GAP);
        const cellY = startY + row * (cellH + GAP);

        // Cell bg
        ctx.fillStyle = bgColor === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(155,133,121,0.07)';
        crRoundedRect(ctx, cellX - 4, cellY - 4, cellW + 8, cellH + 8, 14);
        ctx.fill();

        // Number badge
        ctx.fillStyle = '#C4765A';
        ctx.beginPath();
        ctx.arc(cellX + 16, cellY + 16, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FBF6F0';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(idx + 1), cellX + 16, cellY + 16);

        const drawText = () => {
          const textColor = bgColor === 'dark' ? '#F0EBE5' : '#3C3228';
          ctx.textBaseline = 'top';
          ctx.textAlign = 'center';
          const textY = cellY + imgMaxH + 10;
          ctx.fillStyle = textColor;
          ctx.font = '12px sans-serif';
          const name = item.name.length > 24 ? item.name.slice(0, 24) + '…' : item.name;
          ctx.fillText(name, cellX + cellW / 2, textY);
          ctx.fillStyle = '#C4765A';
          ctx.font = 'bold 12px sans-serif';
          ctx.fillText(`$${item.priceUSD}`, cellX + cellW / 2, textY + 17);
        };

        if (!item.imageUrl) {
          ctx.font = `${Math.min(cellW, imgMaxH) * 0.44}px serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = bgColor === 'dark' ? 'rgba(245,240,235,0.3)' : 'rgba(60,50,44,0.25)';
          ctx.fillText(OUTFIT_ITEM_CATEGORY_EMOJI[item.category] ?? '📦', cellX + cellW / 2, cellY + imgMaxH / 2);
          drawText();
          resolve();
          return;
        }

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          try {
            const ratio = Math.min(cellW / img.width, imgMaxH / img.height);
            const dw = img.width * ratio;
            const dh = img.height * ratio;
            ctx.drawImage(img, cellX + (cellW - dw) / 2, cellY + (imgMaxH - dh) / 2, dw, dh);
          } catch (_) {}
          drawText();
          resolve();
        };
        img.onerror = () => { drawText(); resolve(); };
        img.src = item.imageUrl;
      }))
    );

    setRendering(false);
  }, [items, bgColor]);

  useEffect(() => { redraw(); }, [redraw]);

  return (
    <div className="grid md:grid-cols-[1fr_220px] gap-6">
      <div className="relative">
        <canvas ref={canvasRef} width={600} height={800} className="w-full rounded-xl border border-line" />
        {rendering && (
          <div className="absolute inset-0 bg-cream/60 rounded-xl flex items-center justify-center">
            <span className="font-display text-xs tracking-widest uppercase text-muted animate-pulse">Rendu…</span>
          </div>
        )}
        {captured && !rendering && (
          <div className="absolute top-3 right-3 bg-emerald-600 text-white text-[9px] font-display font-bold tracking-widest uppercase px-2.5 py-1 rounded-full">✓ Capturé</div>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <label className="block font-display text-[10px] tracking-widest uppercase font-semibold text-muted mb-2">Fond</label>
          <div className="flex gap-2">
            {(['cream', 'white', 'dark'] as const).map((c) => (
              <button key={c} type="button" onClick={() => setBgColor(c)}
                className={`flex-1 py-2 rounded-lg text-[10px] font-display font-semibold tracking-widest uppercase border transition-colors ${bgColor === c ? 'border-terra text-terra bg-terra/5' : 'border-line text-muted hover:border-ink'}`}>
                {c === 'cream' ? 'Crème' : c === 'white' ? 'Blanc' : 'Sombre'}
              </button>
            ))}
          </div>
        </div>

        {items.length === 0 ? (
          <div className="bg-bone rounded-xl p-4 text-center text-muted text-xs">
            <div className="text-2xl mb-2">📦</div>
            Ajoutez des articles (Section 3) pour les voir dans le flat lay.
          </div>
        ) : (
          <div className="bg-bone rounded-xl p-3 text-xs text-muted">
            <div className="flex items-start gap-2">
              <span>✨</span>
              <p>{items.length} article{items.length > 1 ? 's' : ''} disposé{items.length > 1 ? 's' : ''} automatiquement.</p>
            </div>
          </div>
        )}

        <button type="button"
          onClick={() => { const c = canvasRef.current; if (!c) return; onCapture(c.toDataURL('image/jpeg', 0.92)); setCaptured(true); }}
          disabled={rendering || items.length === 0}
          className="w-full py-3 bg-terra text-cream font-display text-[10px] tracking-widest uppercase font-bold rounded-xl hover:bg-terra-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          📸 Capturer comme photo principale
        </button>
        <p className="text-[10px] text-muted text-center">Intégration Gemini Image Gen à venir</p>
      </div>
    </div>
  );
}

// ── Composant OutfitForm ──────────────────────────────────────────────────────

export function OutfitForm({ initialOutfit }: OutfitFormProps) {
  const router = useRouter();
  const { currentAdmin, exchangeRate } = useAdmin();
  const isEdit = !!initialOutfit;

  // ── État formulaire ────────────────────────────────────────────────────────
  const [form, setForm] = useState<FormState>({
    name: initialOutfit?.name ?? '',
    season: initialOutfit?.season ?? '',
    cat: initialOutfit?.cat ?? 'casual',
    badge: initialOutfit?.badge ?? '',
    badgeType: initialOutfit?.badgeType ?? '',
    status: initialOutfit?.status ?? 'draft',
  });

  const [creationMode, setCreationMode] = useState<OutfitCreationMode>(
    initialOutfit?.creationMode ?? 'photo',
  );
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
  const [linkingItemId, setLinkingItemId] = useState<string | null>(null);

  const hasLinkedItem = items.some((it) => !!it.productId);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLDivElement>(null);

  // Préremplissage depuis import photo (OutfitImportModal → sessionStorage)
  // + restauration après création produit depuis le catalogue
  useEffect(() => {
    if (isEdit) return;

    // 1. Retour depuis création produit — restaurer l'état de l'outfit + auto-lier
    const returnRaw = sessionStorage.getItem('ilu_outfit_return');
    if (returnRaw) {
      sessionStorage.removeItem('ilu_outfit_return');
      try {
        const ret = JSON.parse(returnRaw) as {
          newProductId: string;
          newProductSlug: string;
          newProductName: string;
          newProductImageUrl: string;
          linkedItemId: string;
          savedState?: {
            form: FormState;
            photos: string[];
            items: OutfitItem[];
            dots: OutfitDot[];
            creationMode: OutfitCreationMode;
          };
        };
        if (ret.savedState) {
          setForm(ret.savedState.form);
          setPhotos(ret.savedState.photos);
          setDots(ret.savedState.dots);
          setCreationMode(ret.savedState.creationMode);
          setItems(
            ret.savedState.items.map((it) =>
              it.id === ret.linkedItemId
                ? {
                    ...it,
                    productId: ret.newProductId,
                    productSlug: ret.newProductSlug,
                    imageUrl: ret.newProductImageUrl || it.imageUrl,
                  }
                : it,
            ),
          );
        }
        return;
      } catch { /* ignore */ }
    }

    // 2. Import depuis photo d'outfit (OutfitImportModal)
    const raw = sessionStorage.getItem('ilu_outfit_import');
    if (!raw) return;
    try {
      sessionStorage.removeItem('ilu_outfit_import');
      const data = JSON.parse(raw) as {
        photo?: string;
        items?: Array<{ name: string; category: string; priceUSD: number; emoji?: string }>;
      };
      if (data.photo) setPhotos([data.photo]);
      if (data.items?.length) {
        setItems(data.items.map((it) => ({
          id: genId(),
          name: it.name,
          category: it.category,
          priceUSD: it.priceUSD,
          emoji: it.emoji,
        })));
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // ── Capture mannequin / flat lay ───────────────────────────────────────────

  /** Capture depuis MannequinBuilder — auto-place les dots */
  const handleCapture = (
    dataUrl: string,
    dotPositions: Record<string, { x: number; y: number }>,
  ) => {
    setPhotos((prev) => (prev.length === 0 ? [dataUrl] : [dataUrl, ...prev.slice(1)]));
    const autoDots: OutfitDot[] = items
      .map((item, idx) => {
        const pos = dotPositions[item.id];
        if (!pos) return null;
        return { x: pos.x, y: pos.y, itemIndex: idx };
      })
      .filter((d): d is OutfitDot => d !== null);
    setDots(autoDots);
  };

  /** Capture depuis FlatLayCanvas */
  const handleFlatLayCapture = (dataUrl: string) => {
    setPhotos((prev) => (prev.length === 0 ? [dataUrl] : [dataUrl, ...prev.slice(1)]));
  };

  // ── Items ──────────────────────────────────────────────────────────────────

  const addItem = (partial: Omit<OutfitItem, 'id'>) => {
    setItems((prev) => [...prev, { ...partial, id: genId() }]);
  };

  const updateItem = <K extends keyof OutfitItem>(id: string, key: K, val: OutfitItem[K]) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, [key]: val } : it)));
  };

  const removeItem = (id: string) => {
    const idx = items.findIndex((it) => it.id === id);
    setDots((prev) =>
      prev
        .filter((d) => d.itemIndex !== idx)
        .map((d) => ({ ...d, itemIndex: d.itemIndex > idx ? d.itemIndex - 1 : d.itemIndex })),
    );
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const relinkItem = (itemId: string, productId: string, productSlug: string, imageUrl: string) => {
    setItems((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, productId, productSlug, imageUrl } : it)),
    );
  };

  const unlinkItem = (itemId: string) => {
    setItems((prev) =>
      prev.map((it) =>
        it.id === itemId ? { ...it, productId: undefined, productSlug: undefined } : it,
      ),
    );
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
      setSaveError("Le nom de l'outfit est requis.");
      return;
    }
    if (photos.length === 0) {
      setSaveError(
        creationMode === 'mannequin'
          ? 'Capturez le mannequin avec "📸 Capturer" avant de publier.'
          : creationMode === 'ai'
          ? 'Capturez le flat lay avec "📸 Capturer" avant de publier.'
          : 'Ajoutez au moins une photo.',
      );
      return;
    }
    if (items.length === 0) {
      setSaveError('Ajoutez au moins un article.');
      return;
    }
    if (form.status === 'published' && !hasLinkedItem) {
      setSaveError(
        'Au moins un article doit être lié au catalogue pour publier cet outfit. Cliquez sur "⚠ Lier" sur un article pour le connecter ou le créer dans le catalogue.',
      );
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
      creationMode,
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
            <input type="text" value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="ex: Look Terracotta Cargo"
              className="w-full bg-bone border border-line rounded-lg px-4 py-2.5 text-sm outline-none focus:border-terra" />
          </div>
          <div>
            <label className="block font-display text-[10px] tracking-widest uppercase font-semibold text-muted mb-1.5">
              Saison / Collection
            </label>
            <input type="text" value={form.season}
              onChange={(e) => setForm((f) => ({ ...f, season: e.target.value }))}
              placeholder="ex: Automne 2026"
              className="w-full bg-bone border border-line rounded-lg px-4 py-2.5 text-sm outline-none focus:border-terra" />
          </div>
          <div>
            <label className="block font-display text-[10px] tracking-widest uppercase font-semibold text-muted mb-1.5">
              Catégorie
            </label>
            <select value={form.cat}
              onChange={(e) => setForm((f) => ({ ...f, cat: e.target.value as OutfitCategory }))}
              className="w-full bg-bone border border-line rounded-lg px-4 py-2.5 text-sm outline-none focus:border-terra">
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
              <input type="text" value={form.badge}
                onChange={(e) => setForm((f) => ({ ...f, badge: e.target.value }))}
                placeholder="ex: Nouveau, Tendance…"
                className="flex-1 bg-bone border border-line rounded-lg px-4 py-2.5 text-sm outline-none focus:border-terra" />
              <select value={form.badgeType}
                onChange={(e) => setForm((f) => ({ ...f, badgeType: e.target.value as OutfitBadgeType | '' }))}
                className="bg-bone border border-line rounded-lg px-3 py-2.5 text-sm outline-none focus:border-terra">
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
                <button key={s} type="button"
                  onClick={() => setForm((f) => ({ ...f, status: s }))}
                  className={`flex-1 py-2.5 rounded-lg border text-xs font-display font-semibold tracking-widest uppercase transition-colors ${
                    form.status === s
                      ? s === 'published'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-ink text-cream border-ink'
                      : 'bg-bone border-line text-muted hover:border-ink'
                  }`}>
                  {s === 'draft' ? 'Brouillon' : 'Publié'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 2 : Méthode de création ── */}
      <section className="bg-cream border border-line rounded-xl p-6">
        <h2 className="font-display font-bold text-base mb-5 pb-3 border-b border-line flex items-center gap-3">
          <span>
            2 — Méthode de création{' '}
            <span className="text-terra font-normal text-sm">*</span>
          </span>
          {creationMode !== 'photo' && photos.length > 0 && (
            <span className="text-emerald-600 text-xs font-semibold font-display tracking-widest uppercase">
              ✓ Photo capturée
            </span>
          )}
        </h2>

        {/* ── Sélecteur de mode ── */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {([
            { key: 'photo',     icon: '📸', label: 'Photo',     sub: 'Upload direct'   },
            { key: 'mannequin', icon: '🧍', label: 'Mannequin', sub: 'Corps vectoriel' },
            { key: 'ai',        icon: '✨', label: 'Flat Lay',  sub: 'Disposition auto'},
          ] as const).map(({ key, icon, label, sub }) => (
            <button key={key} type="button" onClick={() => setCreationMode(key)}
              className={`flex flex-col items-center gap-1.5 py-4 px-3 rounded-xl border-2 transition-all ${
                creationMode === key
                  ? 'border-ink bg-ink text-cream'
                  : 'border-line bg-bone text-muted hover:border-ink/40 hover:text-ink'
              }`}>
              <span className="text-xl">{icon}</span>
              <span className="font-display font-bold text-[10px] tracking-widest uppercase">{label}</span>
              <span className={`text-[9px] leading-tight ${creationMode === key ? 'text-cream/70' : 'text-muted/80'}`}>
                {sub}
              </span>
            </button>
          ))}
        </div>

        {/* ── Mode Photo ── */}
        {creationMode === 'photo' && (
          <>
            {photos.length > 0 && (
              <div className="grid grid-cols-3 gap-3 mb-4">
                {photos.map((src, i) => (
                  <div key={i} className="relative aspect-[3/4] rounded-xl overflow-hidden bg-bone border border-line group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`photo ${i + 1}`} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-ink/0 group-hover:bg-ink/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                      {i > 0 && (
                        <button type="button" onClick={() => movePhoto(i, i - 1)}
                          className="w-8 h-8 bg-cream rounded-full flex items-center justify-center text-sm hover:bg-bone" title="Monter">←</button>
                      )}
                      <button type="button" onClick={() => removePhoto(i)}
                        className="w-8 h-8 bg-terra text-cream rounded-full flex items-center justify-center text-sm" title="Supprimer">✕</button>
                      {i < photos.length - 1 && (
                        <button type="button" onClick={() => movePhoto(i, i + 1)}
                          className="w-8 h-8 bg-cream rounded-full flex items-center justify-center text-sm hover:bg-bone" title="Descendre">→</button>
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
            <button type="button" onClick={() => photoInputRef.current?.click()}
              className="w-full border-2 border-dashed border-line rounded-xl py-8 flex flex-col items-center gap-2 hover:border-terra hover:bg-terra/5 transition-colors">
              <span className="text-3xl">📸</span>
              <span className="font-display text-sm font-semibold text-muted">
                {photos.length === 0 ? 'Ajouter des photos' : "Ajouter d'autres photos"}
              </span>
              <span className="text-xs text-muted/60">JPG, PNG, WEBP — plusieurs fichiers acceptés</span>
            </button>
          </>
        )}

        {/* ── Mode Mannequin ── */}
        {creationMode === 'mannequin' && (
          <>
            <MannequinBuilder items={items} onCapture={handleCapture} />
            {photos.length > 0 && (
              <div className="mt-6 pt-5 border-t border-line">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-display text-[10px] tracking-widest uppercase font-semibold text-muted">
                    Photos ({photos.length})
                    <span className="text-terra ml-1">· 1re = mannequin</span>
                  </p>
                  <button type="button" onClick={() => photoInputRef.current?.click()}
                    className="font-display text-[10px] tracking-widest uppercase font-semibold text-terra hover:underline">
                    + Photo supplémentaire
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {photos.map((src, i) => (
                    <div key={i} className="relative aspect-[3/4] rounded-lg overflow-hidden bg-bone border border-line group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt={`photo ${i + 1}`} className="w-full h-full object-cover" />
                      <button type="button" onClick={() => removePhoto(i)}
                        className="absolute top-1 right-1 w-5 h-5 bg-terra text-cream rounded-full text-[9px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">✕</button>
                      {i === 0 && (
                        <span className="absolute bottom-1 left-1 bg-terra text-cream text-[8px] font-display font-bold px-1.5 py-0.5 rounded">🧍</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Mode Flat Lay IA ── */}
        {creationMode === 'ai' && (
          <>
            <FlatLayCanvas items={items} onCapture={handleFlatLayCapture} />
            {photos.length > 0 && (
              <div className="mt-6 pt-5 border-t border-line">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-display text-[10px] tracking-widest uppercase font-semibold text-muted">
                    Photos ({photos.length})
                    <span className="text-terra ml-1">· 1re = flat lay</span>
                  </p>
                  <button type="button" onClick={() => photoInputRef.current?.click()}
                    className="font-display text-[10px] tracking-widest uppercase font-semibold text-terra hover:underline">
                    + Photo supplémentaire
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {photos.map((src, i) => (
                    <div key={i} className="relative aspect-[3/4] rounded-lg overflow-hidden bg-bone border border-line group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt={`photo ${i + 1}`} className="w-full h-full object-cover" />
                      <button type="button" onClick={() => removePhoto(i)}
                        className="absolute top-1 right-1 w-5 h-5 bg-terra text-cream rounded-full text-[9px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">✕</button>
                      {i === 0 && (
                        <span className="absolute bottom-1 left-1 bg-terra text-cream text-[8px] font-display font-bold px-1.5 py-0.5 rounded">✨</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Input fichier partagé tous modes */}
        <input ref={photoInputRef} type="file" accept="image/*" multiple className="hidden"
          onChange={(e) => handlePhotoFiles(e.target.files)} />
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
          <button type="button" onClick={() => setShowPicker(true)}
            className="font-display text-[10px] tracking-widest uppercase font-semibold bg-terra text-cream px-4 py-2 rounded-full hover:bg-terra-dark transition-colors">
            + Ajouter un article
          </button>
        </div>

        {items.length > 0 && !hasLinkedItem && form.status === 'published' && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
            ⚠ Aucun article n'est lié au catalogue. Liez au moins un article avant de publier — les autres pourront être proposés en précommande.
          </div>
        )}

        {items.length === 0 ? (
          <div className="py-8 text-center text-muted text-sm">
            <div className="text-3xl mb-2">👗</div>
            Aucun article ajouté. Cliquez sur « Ajouter un article » pour commencer.
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={item.id} className="flex items-center gap-3 bg-bone rounded-xl p-3">
                <div className="w-7 h-7 rounded-full bg-terra text-cream text-[11px] font-display font-bold flex items-center justify-center shrink-0">
                  {idx + 1}
                </div>
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover border border-line shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-beige flex items-center justify-center text-lg shrink-0 border border-line">
                    {OUTFIT_ITEM_CATEGORY_EMOJI[item.category] ?? '📦'}
                  </div>
                )}
                <input type="text" value={item.name}
                  onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                  placeholder="Nom de l'article"
                  className="flex-1 bg-cream border border-line rounded-lg px-3 py-1.5 text-sm outline-none focus:border-terra min-w-0" />
                <select value={item.category}
                  onChange={(e) => updateItem(item.id, 'category', e.target.value)}
                  className="bg-cream border border-line rounded-lg px-2 py-1.5 text-xs outline-none focus:border-terra">
                  {Object.keys(OUTFIT_ITEM_CATEGORY_EMOJI).map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-xs text-muted">$</span>
                  <input type="number" value={item.priceUSD || ''}
                    onChange={(e) => updateItem(item.id, 'priceUSD', parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-16 bg-cream border border-line rounded-lg px-2 py-1.5 text-sm font-display font-bold text-terra outline-none focus:border-terra text-right" />
                </div>
                <button
                  type="button"
                  onClick={() => setLinkingItemId(item.id)}
                  title={item.productId ? 'Lié au catalogue — cliquer pour modifier' : 'Non lié — cliquer pour lier au catalogue'}
                  className={`text-[9px] px-2 py-0.5 rounded font-display font-bold tracking-widest uppercase shrink-0 border transition-colors ${
                    item.productId
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                      : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                  }`}
                >
                  {item.productId ? '✓ Lié' : '⚠ Lier'}
                </button>
                <button type="button" onClick={() => removeItem(item.id)}
                  className="text-muted hover:text-terra transition-colors shrink-0 w-7 h-7 rounded flex items-center justify-center hover:bg-terra/10">
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
            ? "Ajoutez d'abord des articles pour pouvoir placer des points."
            : photos.length === 0
            ? "Ajoutez d'abord une photo pour placer des points."
            : creationMode === 'mannequin' && dots.length > 0
            ? `${dots.length} point${dots.length > 1 ? 's' : ''} auto-placé${dots.length > 1 ? 's' : ''} depuis le mannequin. Ajustez si besoin en cliquant sur la photo.`
            : 'Cliquez sur la photo pour placer un point, puis associez-le à un article.'}
        </p>

        {photos[0] && items.length > 0 && (
          <div className="grid md:grid-cols-[1fr_260px] gap-6">
            <div>
              <div ref={imgRef}
                className="relative rounded-xl overflow-hidden bg-bone border border-line cursor-crosshair"
                onClick={handleImageClick}
                style={{ aspectRatio: '3/4' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photos[0]} alt="outfit" className="w-full h-full object-cover" draggable={false} />

                {dots.map((dot, i) => (
                  <button key={i} type="button"
                    onClick={(e) => { e.stopPropagation(); removeDot(i); }}
                    className="absolute flex items-center justify-center w-7 h-7 rounded-full bg-cream/95 border-2 border-ink text-[10px] font-display font-bold hover:bg-terra hover:border-terra hover:text-cream transition-colors z-10"
                    style={{ left: `calc(${dot.x}% - 14px)`, top: `calc(${dot.y}% - 14px)` }}
                    title={`Article ${dot.itemIndex + 1} — cliquer pour supprimer`}>
                    {dot.itemIndex + 1}
                  </button>
                ))}

                {dotPending && (
                  <div className="absolute flex items-center justify-center w-7 h-7 rounded-full bg-terra text-cream border-2 border-cream z-20 animate-pulse"
                    style={{ left: `calc(${dotPending.x}% - 14px)`, top: `calc(${dotPending.y}% - 14px)` }}>
                    ?
                  </div>
                )}

                <div className="absolute bottom-2 left-2 right-2 bg-ink/70 text-cream text-[10px] px-2 py-1 rounded-lg font-display tracking-widest uppercase text-center">
                  Cliquer pour placer · Cliquer sur un point pour supprimer
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {dotPending && (
                <div className="bg-terra/10 border border-terra/30 rounded-xl p-4">
                  <p className="font-display text-[10px] tracking-widest uppercase font-semibold text-terra mb-3">
                    Quel article ?
                  </p>
                  <div className="space-y-1">
                    {items.map((item, idx) => (
                      <button key={item.id} type="button" onClick={() => confirmDot(idx)}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-terra/20 transition-colors text-left text-sm">
                        <span className="w-5 h-5 rounded-full bg-terra text-cream text-[9px] font-display font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span className="flex-1 truncate font-medium">{item.name || `Article ${idx + 1}`}</span>
                        <span className="text-terra text-xs font-bold shrink-0">${item.priceUSD}</span>
                      </button>
                    ))}
                  </div>
                  <button type="button" onClick={() => setDotPending(null)}
                    className="mt-3 w-full text-xs text-muted hover:text-ink transition-colors">
                    Annuler
                  </button>
                </div>
              )}

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
                        <button type="button" onClick={() => removeDot(i)} className="text-muted hover:text-terra">✕</button>
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
        <button type="button" onClick={handleSave} disabled={saving}
          className="font-display text-xs tracking-widest uppercase font-semibold bg-terra text-cream px-8 py-3 rounded-full hover:bg-terra-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          {saving ? 'Enregistrement…' : isEdit ? '✓ Enregistrer les modifications' : "✓ Publier l'outfit"}
        </button>

        <button type="button" onClick={() => router.push('/admin/showroom')} disabled={saving}
          className="font-display text-xs tracking-widest uppercase font-semibold border border-line px-6 py-3 rounded-full text-muted hover:text-ink hover:border-ink transition-colors">
          Annuler
        </button>

        {isEdit && (
          <div className="ml-auto">
            {!confirmDelete ? (
              <button type="button" onClick={() => setConfirmDelete(true)}
                className="font-display text-[10px] tracking-widest uppercase font-semibold text-terra hover:underline">
                Supprimer cet outfit
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-terra font-semibold">Confirmer ?</span>
                <button type="button" onClick={handleDelete} disabled={deleting}
                  className="font-display text-[10px] tracking-widest uppercase font-semibold bg-terra text-cream px-3 py-1.5 rounded-lg hover:bg-terra-dark disabled:opacity-50 transition-colors">
                  {deleting ? '…' : 'Oui'}
                </button>
                <button type="button" onClick={() => setConfirmDelete(false)}
                  className="font-display text-[10px] tracking-widest uppercase font-semibold border border-line px-3 py-1.5 rounded-lg hover:bg-bone transition-colors">
                  Non
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Product Picker Modal ── */}
      {showPicker && (
        <ProductPicker onSelect={addItem} onClose={() => setShowPicker(false)} />
      )}

      {/* ── Item Link Modal ── */}
      {linkingItemId && (() => {
        const item = items.find((it) => it.id === linkingItemId);
        if (!item) return null;
        return (
          <ItemLinkModal
            item={item}
            onLink={(productId, productSlug, imageUrl) =>
              relinkItem(linkingItemId, productId, productSlug, imageUrl)
            }
            onUnlink={() => unlinkItem(linkingItemId)}
            onClose={() => setLinkingItemId(null)}
            outfitContext={{
              itemId: linkingItemId,
              itemName: item.name,
              itemCategory: item.category,
              itemPriceUSD: item.priceUSD,
              outfitPhoto: photos[0] ?? null,
              outfitState: { form, photos, items, dots, creationMode },
            }}
          />
        );
      })()}
    </div>
  );
}
