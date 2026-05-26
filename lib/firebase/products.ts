// ─── ILU SHOP — Produits Firestore (P20) ─────────────────────────────────────
// Source de vérité publique : Firestore `products/{productId}`
// Images : Firebase Storage `products/{productId}/{imageId}`
// Les produits seed de lib/products.ts restent statiques (non migrés).

import {
  collection,
  doc,
  setDoc,
  query,
  where,
  getDocs,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { db, storage } from './client';
import type { Product, Category } from '@/lib/types';
import type { StoredProduct } from '@/lib/admin/product-store';

// ── Upload image vers Firebase Storage ───────────────────────────────────────

/**
 * Uploads a base64 data URL to Firebase Storage.
 * Returns the public download URL.
 */
async function uploadProductImage(
  productId: string,
  imageId: string,
  dataUrl: string,
): Promise<string> {
  const imgRef = ref(storage, `products/${productId}/${imageId}`);
  await uploadString(imgRef, dataUrl, 'data_url');
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
  await Promise.all(
    product.images.map(async (img, idx) => {
      try {
        const dataUrl = img.processedDataUrl || img.originalDataUrl;
        if (!dataUrl) return;
        const url = await uploadProductImage(product.id, img.id || `img-${idx}`, dataUrl);
        imageUrls[idx] = url;
      } catch (err) {
        console.warn(`[products] image ${idx} upload failed:`, err);
        // Continue without this image
      }
    }),
  );

  // 2. Build Firestore document (Product-compatible shape)
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
    stock: product.stock,
    sizes: product.sizes,
    // Normalize colors: StoredProduct uses { label, hex } → Product uses { name, hex }
    colors: product.colors.map((c) => ({ name: c.label, hex: c.hex })),
    images: imageUrls.filter(Boolean),
    rating: product.rating,
    reviewCount: product.reviewCount,
    source: 'admin',
    createdAt: product.createdAt,
    updatedAt: serverTimestamp(),
  };

  await setDoc(doc(db, 'products', product.id), firestoreDoc);
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
