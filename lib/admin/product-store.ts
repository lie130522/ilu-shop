// ─── ILU SHOP — Admin Product Store ─────────────────────────────────────────
// Source de vérité : localStorage. Stocke les produits créés via /admin/produits/nouveau.
// Distinct des SEED_PRODUCTS (lib/products.ts) qui sont des données statiques de démonstration.

const KEY = 'ilu_admin_products';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ProductStatus = 'active' | 'inactive' | 'featured';
export type ProductCategory = 'mode' | 'telephones' | 'ordinateurs' | 'tablettes';

export const SUBCATEGORIES: Record<ProductCategory, string[]> = {
  mode: ['Vêtements', 'Chaussures', 'Vestes & Manteaux', 'Accessoires', 'Sacs & Maroquinerie'],
  telephones: ['Smartphones', 'Reconditionnés', 'Accessoires téléphonie'],
  ordinateurs: ['Laptops', 'Ultrabooks', 'Gaming', 'Bureautique'],
  tablettes: ['Tablettes standard', 'Tablettes Pro', 'Accessoires tablettes'],
};

export const DEFAULT_SIZES: Record<ProductCategory, string[]> = {
  mode: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  telephones: ['64 Go', '128 Go', '256 Go', '512 Go'],
  ordinateurs: ['8 Go RAM / 256 Go', '16 Go RAM / 512 Go', '32 Go RAM / 1 To'],
  tablettes: ['64 Go', '128 Go', '256 Go'],
};

export interface ProductColor {
  label: string;
  hex: string;
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

  // ── Statut & meta ──
  status: ProductStatus;
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
    category: p.category === 'mode' ? 'mode' : 'tech',
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
