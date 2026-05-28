'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import type { OutfitItem } from '@/lib/showroom/types';

// ── Dimensions du canvas ──────────────────────────────────────────────────────

export const MANNEQUIN_CANVAS_W = 600;
export const MANNEQUIN_CANVAS_H = 800;
const CX = MANNEQUIN_CANVAS_W / 2; // 300
const CY = MANNEQUIN_CANVAS_H / 2; // 400

// ── Types de mannequin ────────────────────────────────────────────────────────

export type MannequinType =
  | 'adult-m' | 'adult-f'
  | 'teen-m'  | 'teen-f'
  | 'child-m' | 'child-f'
  | 'senior-m'| 'senior-f';

export const MANNEQUIN_LABELS: Record<MannequinType, string> = {
  'adult-m':  'Adulte H',
  'adult-f':  'Adulte F',
  'teen-m':   'Ado H',
  'teen-f':   'Ado F',
  'child-m':  'Enfant G',
  'child-f':  'Enfant F',
  'senior-m': 'Senior H',
  'senior-f': 'Senior F',
};

type MannequinConfig = { scale: number; shoulderW: number; waistW: number; hipW: number };

const MANNEQUIN_CONFIGS: Record<MannequinType, MannequinConfig> = {
  'adult-m':  { scale: 1.00, shoulderW: 108, waistW: 82, hipW: 92  },
  'adult-f':  { scale: 1.00, shoulderW: 94,  waistW: 68, hipW: 104 },
  'teen-m':   { scale: 0.83, shoulderW: 100, waistW: 78, hipW: 86  },
  'teen-f':   { scale: 0.83, shoulderW: 89,  waistW: 66, hipW: 98  },
  'child-m':  { scale: 0.66, shoulderW: 96,  waistW: 82, hipW: 88  },
  'child-f':  { scale: 0.66, shoulderW: 90,  waistW: 79, hipW: 92  },
  'senior-m': { scale: 0.97, shoulderW: 105, waistW: 90, hipW: 96  },
  'senior-f': { scale: 0.97, shoulderW: 92,  waistW: 78, hipW: 106 },
};

// ── Zones du corps (base scale=1.0) ───────────────────────────────────────────

export type BodyZoneKey =
  | 'haut' | 'veste' | 'bas' | 'chaussures'
  | 'ceinture' | 'sac' | 'montre' | 'bijou' | 'accessoire';

export const ZONE_LABELS: Record<BodyZoneKey, string> = {
  haut:       'Haut du corps',
  veste:      'Veste / Manteau',
  bas:        'Bas du corps',
  chaussures: 'Chaussures',
  ceinture:   'Ceinture',
  sac:        'Sac',
  montre:     'Montre',
  bijou:      'Bijou / Collier',
  accessoire: 'Accessoire',
};

// Coordonnées de référence pour scale=1.0 (adult)
export const BASE_CANVAS_ZONES: Record<BodyZoneKey, { cx: number; cy: number; maxW: number; maxH: number }> = {
  haut:       { cx: 300, cy: 288, maxW: 210, maxH: 195 },
  veste:      { cx: 300, cy: 280, maxW: 265, maxH: 245 },
  bas:        { cx: 300, cy: 597, maxW: 208, maxH: 268 },
  chaussures: { cx: 300, cy: 762, maxW: 248, maxH: 72  },
  ceinture:   { cx: 300, cy: 448, maxW: 200, maxH: 40  },
  sac:        { cx: 488, cy: 360, maxW: 125, maxH: 138 },
  montre:     { cx: 132, cy: 362, maxW: 66,  maxH: 66  },
  bijou:      { cx: 300, cy: 168, maxW: 86,  maxH: 48  },
  accessoire: { cx: 492, cy: 256, maxW: 86,  maxH: 78  },
};

// Calcule la zone réelle après scale (le canvas ne change pas, c'est le corps qui scale)
export function getScaledZone(
  baseZone: { cx: number; cy: number; maxW: number; maxH: number },
  scale: number,
) {
  return {
    cx: CX + scale * (baseZone.cx - CX),
    cy: CY + scale * (baseZone.cy - CY),
    maxW: baseZone.maxW * scale,
    maxH: baseZone.maxH * scale,
  };
}

