// ─── ILU SHOP — Multi-carousels Firestore ────────────────────────────────────
// Collection : "carousels"
// Un document = un carousel nommé avec sa liste de produits.
// Un seul carousel peut être actif à la fois sur la page d'accueil.

import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from './client';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Carousel {
  id: string;
  name: string;
  description: string;
  actif: boolean;
  /** IDs des produits dans l'ordre d'affichage (max MAX_CAROUSEL_PRODUCTS) */
  productIds: string[];
  createdAt: string;
}

export const MAX_CAROUSEL_PRODUCTS = 15;

// ── Lecture temps réel ────────────────────────────────────────────────────────

export function subscribeCarousels(
  callback: (carousels: Carousel[]) => void,
): () => void {
  const q = query(collection(db, 'carousels'), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snap) => {
    callback(
      snap.docs.map((d) => ({
        ...(d.data() as Omit<Carousel, 'id'>),
        id: d.id,
      })),
    );
  });
}

// ── Création ──────────────────────────────────────────────────────────────────

export async function createCarousel(
  name: string,
  description: string,
): Promise<string> {
  const id = `carousel-${Date.now()}`;
  await setDoc(doc(db, 'carousels', id), {
    name: name.trim(),
    description: description.trim(),
    actif: false,
    productIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: serverTimestamp(),
  });
  return id;
}

// ── Activation (désactive tous les autres) ────────────────────────────────────

export async function activateCarousel(
  carouselId: string,
  allCarousels: Carousel[],
): Promise<void> {
  const batch = writeBatch(db);
  for (const c of allCarousels) {
    batch.set(
      doc(db, 'carousels', c.id),
      { actif: c.id === carouselId, updatedAt: serverTimestamp() },
      { merge: true },
    );
  }
  await batch.commit();
}

// ── Désactivation ─────────────────────────────────────────────────────────────

export async function deactivateCarousel(carouselId: string): Promise<void> {
  await setDoc(
    doc(db, 'carousels', carouselId),
    { actif: false, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

// ── Mise à jour des produits ──────────────────────────────────────────────────

export async function updateCarouselProducts(
  carouselId: string,
  productIds: string[],
): Promise<void> {
  await setDoc(
    doc(db, 'carousels', carouselId),
    { productIds, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

// ── Mise à jour du nom / description ─────────────────────────────────────────

export async function updateCarouselMeta(
  carouselId: string,
  name: string,
  description: string,
): Promise<void> {
  await setDoc(
    doc(db, 'carousels', carouselId),
    { name: name.trim(), description: description.trim(), updatedAt: serverTimestamp() },
    { merge: true },
  );
}

// ── Suppression ───────────────────────────────────────────────────────────────

export async function deleteCarousel(carouselId: string): Promise<void> {
  await deleteDoc(doc(db, 'carousels', carouselId));
}
