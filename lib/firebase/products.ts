// ─── ILU SHOP — Produits Firestore (P20) ─────────────────────────────────────
// Source de vérité publique : Firestore `products/{productId}`
// Images : Firebase Storage `products/{productId}/{imageId}`
// Les produits seed de lib/products.ts restent statiques (non migrés).

import {
  collection,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { db, storage } from './client';
import type { Product, Category, ProductStatus } from '@/lib/types';
import type { StoredProduct } from '@/lib/admin/product-store';

// ── Upload image vers Firebase Storage ───────────────────────────────────────

/**
 * Uploads a base64 data URL to Firebase Storage.
 * Returns the public download URL.
 * Content type is extracted explicitly from the data URL prefix to satisfaire
 * les Storage Rules qui vérifient request.resource.contentType.
 */
async function uploadProductImage(
  productId: string,
  imageId: string,
  dataUrl: string,
): Promise<string> {
  // Extraire le MIME type depuis le data URL (ex: "data:image/jpeg;base64,..." → "image/jpeg")
  const mimeMatch = dataUrl.match(/^data:([^;]+);/);
  const contentType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

  const imgRef = ref(storage, `products/${productId}/${imageId}`);
  await uploadString(imgRef, dataUrl, 'data_url', { contentType });
  return getDownloadURL(imgRef);
}

// ── Sauvegarde produit admin → Firestore ─────────────────────────────────────

/**
 * Saves a StoredProduct to Firestore after uploading its images to Firebase Storage.
 * Call this after saveAdminProduct (localStorage) to make the product accessible
 * via the public shop (/produit/[slug]).
 */
export async function saveProductToFirestore(product: StoredProduct): Promise<void> {
  // 1. Upload images to Firebase Storage (parallel)
  const imageUrls: string[] = [];
  const uploadErrors: string[] = [];

  await Promise.all(
    product.images.map(async (img, idx) => {
      try {
        const dataUrl = img.processedDataUrl || img.originalDataUrl;
        if (!dataUrl) return;
        // Image already on Firebase Storage (Firestore-only product being re-edited)
        if (dataUrl.startsWith('http://') || dataUrl.startsWith('https://')) {
          imageUrls[idx] = dataUrl;
          return;
        }
        const url = await uploadProductImage(product.id, img.id || `img-${idx}`, dataUrl);
        imageUrls[idx] = url;
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code ?? 'unknown';
        const message = (err as { message?: string })?.message ?? String(err);
        console.error(`[products] image ${idx} upload failed (${code}):`, message);
        uploadErrors.push(`Image ${idx + 1}: ${code} — ${message}`);
      }
    }),
  );

  // Si AUCUNE image n'a pu être uploadée alors qu'il y avait des images,
  // on lance une erreur lisible pour que la UI puisse l'afficher.
  if (product.images.length > 0 && imageUrls.filter(Boolean).length === 0) {
    const firstError = uploadErrors[0] ?? 'erreur inconnue';
    throw new Error(`STORAGE_UPLOAD_FAILED:${firstError}`);
  }

  // 2. Upload color images (si présentes)
  const colorImageUrls: Record<string, string> = {};
  if (product.colorImages && Object.keys(product.colorImages).length > 0) {
    await Promise.all(
      Object.entries(product.colorImages).map(async ([hex, dataUrl]) => {
        if (!dataUrl) return;
        try {
          // Si déjà une URL Firebase (uploadée par BulkFileImport), on l'utilise directement
          if (dataUrl.startsWith('http://') || dataUrl.startsWith('https://')) {
            colorImageUrls[hex] = dataUrl;
            return;
          }
          const sanitized = hex.replace('#', '');
          const url = await uploadProductImage(product.id, `color-${sanitized}`, dataUrl);
          colorImageUrls[hex] = url;
        } catch (err) {
          console.error(`[products] color image upload failed for ${hex}:`, err);
        }
      }),
    );
  }

  // 3. Build Firestore document (Product-compatible shape)
  const firestoreDoc: Omit<Product, 'id'> & {
    id: string;
    source: 'admin';
    createdAt: string;
    updatedAt: ReturnType<typeof serverTimestamp>;
  } = {
    id: product.id,
    slug: product.slug,
    name: product.name,
    shortDescription: product.shortDescription,
    description: product.description,
    priceUSD: product.priceUSD,
    ...(product.oldPriceUSD !== undefined ? { oldPriceUSD: product.oldPriceUSD } : {}),
    // StoredProduct.category is already Category-compatible
    category: product.category as Category,
    subcategory: product.subcategory,
    tags: product.tags,
    status: product.status,
    ...(product.badge !== undefined ? { badge: product.badge } : {}),
    stock: product.stock,
    sizes: product.sizes,
    // Normalize colors: StoredProduct uses { label, hex, note? } → Product uses { name, hex, note? }
    colors: product.colors.map((c) => ({ name: c.label, hex: c.hex, ...(c.note ? { note: c.note } : {}) })),
    images: imageUrls.filter(Boolean),
    ...(Object.keys(colorImageUrls).length > 0 ? { colorImageUrls } : {}),
    ...(product.brand                ? { brand: product.brand }               : {}),
    ...(product.material             ? { material: product.material }         : {}),
    ...(product.ram?.length          ? { ram: product.ram }                   : {}),
    ...(product.connectivity?.length ? { connectivity: product.connectivity } : {}),
    ...(product.genre                ? { genre: product.genre }               : {}),
    ...(product.modele               ? { modele: product.modele }             : {}),
    ...(product.platform             ? { platform: product.platform }         : {}),
    ...(product.deliveryMode         ? { deliveryMode: product.deliveryMode } : {}),
    ...(product.rdcAvailability      ? { rdcAvailability: product.rdcAvailability } : {}),
    ...(product.descriptionTone      ? { descriptionTone: product.descriptionTone } : {}),
    rating: product.rating,
    reviewCount: product.reviewCount,
    source: 'admin',
    createdAt: product.createdAt,
    updatedAt: serverTimestamp(),
  };

  await setDoc(doc(db, 'products', product.id), firestoreDoc);
}

// ── Lecture produit par ID ────────────────────────────────────────────────────

/**
 * Fetches a single product from Firestore by its document ID.
 * Used by admin detail/modifier pages for products not in localStorage.
 * Returns null if not found or on error.
 */
export async function getProductByIdFirestore(id: string): Promise<Product | null> {
  try {
    const snap = await getDoc(doc(db, 'products', id));
    if (!snap.exists()) return null;
    return { ...(snap.data() as Product), id: snap.id };
  } catch (err) {
    console.error('[products] getProductByIdFirestore error:', err);
    return null;
  }
}

// ── Lecture produit par slug ──────────────────────────────────────────────────

/**
 * Fetches a product from Firestore by slug.
 * Used by /produit/[slug] for admin-created products not in lib/products.ts.
 * Returns null if not found or on error.
 */
export async function getProductBySlugFirestore(slug: string): Promise<Product | null> {
  try {
    const q = query(collection(db, 'products'), where('slug', '==', slug));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const data = snap.docs[0].data() as Product;
    return { ...data, id: snap.docs[0].id };
  } catch (err) {
    console.error('[products] getProductBySlugFirestore error:', err);
    return null;
  }
}

/**
 * Supprime un produit de Firestore.
 */
export async function deleteProductFromFirestore(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'products', id));
  } catch (err) {
    console.error('[products] deleteProductFromFirestore error:', err);
  }
}