// Devine la zone à partir de la catégorie de l'article
export function guessZone(category: string): BodyZoneKey {
  const c = category.toLowerCase();
  if (c.includes('chaussure') || c.includes('shoe') || c.includes('sneaker') || c.includes('basket')) return 'chaussures';
  if (c.includes('bijou') || c.includes('collier') || c.includes('bague') || c.includes('bracelet') || c.includes('boucle')) return 'bijou';
  if (c.includes('montre') || c.includes('wearable') || c.includes('watch')) return 'montre';
  if (c.includes('sac') || c.includes('bag') || c.includes('maroquin') || c.includes('pochette')) return 'sac';
  if (c.includes('veste') || c.includes('jacket') || c.includes('manteau') || c.includes('coat') || c.includes('blazer')) return 'veste';
  if (c.includes('ceinture') || c.includes('belt')) return 'ceinture';
  if (c.includes('bas') || c.includes('pant') || c.includes('jean') || c.includes('short') || c.includes('jupe') || c.includes('skirt') || c.includes('legging')) return 'bas';
  return 'haut'; // Mode, chemise, t-shirt, pull → haut par défaut
}

// ── Dessin du corps ───────────────────────────────────────────────────────────

function drawMannequinBody(ctx: CanvasRenderingContext2D, cfg: MannequinConfig) {
  const { shoulderW, waistW, hipW } = cfg;

  ctx.fillStyle = 'rgba(198, 178, 165, 0.15)';
  ctx.strokeStyle = 'rgba(155, 133, 121, 0.50)';
  ctx.lineWidth = 1.8;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // HEAD
  ctx.beginPath();
  ctx.ellipse(CX, 82, 50, 58, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();

  // NECK
  ctx.beginPath();
  ctx.moveTo(CX - 22, 137);
  ctx.lineTo(CX + 22, 137);
  ctx.lineTo(CX + 20, 168);
  ctx.lineTo(CX - 20, 168);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  // TORSO
  ctx.beginPath();
  ctx.moveTo(CX - shoulderW, 168);
  ctx.bezierCurveTo(CX - shoulderW, 200, CX - waistW - 8, 340, CX - waistW, 434);
  ctx.lineTo(CX + waistW, 434);
  ctx.bezierCurveTo(CX + waistW + 8, 340, CX + shoulderW, 200, CX + shoulderW, 168);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  // HIPS
  ctx.beginPath();
  ctx.moveTo(CX - waistW, 434);
  ctx.bezierCurveTo(CX - waistW - 6, 452, CX - hipW, 462, CX - hipW, 478);
  ctx.lineTo(CX + hipW, 478);
  ctx.bezierCurveTo(CX + hipW, 462, CX + waistW + 6, 452, CX + waistW, 434);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  // LEFT LEG
  ctx.beginPath();
  ctx.moveTo(CX - hipW, 478);
  ctx.lineTo(CX - 13, 478);
  ctx.lineTo(CX - 15, 756);
  ctx.lineTo(CX - hipW + 4, 756);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  // RIGHT LEG
  ctx.beginPath();
  ctx.moveTo(CX + 13, 478);
  ctx.lineTo(CX + hipW, 478);
  ctx.lineTo(CX + hipW - 4, 756);
  ctx.lineTo(CX + 15, 756);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  // LEFT FOOT
  ctx.beginPath();
  ctx.ellipse(CX - hipW / 2 - 5, 773, 54, 19, -0.08, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();

  // RIGHT FOOT
  ctx.beginPath();
  ctx.ellipse(CX + hipW / 2 + 5, 773, 54, 19, 0.08, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();

  // LEFT ARM
  ctx.beginPath();
  ctx.moveTo(CX - shoulderW, 168);
  ctx.bezierCurveTo(CX - shoulderW - 34, 168, CX - shoulderW - 56, 282, CX - shoulderW - 48, 422);
  ctx.lineTo(CX - shoulderW - 48 + 34, 432);
  ctx.bezierCurveTo(CX - shoulderW - 14, 282, CX - shoulderW + 2, 178, CX - shoulderW + 2, 176);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  // RIGHT ARM
  ctx.beginPath();
  ctx.moveTo(CX + shoulderW, 168);
  ctx.bezierCurveTo(CX + shoulderW + 34, 168, CX + shoulderW + 56, 282, CX + shoulderW + 48, 422);
  ctx.lineTo(CX + shoulderW + 48 - 34, 432);
  ctx.bezierCurveTo(CX + shoulderW + 14, 282, CX + shoulderW - 2, 178, CX + shoulderW - 2, 176);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
}

// ── Rendu complet du canvas ───────────────────────────────────────────────────

async function renderMannequinCanvas(
  ctx: CanvasRenderingContext2D,
  mannequinType: MannequinType,
  bgColor: 'cream' | 'white' | 'dark',
  items: OutfitItem[],
  zones: Record<string, BodyZoneKey>,
): Promise<void> {
  const W = MANNEQUIN_CANVAS_W;
  const H = MANNEQUIN_CANVAS_H;
  const cfg = MANNEQUIN_CONFIGS[mannequinType];

  // Background
  const BG = { cream: '#F5F0EB', white: '#FAFAFA', dark: '#1C1C1A' };
  ctx.fillStyle = BG[bgColor];
  ctx.fillRect(0, 0, W, H);

  // Subtle dot grid (cream / white only)
  if (bgColor !== 'dark') {
    ctx.fillStyle = 'rgba(155, 133, 121, 0.10)';
    for (let x = 25; x < W; x += 32) {
      for (let y = 25; y < H; y += 32) {
        ctx.beginPath();
        ctx.arc(x, y, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Mannequin outline — scaled around canvas center
  ctx.save();
  ctx.translate(CX, CY);
  ctx.scale(cfg.scale, cfg.scale);
  ctx.translate(-CX, -CY);
  drawMannequinBody(ctx, cfg);
  ctx.restore();

  // Product images on body zones
  const itemsWithImages = items.filter((it) => it.imageUrl && zones[it.id]);
  await Promise.all(
    itemsWithImages.map(
      (it) =>
        new Promise<void>((resolve) => {
          const baseZone = BASE_CANVAS_ZONES[zones[it.id]];
          if (!baseZone) { resolve(); return; }
          const zone = getScaledZone(baseZone, cfg.scale);

          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            try {
              const ratio = Math.min(zone.maxW / img.width, zone.maxH / img.height);
              const dw = img.width * ratio;
              const dh = img.height * ratio;
              ctx.drawImage(img, zone.cx - dw / 2, zone.cy - dh / 2, dw, dh);
            } catch (_) { /* canvas tainted — skip */ }
            resolve();
          };
          img.onerror = () => resolve();
          img.src = it.imageUrl!;
        }),
    ),
  );
}

// ── Composant React ───────────────────────────────────────────────────────────

interface MannequinBuilderProps {
  items: OutfitItem[];
  onCapture: (dataUrl: string, dotPositions: Record<string, { x: number; y: number }>) => void;
}

export function MannequinBuilder({ items, onCapture }: MannequinBuilderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mannequinType, setMannequinType] = useState<MannequinType>('adult-m');
  const [bgColor, setBgColor] = useState<'cream' | 'white' | 'dark'>('cream');
  const [zones, setZones] = useState<Record<string, BodyZoneKey>>(() => {
    const init: Record<string, BodyZoneKey> = {};
    items.forEach((it) => { init[it.id] = guessZone(it.category); });
    return init;
  });
  const [rendering, setRendering] = useState(false);
  const [captured, setCaptured] = useState(false);

  // Sync zones when new items are added
  useEffect(() => {
    setZones((prev) => {
      const next = { ...prev };
      items.forEach((it) => { if (!next[it.id]) next[it.id] = guessZone(it.category); });
      return next;
    });
  }, [items]);

  // Re-render canvas
  const redraw = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setRendering(true);
    setCaptured(false);
    await renderMannequinCanvas(ctx, mannequinType, bgColor, items, zones);
    setRendering(false);
  }, [mannequinType, bgColor, items, zones]);

  useEffect(() => { redraw(); }, [redraw]);

  const handleCapture = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

    // Compute dot positions as % of canvas size
    const cfg = MANNEQUIN_CONFIGS[mannequinType];
    const dotPositions: Record<string, { x: number; y: number }> = {};
    items.forEach((it) => {
      const baseZone = BASE_CANVAS_ZONES[zones[it.id] ?? guessZone(it.category)];
      if (!baseZone) return;
      const z = getScaledZone(baseZone, cfg.scale);
      dotPositions[it.id] = {
        x: (z.cx / MANNEQUIN_CANVAS_W) * 100,
        y: (z.cy / MANNEQUIN_CANVAS_H) * 100,
      };
    });

    onCapture(dataUrl, dotPositions);
    setCaptured(true);
  };

  return (
    <div className="grid md:grid-cols-[1fr_280px] gap-6">
      {/* Canvas */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={MANNEQUIN_CANVAS_W}
          height={MANNEQUIN_CANVAS_H}
          className="w-full rounded-xl border border-line"
        />
        {rendering && (
          <div className="absolute inset-0 bg-cream/60 rounded-xl flex items-center justify-center">
            <span className="font-display text-xs tracking-widest uppercase text-muted animate-pulse">
              Rendu…
            </span>
          </div>
        )}
        {captured && !rendering && (
          <div className="absolute top-3 right-3 bg-emerald-600 text-white text-[9px] font-display font-bold tracking-widest uppercase px-2.5 py-1 rounded-full">
            ✓ Capturé
          </div>
        )}
      </div>

      {/* Contrôles */}
      <div className="space-y-5">
        {/* Type de mannequin */}
        <div>
          <label className="block font-display text-[10px] tracking-widest uppercase font-semibold text-muted mb-2">
            Type de mannequin
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {(Object.entries(MANNEQUIN_LABELS) as [MannequinType, string][]).map(([type, label]) => (
              <button
                key={type}
                type="button"
                onClick={() => setMannequinType(type)}
                className={`py-2 px-2 rounded-lg text-[10px] font-display font-semibold tracking-widest uppercase transition-colors border ${
                  mannequinType === type
                    ? 'bg-ink text-cream border-ink'
                    : 'bg-bone border-line text-muted hover:border-ink hover:text-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Fond */}
        <div>
          <label className="block font-display text-[10px] tracking-widest uppercase font-semibold text-muted mb-2">
            Fond
          </label>
          <div className="flex gap-2">
            {(['cream', 'white', 'dark'] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setBgColor(c)}
                className={`flex-1 py-2 rounded-lg text-[10px] font-display font-semibold tracking-widest uppercase border transition-colors ${
                  bgColor === c
                    ? 'border-terra text-terra bg-terra/5'
                    : 'border-line text-muted hover:border-ink'
                }`}
              >
                {c === 'cream' ? 'Crème' : c === 'white' ? 'Blanc' : 'Sombre'}
              </button>
            ))}
          </div>
        </div>

        {/* Position des articles */}
        {items.length === 0 ? (
          <div className="bg-bone rounded-xl p-4 text-center text-muted text-xs">
            <div className="text-2xl mb-2">👗</div>
            Ajoutez des articles (Section 3) pour les voir apparaître sur le mannequin.
          </div>
        ) : (
          <div>
            <label className="block font-display text-[10px] tracking-widest uppercase font-semibold text-muted mb-2">
              Position des articles
            </label>
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
              {items.map((item, idx) => (
                <div key={item.id} className="flex items-center gap-2 bg-bone rounded-lg p-2">
                  <div className="w-5 h-5 rounded-full bg-terra text-cream text-[9px] font-display font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </div>
                  <span className="flex-1 text-xs truncate font-medium text-ink min-w-0">
                    {item.name || `Article ${idx + 1}`}
                  </span>
                  <select
                    value={zones[item.id] ?? 'haut'}
                    onChange={(e) =>
                      setZones((prev) => ({ ...prev, [item.id]: e.target.value as BodyZoneKey }))
                    }
                    className="bg-cream border border-line rounded px-1.5 py-1 text-[10px] outline-none focus:border-terra shrink-0"
                  >
                    {(Object.entries(ZONE_LABELS) as [BodyZoneKey, string][]).map(([k, l]) => (
                      <option key={k} value={k}>{l}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bouton capturer */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={handleCapture}
            disabled={rendering || items.length === 0}
            className="w-full py-3 bg-terra text-cream font-display text-[10px] tracking-widest uppercase font-bold rounded-xl hover:bg-terra-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            📸 Capturer comme photo principale
          </button>
          <p className="text-[10px] text-muted text-center leading-relaxed">
            Les points chauds seront placés automatiquement à chaque zone.
          </p>
        </div>
      </div>
    </div>
  );
}
