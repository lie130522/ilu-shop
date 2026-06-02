'use client';
// ─── ILU SHOP — Composants partagés du formulaire produit ────────────────────
// Utilisé par : nouveau/page.tsx  et  [id]/modifier/page.tsx

import { useRef, useState, useCallback } from 'react';
import {
  SUBCATEGORIES,
  DEFAULT_SIZES,
  type ProductCategory,
  type ProductColor,
  type StoredImage,
  type StoredVideo,
  type ImagePipelineStatus,
} from '@/lib/admin/product-store';
import { usdToCdf, formatCDF, USD_TO_CDF_RATE } from '@/lib/currency';

// ── Types ─────────────────────────────────────────────────────────────────────

export type Step = 'infos' | 'variantes' | 'medias' | 'pipeline' | 'publication';

export interface DraftImage extends StoredImage {
  file?: File;
  upscaleStatus?: ImagePipelineStatus;
}

export interface DraftVideo extends StoredVideo {
  file?: File;
}

export interface FormState {
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
  badge?: 'new' | 'sale' | 'hot';
  /** Base64 data URL par couleur (hex → dataUrl) — uploadé vers Storage à la publication */
  colorImages: Record<string, string>;
  /** Spécifications produit */
  brand: string;
  material: string;
  ram: string[];
  connectivity: string[];
  /** Infos additionnelles */
  genre?: 'femme' | 'homme' | 'mixte' | 'enfant';
  modele: string;
  platform: string;
  deliveryMode?: 'activation_code' | 'configured_account' | 'direct_recharge';
  rdcAvailability?: 'confirmed' | 'to_verify' | 'limited';
  descriptionTone: 'editorial' | 'commercial' | 'luxe' | 'jeune';
  /** Base64 data URL de l'image de fond hero (photo lifestyle pleine page) */
  heroBgImage: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const STEPS: { id: Step; label: string; num: number }[] = [
  { id: 'infos', label: 'Infos', num: 1 },
  { id: 'variantes', label: 'Variantes', num: 2 },
  { id: 'medias', label: 'Médias', num: 3 },
  { id: 'pipeline', label: 'Pipeline IA', num: 4 },
  { id: 'publication', label: 'Publication', num: 5 },
];

export const PRESET_COLORS: ProductColor[] = [
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

export const Input =
  'w-full px-4 py-2.5 bg-bone border border-line rounded-lg text-sm outline-none focus:border-terra transition-colors placeholder:text-muted/60';
export const Select =
  'w-full px-4 py-2.5 bg-bone border border-line rounded-lg text-sm outline-none focus:border-terra cursor-pointer';

// ── Step 1 : Infos de base ────────────────────────────────────────────────────

export function StepInfos({
  form,
  set,
  tagInput,
  setTagInput,
  exchangeRate = USD_TO_CDF_RATE,
}: {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  tagInput: string;
  setTagInput: (v: string) => void;
  exchangeRate?: number;
}) {
  const addTag = (tag: string) => {
    const t = tag.trim().toLowerCase();
    if (t && !form.tags.includes(t)) set('tags', [...form.tags, t]);
    setTagInput('');
  };

  const isMode = form.category === 'mode';
  const isTech = form.category === 'technologie' || form.category === 'hybrides';
  const isServices = form.category === 'services';

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

      {/* Modèle exact — tech & wearables */}
      {isTech && (
        <FieldRow label="Modèle exact">
          <input
            type="text"
            value={form.modele}
            onChange={(e) => set('modele', e.target.value)}
            placeholder={form.category === 'technologie' ? 'ex: Galaxy S24 Ultra, MacBook Pro M3' : 'ex: Apple Watch Series 9, Galaxy Watch 6'}
            className={Input}
          />
          <p className="text-[11px] text-muted mt-1">Utilisé dans le titre SEO et les recherches client.</p>
        </FieldRow>
      )}

      <div className="grid grid-cols-2 gap-4">
        <FieldRow label="Catégorie *">
          <select
            value={form.category}
            onChange={(e) => {
              const cat = e.target.value as ProductCategory;
              set('category', cat);
              set('subcategory', '');
              set('sizes', []);
              set('genre', undefined);
              if (cat === 'services') set('stock', '9999');
            }}
            className={Select}
          >
            <option value="mode">Mode</option>
            <option value="technologie">Technologie</option>
            <option value="hybrides">Wearables / Hybrides</option>
            <option value="services">Services digitaux</option>
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

      {/* Genre — mode uniquement */}
      {isMode && (
        <FieldRow label="Genre">
          <div className="flex gap-2 flex-wrap">
            {([
              { val: 'femme',  label: 'Femme',  icon: '♀' },
              { val: 'homme',  label: 'Homme',  icon: '♂' },
              { val: 'mixte',  label: 'Mixte',  icon: '⟺' },
              { val: 'enfant', label: 'Enfant', icon: '⭐' },
            ] as { val: NonNullable<FormState['genre']>; label: string; icon: string }[]).map(({ val, label, icon }) => (
              <button
                key={val}
                type="button"
                onClick={() => set('genre', form.genre === val ? undefined : val)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full border text-xs font-medium transition-colors ${
                  form.genre === val
                    ? 'bg-ink text-cream border-ink'
                    : 'bg-bone border-line text-muted hover:text-ink hover:border-ink'
                }`}
              >
                <span>{icon}</span>
                {label}
              </button>
            ))}
          </div>
        </FieldRow>
      )}

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
        {/* Aperçu CDF en temps réel */}
        {form.priceUSD && !isNaN(parseFloat(form.priceUSD)) && parseFloat(form.priceUSD) > 0 && (
          <p className="text-[11px] mt-1.5 flex items-center gap-1.5">
            <span className="text-gold font-semibold font-display">
              ≈ {formatCDF(usdToCdf(parseFloat(form.priceUSD), exchangeRate))}
            </span>
            <span className="text-muted">
              (taux actuel : {exchangeRate.toLocaleString('fr-FR')} FC / 1 USD)
            </span>
          </p>
        )}
        <p className="text-[10px] text-muted mt-1">
          💡 Pour définir un prix barré (promo), sélectionne l&apos;étiquette <strong>% Promo</strong> à l&apos;étape Publication.
        </p>
      </FieldRow>

      <FieldRow label="Stock *">
        {isServices ? (
          <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg">
            <span className="text-2xl font-display font-bold text-emerald-700">∞</span>
            <div>
              <p className="text-sm font-medium text-emerald-700">Illimité</p>
              <p className="text-[11px] text-emerald-600/70">Les services numériques ont un stock illimité</p>
            </div>
          </div>
        ) : (
          <input
            type="number"
            min="0"
            value={form.stock}
            onChange={(e) => set('stock', e.target.value)}
            placeholder="ex: 12"
            className={Input}
          />
        )}
      </FieldRow>

      {/* ── Services digitaux ─────────────────────────────────────── */}
      {isServices && (
        <div className="space-y-5 p-5 bg-bone rounded-xl border border-line">
          <p className="font-display text-[10px] font-semibold tracking-[0.3em] uppercase text-muted">
            Configuration service digital
          </p>

          {/* Plateforme */}
          <div>
            <Label>Plateforme *</Label>
            <div className="space-y-4 mb-3">
              {PLATFORMS.map(({ group, items }) => (
                <div key={group}>
                  <p className="text-[10px] font-display font-semibold tracking-widest uppercase text-muted mb-2">{group}</p>
                  <div className="flex flex-wrap gap-2">
                    {items.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => set('platform', form.platform === item ? '' : item)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                          form.platform === item
                            ? 'bg-ink text-cream border-ink'
                            : 'bg-cream border-line text-muted hover:text-ink hover:border-ink'
                        }`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <input
              type="text"
              value={form.platform}
              onChange={(e) => set('platform', e.target.value)}
              placeholder="Ou taper directement la plateforme…"
              className={Input}
            />
          </div>

          {/* Mode de livraison */}
          <div>
            <Label>Mode de livraison</Label>
            <div className="space-y-2 mt-2">
              {([
                { val: 'activation_code',    label: "Code d'activation",   desc: "Un code envoyé au client pour activer le service" },
                { val: 'configured_account', label: 'Compte configuré',    desc: 'Livraison d\'un compte préconfiguré avec identifiants' },
                { val: 'direct_recharge',    label: 'Rechargement direct', desc: 'Recharge directement sur le numéro / compte client' },
              ] as { val: NonNullable<FormState['deliveryMode']>; label: string; desc: string }[]).map(({ val, label, desc }) => (
                <label key={val} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  form.deliveryMode === val ? 'border-terra bg-terra/5' : 'border-line hover:border-terra/30 bg-cream'
                }`}>
                  <input
                    type="radio"
                    name="deliveryMode"
                    checked={form.deliveryMode === val}
                    onChange={() => set('deliveryMode', val)}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="text-xs font-semibold text-ink">{label}</p>
                    <p className="text-[11px] text-muted mt-0.5">{desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Disponibilité RDC */}
          <div>
            <Label>Disponibilité en RDC</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {([
                { val: 'confirmed', label: 'Confirmée ✓', activeClass: 'bg-emerald-100 border-emerald-300 text-emerald-700' },
                { val: 'to_verify', label: 'À vérifier',  activeClass: 'bg-gold/20 border-gold/40 text-[#7A5A15]' },
                { val: 'limited',   label: 'Limitée (VPN)', activeClass: 'bg-terra/10 border-terra/30 text-terra-dark' },
              ] as { val: NonNullable<FormState['rdcAvailability']>; label: string; activeClass: string }[]).map(({ val, label, activeClass }) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => set('rdcAvailability', form.rdcAvailability === val ? undefined : val)}
                  className={`px-4 py-2 rounded-lg border text-xs font-medium transition-colors ${
                    form.rdcAvailability === val
                      ? activeClass
                      : 'bg-cream border-line text-muted hover:border-terra/40'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

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

// ── Presets de variantes (par type de produit) ────────────────────────────────

interface VariantPreset {
  key: string;
  label: string;
  icon: string;
  description: string;
  sizes: string[];
}

const VARIANT_PRESETS: VariantPreset[] = [
  // Mode
  { key: 'vetements',          label: 'Vêtements',          icon: '👕', description: 'XS → XXXL',          sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'] },
  { key: 'chaussures_adultes', label: 'Chaussures adultes', icon: '👟', description: 'Pointures 36–49',     sizes: ['36','37','38','39','40','41','42','43','44','45','46','47','48','49'] },
  { key: 'chaussures_enfants', label: 'Chaussures enfants', icon: '👶', description: 'Pointures 20–35',     sizes: ['20','21','22','23','24','25','26','27','28','29','30','31','32','33','34','35'] },
  { key: 'bijoux_bracelets',   label: 'Bijoux — Bracelets', icon: '📿', description: 'XS (15 cm) → Ajust.', sizes: ['XS (≈15 cm)', 'S (≈17 cm)', 'M (≈19 cm)', 'L (≈21 cm)', 'Ajustable'] },
  { key: 'bijoux_bagues',      label: 'Bijoux — Bagues',    icon: '💍', description: 'Tour de doigt mm',    sizes: ['48', '50', '52', '54', '56', '58', '60'] },
  { key: 'parfums',            label: 'Parfums',             icon: '🧴', description: '30 ml → 200 ml',     sizes: ['30 ml', '50 ml', '75 ml', '100 ml', '150 ml', '200 ml'] },
  // Technologie
  { key: 'telephonie',   label: 'Téléphonie',   icon: '📱', description: 'Stockage 64 Go → 1 To', sizes: ['64 Go', '128 Go', '256 Go', '512 Go', '1 To'] },
  { key: 'informatique', label: 'Informatique', icon: '💻', description: 'SSD 256 Go → 4 To',     sizes: ['256 Go SSD', '512 Go SSD', '1 To SSD', '2 To SSD', '4 To SSD'] },
  // Hybrides
  { key: 'wearables', label: 'Wearables', icon: '⌚', description: 'Tour de poignet S–XL', sizes: ['S (130-175 mm)', 'M (145-200 mm)', 'L (165-215 mm)', 'XL (185-230 mm)'] },
  // Services
  { key: 'abonnements',  label: 'Abonnements',  icon: '📺', description: '1 mois → 1 an',     sizes: ['1 mois', '3 mois', '6 mois', '1 an'] },
  { key: 'forfaits_data',label: 'Forfaits data', icon: '📶', description: '1 Go → Illimité',   sizes: ['1 Go', '3 Go', '5 Go', '10 Go', '20 Go', 'Illimité'] },
  // Universel
  { key: 'taille_unique', label: 'Taille unique', icon: '🏷️', description: 'Un seul format',    sizes: [] },
  { key: 'custom',        label: 'Personnalisé',  icon: '✏️', description: 'Définir librement', sizes: [] },
];

// Mapping sous-catégorie → preset key par défaut
const SUBCATEGORY_PRESET: Record<string, string> = {
  'Vêtements':                      'vetements',
  'Chaussures':                     'chaussures_adultes',
  'Bijoux & accessoires classiques':'taille_unique',
  'Maroquinerie':                   'taille_unique',
  'Parfums & beauté':               'parfums',
  'Téléphonie':                     'telephonie',
  'Informatique':                   'informatique',
  'Accessoires tech':               'taille_unique',
  'Wearables / accessoires connectés': 'wearables',
  'Abonnements plateformes':        'abonnements',
  'Forfaits data':                  'forfaits_data',
};
const CATEGORY_PRESET: Record<string, string> = {
  mode: 'vetements', technologie: 'telephonie', hybrides: 'wearables', services: 'abonnements',
};
const CATEGORY_ALLOWED_PRESETS: Record<string, string[]> = {
  mode:        ['vetements', 'chaussures_adultes', 'chaussures_enfants', 'bijoux_bracelets', 'bijoux_bagues', 'parfums', 'taille_unique', 'custom'],
  technologie: ['telephonie', 'informatique', 'taille_unique', 'custom'],
  hybrides:    ['wearables', 'taille_unique', 'custom'],
  services:    ['abonnements', 'forfaits_data', 'custom'],
};

// Spécifications à afficher par sous-catégorie
type SpecField = 'brand' | 'material' | 'ram' | 'connectivity';
const SUBCATEGORY_SPECS: Record<string, SpecField[]> = {
  'Vêtements':                      ['brand', 'material'],
  'Chaussures':                     ['brand', 'material'],
  'Bijoux & accessoires classiques':['brand', 'material'],
  'Maroquinerie':                   ['brand', 'material'],
  'Parfums & beauté':               ['brand'],
  'Téléphonie':                     ['brand', 'ram'],
  'Informatique':                   ['brand', 'ram', 'connectivity'],
  'Accessoires tech':               ['brand'],
  'Wearables / accessoires connectés': ['brand', 'material', 'connectivity'],
  'Abonnements plateformes':        [],
  'Forfaits data':                  [],
};
const CATEGORY_SPECS: Record<string, SpecField[]> = {
  mode: ['brand', 'material'], technologie: ['brand', 'ram'], hybrides: ['brand', 'material', 'connectivity'], services: [],
};

const RAM_OPTIONS: Record<string, string[]> = {
  'Téléphonie':  ['4 Go', '6 Go', '8 Go', '12 Go', '16 Go'],
  'Informatique':['8 Go', '16 Go', '32 Go', '64 Go'],
};
const CONNECTIVITY_OPTIONS: Record<string, string[]> = {
  'Informatique':                    ['Wi-Fi seul', 'Wi-Fi + 4G', 'Wi-Fi + 5G'],
  'Wearables / accessoires connectés':['Bluetooth', 'GPS intégré', '4G (eSIM)', 'NFC', 'Wi-Fi'],
};

function getAutoPresetKey(category: string, subcategory: string) {
  return SUBCATEGORY_PRESET[subcategory] ?? CATEGORY_PRESET[category] ?? 'custom';
}

// Plateformes de services digitaux groupées
const PLATFORMS: { group: string; items: string[] }[] = [
  { group: '📺 Streaming',     items: ['Netflix', 'Spotify', 'YouTube Premium', 'Disney+', 'Apple TV+', 'Canal+', 'Deezer'] },
  { group: '💼 Productivité',  items: ['Adobe Creative Cloud', 'Microsoft 365', 'Google One', 'Canva Pro', 'Notion'] },
  { group: '🎮 Gaming',        items: ['PlayStation Plus', 'Xbox Game Pass', 'EA Play', 'Steam'] },
  { group: '📶 Forfait data',  items: ['Vodacom', 'Airtel', 'Africell', 'Orange'] },
];

// ── Step 2 : Variantes ────────────────────────────────────────────────────────

export function StepVariantes({
  form,
  set,
}: {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
}) {
  const autoKey = getAutoPresetKey(form.category, form.subcategory);
  const [presetKey, setPresetKey] = useState<string>(autoKey);
  const [customInput, setCustomInput] = useState('');
  const [customColor, setCustomColor] = useState({ label: '', hex: '#C8573A' });

  const allowedPresets = VARIANT_PRESETS.filter(
    (p) => (CATEGORY_ALLOWED_PRESETS[form.category] ?? ['custom']).includes(p.key),
  );

  const applyPreset = (key: string) => {
    setPresetKey(key);
    const preset = VARIANT_PRESETS.find((p) => p.key === key);
    if (!preset) return;
    if (key === 'custom') {
      setCustomInput(form.sizes.join(', '));
    } else if (key === 'taille_unique') {
      set('sizes', ['Taille unique']);
    } else {
      set('sizes', [...preset.sizes]);
      setCustomInput('');
    }
  };

  const handleCustomInput = (val: string) => {
    setCustomInput(val);
    const parsed = val.split(',').map((s) => s.trim()).filter(Boolean);
    set('sizes', parsed);
  };

  const toggleSize = (size: string) => {
    set('sizes', form.sizes.includes(size) ? form.sizes.filter((s) => s !== size) : [...form.sizes, size]);
  };

  const toggleColor = (color: ProductColor) => {
    const exists = form.colors.find((c) => c.hex === color.hex);
    set('colors', exists ? form.colors.filter((c) => c.hex !== color.hex) : [...form.colors, color]);
    // Supprimer l'image si on retire la couleur
    if (exists) {
      const updated = { ...form.colorImages };
      delete updated[color.hex];
      set('colorImages', updated);
    }
  };

  const addCustomColor = () => {
    if (customColor.label.trim()) {
      toggleColor({ label: customColor.label.trim(), hex: customColor.hex });
      setCustomColor({ label: '', hex: '#C8573A' });
    }
  };

  const handleColorImageUpload = (hex: string, file: File) => {
    const reader = new FileReader();
    reader.onload = () => set('colorImages', { ...form.colorImages, [hex]: reader.result as string });
    reader.readAsDataURL(file);
  };

  const removeColorImage = (hex: string) => {
    const updated = { ...form.colorImages };
    delete updated[hex];
    set('colorImages', updated);
  };

  const updateColorNote = (hex: string, note: string) => {
    set('colors', form.colors.map((c) => c.hex === hex ? { ...c, note: note || undefined } : c));
  };

  const currentPreset = VARIANT_PRESETS.find((p) => p.key === presetKey);
  const sizeLabel =
    presetKey.startsWith('chaussures') ? 'Pointures disponibles' :
    presetKey === 'parfums'            ? 'Volumes disponibles' :
    presetKey === 'informatique'       ? 'Stockage SSD disponible' :
    presetKey === 'telephonie'         ? 'Stockage disponible' :
    presetKey === 'wearables'          ? 'Tailles tour de poignet' :
    presetKey === 'abonnements'        ? 'Durées disponibles' :
    presetKey === 'forfaits_data'      ? 'Volumes data disponibles' :
    presetKey === 'custom'             ? 'Variantes personnalisées' :
    'Tailles disponibles';

  // Spécifications contextuelles
  const activeSpecs: SpecField[] = SUBCATEGORY_SPECS[form.subcategory] ?? CATEGORY_SPECS[form.category] ?? [];
  const ramOpts = RAM_OPTIONS[form.subcategory] ?? [];
  const connOpts = CONNECTIVITY_OPTIONS[form.subcategory] ?? [];

  const toggleSpec = (field: 'ram' | 'connectivity', val: string) => {
    const current = form[field];
    set(field, current.includes(val) ? current.filter((v) => v !== val) : [...current, val]);
  };

  return (
    <div className="space-y-8">
      <SectionTitle>Variantes du produit</SectionTitle>

      {/* ── Type de variantes ─────────────────────────────────────────── */}
      <div>
        <Label>Type de variantes</Label>
        <p className="text-xs text-muted mb-4">
          Sélectionnez le format adapté à votre article. Les options seront pré-remplies automatiquement.
        </p>
        <div className="flex flex-wrap gap-2">
          {allowedPresets.map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => applyPreset(preset.key)}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-left transition-colors ${
                presetKey === preset.key
                  ? 'bg-ink text-cream border-ink shadow-sm'
                  : 'bg-bone border-line text-muted hover:border-terra/50 hover:text-ink'
              }`}
            >
              <span className="text-lg leading-none">{preset.icon}</span>
              <div>
                <div className={`font-display font-bold text-[11px] tracking-widest uppercase ${presetKey === preset.key ? 'text-cream' : 'text-ink'}`}>
                  {preset.label}
                </div>
                <div className={`text-[10px] mt-0.5 ${presetKey === preset.key ? 'text-cream/60' : 'text-muted'}`}>
                  {preset.description}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Tailles / Capacités ───────────────────────────────────────── */}
      {presetKey === 'taille_unique' ? (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
          <p className="text-sm text-emerald-700">
            ✓ Ce produit est vendu en <strong>taille unique</strong>.
            Aucune sélection de taille ne sera proposée au client.
          </p>
        </div>
      ) : (
        <div>
          <Label>{sizeLabel}</Label>

          {presetKey === 'custom' ? (
            <div>
              <input
                type="text"
                value={customInput}
                onChange={(e) => handleCustomInput(e.target.value)}
                placeholder="ex: 38, 39, 40, 41  ou  Petite, Moyenne, Grande  ou  250g, 500g, 1 kg"
                className={Input}
              />
              <p className="text-[11px] text-muted mt-1">Séparez chaque valeur par une virgule.</p>
              {form.sizes.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {form.sizes.map((s) => (
                    <span
                      key={s}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-line bg-bone text-sm font-medium"
                    >
                      {s}
                      <button type="button" onClick={() => toggleSize(s)} className="text-muted hover:text-terra text-xs">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="flex flex-wrap gap-2 mt-3">
                {(currentPreset?.sizes ?? []).map((size) => (
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
                  {form.sizes.length} sélectionné{form.sizes.length > 1 ? 's' : ''} :{' '}
                  {form.sizes.join(', ')}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Couleurs disponibles ──────────────────────────────────────── */}
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
                <button type="button" onClick={() => toggleColor(c)} className="text-muted hover:text-terra">×</button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Spécifications produit ───────────────────────────────────── */}
      {activeSpecs.length > 0 && (
        <div className="border-t border-line pt-8">
          <Label>Spécifications produit</Label>
          <p className="text-xs text-muted mb-5">
            Ces infos apparaissent sur la fiche produit (tableau de specs). Le client ne les sélectionne pas.
          </p>
          <div className="space-y-5">
            {activeSpecs.includes('brand') && (
              <div>
                <Label>Marque</Label>
                <input
                  type="text"
                  value={form.brand}
                  onChange={(e) => set('brand', e.target.value)}
                  placeholder="ex: Nike, Apple, Chanel…"
                  className={Input}
                />
              </div>
            )}
            {activeSpecs.includes('material') && (
              <div>
                <Label>Matière / Composition</Label>
                <input
                  type="text"
                  value={form.material}
                  onChange={(e) => set('material', e.target.value)}
                  placeholder="ex: Coton 100 %, Cuir véritable, Silicone…"
                  className={Input}
                />
              </div>
            )}
            {activeSpecs.includes('ram') && ramOpts.length > 0 && (
              <div>
                <Label>RAM disponible</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {ramOpts.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => toggleSpec('ram', opt)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        form.ram.includes(opt)
                          ? 'bg-ink text-cream border-ink'
                          : 'bg-bone border-line text-muted hover:text-ink hover:border-ink'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                {form.ram.length > 0 && (
                  <p className="text-[11px] text-muted mt-1.5">{form.ram.join(', ')}</p>
                )}
              </div>
            )}
            {activeSpecs.includes('connectivity') && connOpts.length > 0 && (
              <div>
                <Label>Connectivité</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {connOpts.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => toggleSpec('connectivity', opt)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        form.connectivity.includes(opt)
                          ? 'bg-ink text-cream border-ink'
                          : 'bg-bone border-line text-muted hover:text-ink hover:border-ink'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                {form.connectivity.length > 0 && (
                  <p className="text-[11px] text-muted mt-1.5">{form.connectivity.join(', ')}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Photos par couleur ────────────────────────────────────────── */}
      {form.colors.length > 0 && (
        <div>
          <Label>
            Photos par couleur{' '}
            <span className="text-muted font-normal">(optionnel)</span>
          </Label>
          <p className="text-xs text-muted mb-4">
            Associez une photo à chaque couleur. Le client verra l'image correspondante quand
            il sélectionne une couleur.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {form.colors.map((c) => {
              const hasImage = !!form.colorImages[c.hex];
              return (
                <div
                  key={c.hex}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                    hasImage
                      ? 'border-emerald-200 bg-emerald-50/40'
                      : 'border-line bg-bone/40'
                  }`}
                >
                  {/* Swatch */}
                  <div
                    className="w-10 h-10 rounded-lg border border-line/50 shrink-0"
                    style={{ backgroundColor: c.hex }}
                  />
                  {/* Nom + note */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{c.label}</p>
                    <input
                      type="text"
                      value={c.note ?? ''}
                      onChange={(e) => updateColorNote(c.hex, e.target.value)}
                      placeholder="Note design (ex: Avec poches)"
                      className="mt-0.5 w-full text-[10px] bg-transparent border-b border-dashed border-line focus:border-terra outline-none text-muted placeholder:text-muted/40 pb-0.5"
                    />
                    <p className={`text-[11px] mt-0.5 ${hasImage ? 'text-emerald-600' : 'text-muted'}`}>
                      {hasImage ? '✓ Photo ajoutée' : 'Aucune photo'}
                    </p>
                  </div>
                  {/* Image + actions */}
                  {hasImage ? (
                    <div className="flex items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <div className="w-12 h-12 rounded-lg overflow-hidden border border-line">
                        <img
                          src={form.colorImages[c.hex]}
                          alt={c.label}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeColorImage(c.hex)}
                        className="w-7 h-7 rounded-full bg-terra/10 text-terra hover:bg-terra/20 flex items-center justify-center text-xs"
                        title="Supprimer"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer px-3 py-1.5 rounded-lg border border-line bg-cream hover:bg-beige text-[10px] font-display font-bold tracking-widest uppercase transition-colors shrink-0">
                      + Photo
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleColorImageUpload(c.hex, file);
                        }}
                      />
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Step 3 : Médias ───────────────────────────────────────────────────────────

export function StepMedias({
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
          tone: form.descriptionTone,
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
        const rawDataUrl = reader.result as string;
        const img = new Image();
        img.onload = () => {
          // Normaliser en JPEG ou PNG via canvas pour garantir la compatibilité
          // avec Remove.bg (qui refuse WebP, AVIF, BMP, etc.)
          const needsConversion = !['image/jpeg', 'image/jpg', 'image/png'].includes(file.type);
          let normalizedDataUrl = rawDataUrl;

          if (needsConversion) {
            try {
              const canvas = document.createElement('canvas');
              canvas.width = img.naturalWidth;
              canvas.height = img.naturalHeight;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                // Fond blanc pour JPEG (évite le noir sur les zones transparentes)
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);
                normalizedDataUrl = canvas.toDataURL('image/jpeg', 0.93);
              }
            } catch {
              // Fallback : garder le format original si la conversion échoue
              normalizedDataUrl = rawDataUrl;
            }
          }

          resolve({
            id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            file,
            originalDataUrl: normalizedDataUrl,
            processedDataUrl: normalizedDataUrl,
            hasTransparentBg: false,
            pipelineStatus: 'idle',
            width: img.naturalWidth,
            height: img.naturalHeight,
            sizeBytes: file.size,
          });
        };
        img.onerror = reject;
        img.src = rawDataUrl;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const addImages = useCallback(
    async (files: FileList | File[]) => {
      const newImgs: DraftImage[] = [];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue;

        // ── Validation serveur (type + taille) ──────────────────────────────
        try {
          const valRes = await fetch('/api/admin/validate-media', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: file.type, size: file.size, filename: file.name }),
          });
          const valData = await valRes.json() as { error?: string; warnings?: string[] };
          if (!valRes.ok) {
            alert(`⚠ ${file.name} rejeté : ${valData.error}`);
            continue;
          }
          if (valData.warnings?.length) {
            console.warn(`[validate-media] ${file.name}:`, valData.warnings.join(' '));
          }
        } catch {
          // Validation serveur injoignable — on laisse passer (non bloquant)
        }

        try {
          const img = await readImageFile(file);
          newImgs.push(img);
        } catch {
          /* skip corrupt files */
        }
      }
      set('images', [...form.images, ...newImgs]);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          <div className="mt-4 bg-gradient-to-r from-terra/5 to-gold/5 border border-terra/20 rounded-xl overflow-hidden">
            {/* En-tête + bouton */}
            <div className="flex flex-wrap items-center gap-4 p-4">
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
                  ✓ Nom, descriptions et tags remplis automatiquement ! Vérifie l&apos;étape 1.
                </p>
              )}
              {geminiError && (
                <p className="w-full text-xs text-terra font-medium">⚠ {geminiError}</p>
              )}
            </div>

            {/* Ton de la génération */}
            <div className="border-t border-terra/15 px-4 py-3">
              <p className="font-display text-[10px] font-semibold tracking-[0.3em] uppercase text-terra/60 mb-2.5">
                Ton de la description générée
              </p>
              <div className="grid grid-cols-4 gap-2">
                {([
                  { key: 'editorial',  label: 'Éditorial',     desc: 'Élégant, narratif' },
                  { key: 'commercial', label: 'Commercial',    desc: 'Ciblé, vendeur' },
                  { key: 'luxe',       label: 'Luxe',          desc: 'Raffiné, exclusif' },
                  { key: 'jeune',      label: 'Jeune & urbain', desc: 'Casual, moderne' },
                ] as { key: FormState['descriptionTone']; label: string; desc: string }[]).map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => set('descriptionTone', t.key)}
                    className={`p-2.5 rounded-xl border text-left transition-colors ${
                      form.descriptionTone === t.key
                        ? 'bg-ink border-ink'
                        : 'bg-cream border-line hover:border-terra/40'
                    }`}
                  >
                    <div className={`font-display font-bold text-[10px] tracking-widest uppercase leading-none ${
                      form.descriptionTone === t.key ? 'text-cream' : 'text-ink'
                    }`}>
                      {t.label}
                    </div>
                    <div className={`text-[10px] mt-1 ${
                      form.descriptionTone === t.key ? 'text-cream/60' : 'text-muted'
                    }`}>
                      {t.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>
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
          Les vidéos s&apos;affichent sur la fiche produit.
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

      {/* Image Hero (fond pleine page carousel) */}
      <HeroBgImageField form={form} set={set} />
    </div>
  );
}

// ── Hero Bg Image Field ───────────────────────────────────────────────────────

function HeroBgImageField({
  form,
  set,
}: {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => set('heroBgImage', reader.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <Label>Image Hero — fond pleine page (optionnel)</Label>
      <p className="text-xs text-muted mb-3">
        Photo &quot;lifestyle&quot; ou ambiance utilisée comme fond plein écran dans le carousel de la page d&apos;accueil.
        Si absente, un dégradé automatique est appliqué selon la catégorie du produit.
      </p>

      {form.heroBgImage ? (
        <div className="relative rounded-xl overflow-hidden border border-line group" style={{ aspectRatio: '16/7' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={form.heroBgImage} alt="Hero bg" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-ink/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="px-4 py-2 rounded-full bg-cream text-ink font-display text-[10px] tracking-widest uppercase font-bold"
            >
              Changer
            </button>
            <button
              type="button"
              onClick={() => set('heroBgImage', '')}
              className="px-4 py-2 rounded-full bg-terra text-cream font-display text-[10px] tracking-widest uppercase font-bold"
            >
              Supprimer
            </button>
          </div>
          <div className="absolute top-2 left-2 bg-ink/70 text-cream text-[9px] font-display font-bold tracking-widest uppercase px-2 py-1 rounded">
            Image Hero
          </div>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-line rounded-xl p-8 text-center cursor-pointer hover:border-terra/50 hover:bg-bone/50 transition-colors"
          style={{ aspectRatio: '16/7' }}
        >
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <div className="text-4xl opacity-40">🖼️</div>
            <p className="font-display font-semibold text-sm text-ink">
              Ajouter une image de fond hero
            </p>
            <p className="text-xs text-muted">Photo paysage, ambiance, lifestyle — format 16:9 recommandé</p>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
    </div>
  );
}

// ── Autocrop + normalisation après remove.bg ─────────────────────────────────
// Après détourage, l'image PNG a un fond transparent mais souvent avec
// beaucoup d'espace vide autour du produit détouré (marges du remove.bg).
// Cette fonction :
//   1. Scanne les pixels pour trouver la bounding box visible
//   2. Rogne l'espace transparent (+ 4% de padding)
//   3. Place le produit sur un canvas au ratio cible par catégorie :
//      mode → 3:4 portrait · technologie/hybrides/services → 1:1 carré
// Résultat : images homogènes quel que soit l'objet photographié.

const AUTOCROP_RATIOS: Record<string, { w: number; h: number }> = {
  mode:        { w: 3, h: 4 }, // portrait
  technologie: { w: 1, h: 1 }, // carré
  hybrides:    { w: 1, h: 1 }, // carré
  services:    { w: 1, h: 1 }, // carré
};
const AUTOCROP_OUTPUT_PX   = 1200; // dimension max du canvas de sortie
const AUTOCROP_SCAN_PX     = 2000; // résolution max du canvas de scan (protège la mémoire)
const AUTOCROP_FILL        = 0.85; // le produit occupe 85 % du canvas
const AUTOCROP_ALPHA_TRESHOLD = 10; // alpha min pour qu'un pixel soit "visible"

async function autocropAndNormalize(
  dataUrl: string,
  category: string,
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();

    img.onload = () => {
      try {
        const W = img.naturalWidth;
        const H = img.naturalHeight;

        // 1. Temp canvas pour lecture des pixels.
        //    Downscale à AUTOCROP_SCAN_PX max pour éviter les allocations OOM
        //    sur les grandes photos smartphone (12–48 MP).
        const scanScale = Math.min(1, AUTOCROP_SCAN_PX / Math.max(W, H));
        const sW = Math.round(W * scanScale);
        const sH = Math.round(H * scanScale);

        const tmp = document.createElement('canvas');
        tmp.width = sW; tmp.height = sH;
        const tmpCtx = tmp.getContext('2d');
        if (!tmpCtx) { resolve(dataUrl); return; }
        tmpCtx.drawImage(img, 0, 0, sW, sH); // downscale lors du dessin

        const data = tmpCtx.getImageData(0, 0, sW, sH).data;

        // 2. Bounding box via scan rapide ligne/colonne (coordonnées dans l'espace sW×sH)
        let minY = sH, maxY = 0, minX = sW, maxX = 0;
        let found = false;

        // minY : première ligne non transparente
        outer1: for (let y = 0; y < sH; y++)
          for (let x = 0; x < sW; x++)
            if (data[(y * sW + x) * 4 + 3] > AUTOCROP_ALPHA_TRESHOLD) {
              minY = y; found = true; break outer1;
            }
        if (!found) { resolve(dataUrl); return; }

        // maxY : dernière ligne non transparente
        outer2: for (let y = sH - 1; y >= minY; y--)
          for (let x = 0; x < sW; x++)
            if (data[(y * sW + x) * 4 + 3] > AUTOCROP_ALPHA_TRESHOLD) {
              maxY = y; break outer2;
            }

        // minX : première colonne non transparente
        outer3: for (let x = 0; x < sW; x++)
          for (let y = minY; y <= maxY; y++)
            if (data[(y * sW + x) * 4 + 3] > AUTOCROP_ALPHA_TRESHOLD) {
              minX = x; break outer3;
            }

        // maxX : dernière colonne non transparente
        outer4: for (let x = sW - 1; x >= minX; x--)
          for (let y = minY; y <= maxY; y++)
            if (data[(y * sW + x) * 4 + 3] > AUTOCROP_ALPHA_TRESHOLD) {
              maxX = x; break outer4;
            }

        // 3. Ajouter 4 % de padding autour du produit visible (espace sW×sH)
        const cropW = maxX - minX;
        const cropH = maxY - minY;
        const pad = Math.ceil(Math.max(cropW, cropH) * 0.04);
        const sx = Math.max(0, minX - pad);
        const sy = Math.max(0, minY - pad);
        const sw = Math.min(sW, maxX + pad + 1) - sx;
        const sh = Math.min(sH, maxY + pad + 1) - sy;

        // 4. Canvas de sortie au ratio cible
        const ratio = AUTOCROP_RATIOS[category] ?? { w: 3, h: 4 };
        const isPortrait = ratio.h > ratio.w;
        const outW = isPortrait
          ? Math.round(AUTOCROP_OUTPUT_PX * ratio.w / ratio.h)
          : AUTOCROP_OUTPUT_PX;
        const outH = isPortrait
          ? AUTOCROP_OUTPUT_PX
          : Math.round(AUTOCROP_OUTPUT_PX * ratio.h / ratio.w);

        const out = document.createElement('canvas');
        out.width = outW; out.height = outH;
        const outCtx = out.getContext('2d');
        if (!outCtx) { resolve(dataUrl); return; }
        outCtx.clearRect(0, 0, outW, outH); // fond transparent

        // 5. Placer le produit centré (portrait → ancré en bas, carré → centré)
        const scale = Math.min(outW / sw, outH / sh) * AUTOCROP_FILL;
        const dw = Math.round(sw * scale);
        const dh = Math.round(sh * scale);
        const dx = Math.round((outW - dw) / 2);
        const dy = isPortrait
          ? outH - dh - Math.round(outH * 0.02) // portrait : 2 % de marge en bas
          : Math.round((outH - dh) / 2);         // carré : centré

        outCtx.drawImage(tmp, sx, sy, sw, sh, dx, dy, dw, dh);

        resolve(out.toDataURL('image/png'));
      } catch {
        resolve(dataUrl); // fallback : image d'origine intacte
      }
    };

    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// ── Step 4 : Pipeline IA ──────────────────────────────────────────────────────

export function StepPipeline({
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
        <p className="text-muted">Aucune image uploadée. Retournez à l&apos;étape Médias.</p>
      </div>
    );
  }

  const updateImage = (id: string, patch: Partial<DraftImage>) => {
    set(
      'images',
      form.images.map((img) => (img.id === id ? { ...img, ...patch } : img)),
    );
  };

  /** Convertit un data URL en JPEG via canvas si ce n'est pas déjà JPEG/PNG */
  const ensureJpegOrPng = (dataUrl: string): Promise<string> =>
    new Promise((resolve) => {
      const isCompatible = dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/png');
      if (isCompatible) { resolve(dataUrl); return; }
      const el = new Image();
      el.onload = () => {
        try {
          const cv = document.createElement('canvas');
          cv.width = el.naturalWidth; cv.height = el.naturalHeight;
          const ctx = cv.getContext('2d');
          if (!ctx) { resolve(dataUrl); return; }
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, cv.width, cv.height);
          ctx.drawImage(el, 0, 0);
          resolve(cv.toDataURL('image/jpeg', 0.93));
        } catch { resolve(dataUrl); }
      };
      el.onerror = () => resolve(dataUrl);
      el.src = dataUrl;
    });

  const runPipeline = async (imgId: string) => {
    const img = form.images.find((i) => i.id === imgId);
    if (!img || img.pipelineStatus === 'removing_bg') return;

    // Normaliser en JPEG/PNG avant envoi à Remove.bg (WebP/AVIF non supportés)
    const workingDataUrl = await ensureJpegOrPng(img.originalDataUrl);

    updateImage(imgId, { pipelineStatus: 'removing_bg' });
    try {
      const res = await fetch('/api/admin/media/remove-bg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: workingDataUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Détourage échoué');

      // Autocrop transparent borders + normalisation au ratio cible par catégorie
      const normalizedUrl = await autocropAndNormalize(data.resultBase64, form.category);

      updateImage(imgId, {
        pipelineStatus: 'done',
        processedDataUrl: normalizedUrl,
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
            Le fond de chaque image est supprimé automatiquement via Remove.bg.
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
                <><Spinner /> Traitement en cours…</>
              ) : (
                `⚡ Traiter tout (${pendingCount})`
              )}
            </button>
          )}
        </div>
      </div>

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
  const isProcessing = img.pipelineStatus === 'removing_bg';

  const statusBadge = () => {
    switch (img.pipelineStatus) {
      case 'idle': return <Badge color="muted">En attente</Badge>;
      case 'upscaling':
      case 'removing_bg': return <Badge color="gold" animate>Détourage…</Badge>;
      case 'done': return <Badge color="green">✓ Traité ({img.confidenceScore}%)</Badge>;
      case 'skipped': return <Badge color="muted">Ignoré</Badge>;
      case 'error': return <Badge color="red">⚠ Erreur</Badge>;
    }
  };

  return (
    <div className={`rounded-xl border p-4 ${img.pipelineStatus === 'error' ? 'border-terra/40 bg-terra/5' : img.pipelineStatus === 'done' ? 'border-emerald-200 bg-emerald-50/40' : 'border-line bg-bone/40'}`}>
      <div className="flex gap-4 items-start">
        <div className="flex gap-3 shrink-0">
          <div className="text-center">
            <div className="w-20 h-20 rounded-lg overflow-hidden bg-beige border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.originalDataUrl} alt="" className="w-full h-full object-cover" />
            </div>
            <p className="text-[9px] text-muted mt-1 font-display uppercase tracking-widest">Original</p>
          </div>
          <div className="flex items-center text-muted text-lg mt-3">→</div>
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

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            {index === 0 && <span className="text-[9px] font-display font-bold tracking-widest uppercase px-2 py-0.5 rounded bg-terra text-cream">Principale</span>}
            <span className="font-display font-semibold text-sm text-ink">Image {index + 1}</span>
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
                Détourage…
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

export function StepPublication({
  form,
  set,
  onPublish,
  saving,
  publishLabel = '✓ Publier le produit',
}: {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  onPublish: () => void;
  saving: boolean;
  publishLabel?: string;
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
                ? "Mis en avant sur la page d'accueil."
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

      {/* Badge */}
      <div>
        <Label>Étiquette produit <span className="text-muted font-normal">(optionnel)</span></Label>
        <p className="text-[11px] text-muted mb-3">Petite pastille visible sur la carte produit dans le catalogue.</p>
        <div className="flex flex-wrap gap-2">
          {([
            { value: undefined, label: 'Aucune', color: 'bg-bone border-line text-muted' },
            { value: 'new', label: '✦ Nouveau', color: 'bg-terra text-white border-terra' },
            { value: 'sale', label: '% Promo', color: 'bg-gold text-ink border-gold' },
            { value: 'hot', label: '🔥 Tendance', color: 'bg-ink text-cream border-ink' },
          ] as const).map((opt) => (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => {
                set('badge', opt.value as FormState['badge']);
                // Effacer l'ancien prix si on retire la promo
                if (opt.value !== 'sale') set('oldPriceUSD', '');
              }}
              className={`px-4 py-2 rounded-full border text-xs font-display font-semibold tracking-wide transition-all ${
                form.badge === opt.value
                  ? opt.color + ' ring-2 ring-offset-1 ring-terra/50 scale-105'
                  : 'bg-bone border-line text-muted hover:border-terra/40'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Champ "prix original" — visible uniquement si badge = Promo */}
        {form.badge === 'sale' && (
          <div className="mt-4 p-4 bg-gold/10 border border-gold/40 rounded-xl">
            <Label>
              Prix original <span className="text-muted font-normal">(avant la promo) *</span>
            </Label>
            <p className="text-[11px] text-muted mb-3">
              Ce prix sera affiché barré à côté du prix actuel pour montrer l&apos;économie réalisée.
            </p>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted font-semibold">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.oldPriceUSD}
                onChange={(e) => set('oldPriceUSD', e.target.value)}
                placeholder={
                  form.priceUSD
                    ? `ex: ${(parseFloat(form.priceUSD) * 1.3).toFixed(2)}`
                    : 'ex: 119.00'
                }
                className={Input + ' pl-8'}
              />
            </div>
            {form.oldPriceUSD && form.priceUSD &&
              parseFloat(form.oldPriceUSD) > parseFloat(form.priceUSD) && (
              <p className="text-[11px] text-emerald-600 mt-1.5 font-medium">
                ✓ Réduction de{' '}
                {Math.round((1 - parseFloat(form.priceUSD) / parseFloat(form.oldPriceUSD)) * 100)}%
              </p>
            )}
            {form.oldPriceUSD && form.priceUSD &&
              parseFloat(form.oldPriceUSD) <= parseFloat(form.priceUSD) && (
              <p className="text-[11px] text-terra mt-1.5">
                ⚠ L&apos;ancien prix doit être supérieur au prix actuel.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Publish button */}
      <button
        type="button"
        onClick={onPublish}
        disabled={saving || !form.name || !form.priceUSD}
        className="w-full py-4 bg-terra text-cream font-display font-bold text-sm tracking-widest uppercase rounded-xl hover:bg-terra-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {saving ? <><Spinner /> Enregistrement…</> : publishLabel}
      </button>

      {(!form.name || !form.priceUSD) && (
        <p className="text-center text-[11px] text-muted">
          Nom et prix requis pour enregistrer.
        </p>
      )}
    </div>
  );
}

// ── Shared UI atoms ───────────────────────────────────────────────────────────

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display font-bold text-xl text-ink border-b border-line pb-4 mb-6">
      {children}
    </h2>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-display text-[11px] tracking-widest uppercase font-semibold text-muted mb-1.5">
      {children}
    </p>
  );
}

export function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export function Badge({
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

export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' }) {
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

// ── Sidebar du formulaire produit ─────────────────────────────────────────────

const CATEGORY_TIPS: Record<string, string> = {
  mode:        '💡 Les photos sur fond blanc convertissent 3× mieux. Ajoute des tags de couleur pour la recherche.',
  technologie: '💡 Précise le modèle exact (ex: iPhone 15 Pro) et le stockage pour réduire les questions client.',
  hybrides:    '💡 Mentionne la compatibilité iOS/Android et la durée de batterie dans la description.',
  services:    '💡 Indique clairement la plateforme et la durée dans le nom du produit.',
};

export function FormSidebar({
  form,
  stepIndex,
}: {
  form: FormState;
  stepIndex: number;
}) {
  const checks = {
    category:    !!form.category,
    name:        form.name.length >= 3,
    price:       !!form.priceUSD && parseFloat(form.priceUSD) > 0,
    description: form.shortDescription.length > 0,
  };
  const completedCount = Object.values(checks).filter(Boolean).length;
  const stepProgress = Math.round(((stepIndex + 1) / STEPS.length) * 100);
  const tip = CATEGORY_TIPS[form.category];

  return (
    <aside className="hidden lg:block">
      <div className="lg:sticky lg:top-24 space-y-4">

        {/* ── Progression ──────────────────────────────────────────── */}
        <div className="bg-cream border border-line rounded-xl p-5">
          <p className="font-display text-[10px] font-semibold tracking-[0.3em] uppercase text-muted mb-3">
            Progression
          </p>
          <div className="flex items-center justify-between mb-2">
            <span className="font-display font-semibold text-sm text-ink">
              Étape {stepIndex + 1} / {STEPS.length}
            </span>
            <span className="font-display font-bold text-sm text-terra">{stepProgress}%</span>
          </div>
          <div className="h-1.5 bg-bone rounded-full overflow-hidden">
            <div
              className="h-full bg-terra rounded-full transition-all duration-500"
              style={{ width: `${stepProgress}%` }}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-1">
            {STEPS.map((s, i) => (
              <span
                key={s.id}
                className={`text-[10px] font-display font-semibold tracking-widest uppercase px-2 py-0.5 rounded transition-colors ${
                  i < stepIndex
                    ? 'bg-ink text-cream'
                    : i === stepIndex
                      ? 'bg-terra text-cream'
                      : 'bg-bone text-muted'
                }`}
              >
                {s.num}. {s.label}
              </span>
            ))}
          </div>
        </div>

        {/* ── Checklist ────────────────────────────────────────────── */}
        <div className="bg-cream border border-line rounded-xl p-5">
          <p className="font-display text-[10px] font-semibold tracking-[0.3em] uppercase text-muted mb-4">
            Checklist
          </p>
          <div className="space-y-2.5">
            {(
              [
                { key: 'category',    label: 'Catégorie' },
                { key: 'name',        label: 'Nom produit' },
                { key: 'price',       label: 'Prix' },
                { key: 'description', label: 'Description courte' },
              ] as { key: keyof typeof checks; label: string }[]
            ).map(({ key, label }) => {
              const done = checks[key];
              return (
                <div key={key} className="flex items-center gap-2.5">
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-colors ${
                      done ? 'bg-emerald-100 text-emerald-700' : 'bg-bone text-muted'
                    }`}
                  >
                    {done ? '✓' : '○'}
                  </span>
                  <span className={`text-xs transition-colors ${done ? 'text-ink font-medium' : 'text-muted'}`}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 pt-3 border-t border-line">
            <p className="text-[11px] text-muted">
              <span className="font-semibold text-ink">{completedCount}</span>/4 éléments remplis
            </p>
          </div>
        </div>

        {/* ── Aperçu en temps réel ─────────────────────────────────── */}
        {(form.name || form.priceUSD || form.subcategory) && (
          <div className="bg-cream border border-line rounded-xl p-5">
            <p className="font-display text-[10px] font-semibold tracking-[0.3em] uppercase text-muted mb-4">
              Aperçu
            </p>
            <div className="space-y-2">
              <div className="flex justify-between items-baseline gap-2 text-xs">
                <span className="text-muted shrink-0">Catégorie</span>
                <span className="font-medium text-ink capitalize">{form.category}</span>
              </div>
              {form.subcategory && (
                <div className="flex justify-between items-baseline gap-2 text-xs">
                  <span className="text-muted shrink-0">Sous-cat.</span>
                  <span className="font-medium text-ink text-right truncate max-w-[140px]">{form.subcategory}</span>
                </div>
              )}
              {form.name && (
                <div className="flex justify-between items-baseline gap-2 text-xs">
                  <span className="text-muted shrink-0">Nom</span>
                  <span className="font-medium text-ink text-right truncate max-w-[140px]">{form.name}</span>
                </div>
              )}
              {form.priceUSD && parseFloat(form.priceUSD) > 0 && (
                <div className="flex justify-between items-baseline gap-2 text-xs">
                  <span className="text-muted shrink-0">Prix</span>
                  <span className="font-display font-bold text-terra">${parseFloat(form.priceUSD).toFixed(2)}</span>
                </div>
              )}
              {form.genre && (
                <div className="flex justify-between items-baseline gap-2 text-xs">
                  <span className="text-muted shrink-0">Genre</span>
                  <span className="font-medium text-ink capitalize">{form.genre}</span>
                </div>
              )}
              {form.modele && (
                <div className="flex justify-between items-baseline gap-2 text-xs">
                  <span className="text-muted shrink-0">Modèle</span>
                  <span className="font-medium text-ink text-right truncate max-w-[140px]">{form.modele}</span>
                </div>
              )}
              {form.platform && (
                <div className="flex justify-between items-baseline gap-2 text-xs">
                  <span className="text-muted shrink-0">Plateforme</span>
                  <span className="font-medium text-ink">{form.platform}</span>
                </div>
              )}
              {form.sizes.length > 0 && (
                <div className="flex justify-between items-baseline gap-2 text-xs">
                  <span className="text-muted shrink-0">Variantes</span>
                  <span className="font-medium text-ink">{form.sizes.length} option{form.sizes.length > 1 ? 's' : ''}</span>
                </div>
              )}
              {form.colors.length > 0 && (
                <div className="flex justify-between items-baseline gap-2 text-xs">
                  <span className="text-muted shrink-0">Couleurs</span>
                  <div className="flex gap-1">
                    {form.colors.slice(0, 5).map((c) => (
                      <span
                        key={c.hex}
                        className="w-4 h-4 rounded-full border border-line/50 shrink-0"
                        style={{ backgroundColor: c.hex }}
                        title={c.label}
                      />
                    ))}
                    {form.colors.length > 5 && (
                      <span className="text-[10px] text-muted self-center">+{form.colors.length - 5}</span>
                    )}
                  </div>
                </div>
              )}
              {form.images.length > 0 && (
                <div className="flex justify-between items-baseline gap-2 text-xs">
                  <span className="text-muted shrink-0">Photos</span>
                  <span className="font-medium text-ink">{form.images.length} photo{form.images.length > 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Tip contextuel ───────────────────────────────────────── */}
        {tip && (
          <div className="bg-gold/10 border border-gold/30 rounded-xl p-4">
            <p className="text-xs text-ink/80 leading-relaxed">{tip}</p>
          </div>
        )}
      </div>
    </aside>
  );
}