/**
 * Met à jour le statut (active/inactive/featured) d'un produit dans Firestore.
 * Appelé depuis la page admin/produits quand l'admin clique "★ À la une" ou "Désactiver".
 */
export async function updateProductStatusInFirestore(
  id: string,
  status: ProductStatus,
): Promise<void> {
  try {
    await setDoc(
      doc(db, 'products', id),
      { status, updatedAt: serverTimestamp() },
      { merge: true },
    );
  } catch (err) {
    console.error('[products] updateProductStatusInFirestore error:', err);
  }
}

/**
 * Met à jour le badge (new/sale/hot) d'un produit dans Firestore.
 */
export async function updateProductBadgeInFirestore(
  id: string,
  badge: 'new' | 'sale' | 'hot' | null,
): Promise<void> {
  try {
    await setDoc(
      doc(db, 'products', id),
      { badge: badge ?? null, updatedAt: serverTimestamp() },
      { merge: true },
    );
  } catch (err) {
    console.error('[products] updateProductBadgeInFirestore error:', err);
  }
}

/**
 * Subscribes to all admin-created products in Firestore.
 * Used by the catalogue page to merge with seed products.
 */
export function subscribeFirestoreProducts(
  cb: (products: Product[]) => void,
): () => void {
  try {
    return onSnapshot(
      query(collection(db, 'products')),
      (snap) => {
        const products = snap.docs.map((d) => ({ ...d.data(), id: d.id } as Product));
        cb(products);
      },
      (err) => {
        console.error('[products] subscribeFirestoreProducts error:', err);
        cb([]);
      },
    );
  } catch {
    cb([]);
    return () => {};
  }
}
