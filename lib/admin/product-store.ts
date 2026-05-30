// ─── ILU SHOP — Admin Product Store ─────────────────────────────────────────
// Source de vérité : localStorage. Stocke les produits créés via /admin/produits/nouveau.
// Distinct des SEED_PRODUCTS (lib/products.ts) qui sont des données statiques de démonstration.

const KEY = 'ilu_admin_products';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ProductStatus = 'active' | 'inactive' | 'featured';
export type ProductCategory = 'mode' | 'technologie' | 'hybrides' | 'services';

export const SUBCATEGORIES: Record<ProductCategory, string[]> = {
  mode: ['Vêtements', 'Chaussures', 'Bijoux & accessoires classiques', 'Maroquinerie', 'Parfums & beauté'],
  technologie: ['Téléphonie', 'Informatique', 'Accessoires tech'],
  hybrides: ['Wearables / accessoires connectés'],
  services: ['Abonnements plateformes', 'Forfaits data'],
};

export const DEFAULT_SIZES: Record<ProductCategory, string[]> = {
  mode: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'],
  technologie: ['64 Go', '128 Go', '256 Go', '512 Go'],
  hybrides: ['S (130-175 mm)', 'M (145-200 mm)', 'L (165-215 mm)', 'XL (185-230 mm)'],
  services: ['1 mois', '3 mois', '6 mois', '1 an'],
};

export interface ProductColor {
  label: string;
  hex: string;
  /** Note de design visible côté client (ex: "Avec poches poitrine") */
  note?: string;
}

export type ImagePipelineStatus = 'idle' | 'upscaling' | 'removing_bg' | 'done' | 'error' | 'skipped';

export interface StoredImage {
  id: string;
  /** Base64 data URL of the original upload */
  originalDataUrl: string;
  /** Base64 data URL after AI pipeline (transparent PNG). Falls back to original if not processed. */
  processedDataUrl: string;
  /** Whether the processed image has a transparent background */
  hasTransparentBg: boolean;
  /** AI confidence score 0-100 (Remove.bg quality indicator) */
  confidenceScore?: number;
  /** Terminal pipeline status */
  pipelineStatus: ImagePipelineStatus;
  errorMessage?: string;
  width: number;
  height: number;
  sizeBytes: number;
}

export interface StoredVideo {
  id: string;
  name: string;
  sizeBytes: number;
  /** Temporary object URL — not persisted across sessions */
  objectUrl?: string;
}

export interface StoredProduct {
  id: string;
  slug: string;

  // ── Infos de base ──
  name: string;
  category: ProductCategory;
  subcategory: string;
  priceUSD: number;
  oldPriceUSD?: number;
  shortDescription: string;
  description: string;
  stock: number;
  tags: string[];

  // ── Variantes ──
  sizes: string[];
  colors: ProductColor[];

  // ── Médias ──
  images: StoredImage[];
  videos: StoredVideo[];

  // ── Images par couleur (données brutes base64 avant upload Storage) ──
  colorImages?: Record<string, string>; // hex → base64 data URL

  // ── Spécifications produit ──
  brand?: string;          // Marque
  material?: string;       // Matière (vêtements, chaussures, bijoux, wearables…)
  ram?: string[];          // RAM sélectionnées (téléphonie, informatique)
  connectivity?: string[]; // Connectivité (informatique, wearables)

  // ── Infos additionnelles ──
  genre?: 'femme' | 'homme' | 'mixte' | 'enfant';
  modele?: string;
  platform?: string;
  deliveryMode?: 'activation_code' | 'configured_account' | 'direct_recharge';
  rdcAvailability?: 'confirmed' | 'to_verify' | 'limited';
  descriptionTone?: 'editorial' | 'commercial' | 'luxe' | 'jeune';

  /** Image de fond hero carousel (base64 data URL avant upload, puis URL Storage après) */
  heroBgImage?: string;

  // ── Statut & meta ──
  status: ProductStatus;
  /** Étiquette visible sur la carte produit (Nouveau / Promo / Tendance) */
  badge?: 'new' | 'sale' | 'hot';
  rating: number;
  reviewCount: number;
  createdAt: string;
  updatedAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export function getAdminProducts(): StoredProduct[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveAdminProduct(product: StoredProduct): void {
  const products = getAdminProducts();
  const idx = products.findIndex((p) => p.id === product.id);
  if (idx >= 0) {
    products[idx] = { ...product, updatedAt: new Date().toISOString() };
  } else {
    products.unshift(product); // newest first
  }
  localStorage.setItem(KEY, JSON.stringify(products));
}

export function deleteAdminProduct(id: string): void {
  const products = getAdminProducts().filter((p) => p.id !== id);
  localStorage.setItem(KEY, JSON.stringify(products));
}

export function updateAdminProductStatus(id: string, status: ProductStatus): void {
  const products = getAdminProducts();
  const p = products.find((p) => p.id === id);
  if (!p) return;
  p.status = status;
  p.updatedAt = new Date().toISOString();
  localStorage.setItem(KEY, JSON.stringify(products));
}

/** Creates a new empty draft product with a unique id */
export function createDraftId(): string {
  return `prod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Converts a StoredProduct to a format compatible with lib/products.ts Product */
export function toPublicProduct(p: StoredProduct) {
  const primaryImage = p.images[0];
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    shortDescription: p.shortDescription,
    description: p.description,
    priceUSD: p.priceUSD,
    oldPriceUSD: p.oldPriceUSD,
    category: p.category,
    subcategory: p.subcategory,
    tags: p.tags,
    stock: p.stock,
    status: p.status,
    sizes: p.sizes,
    colors: p.colors.map((c) => c.label),
    images: p.images.map((img) => img.processedDataUrl || img.originalDataUrl),
    rating: p.rating,
    reviewCount: p.reviewCount,
    isNew: true,
    isFeatured: p.status === 'featured',
    // pass through pipeline metadata
    _hasAiImages: p.images.some((img) => img.hasTransparentBg),
  };
}
