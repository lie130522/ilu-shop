// ─── ILU SHOP — Carousel Firestore ───────────────────────────────────────────
// Collection : "carousel"
// Un document par slide. Les slides sont liés à un produit existant du catalogue.

import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './client';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CarouselSlide {
  id: string;
  productId: string;
  ordre: number;
  actif: boolean;
  createdAt: string;
}

// ── Lecture temps réel ────────────────────────────────────────────────────────

/**
 * Subscribe to the carousel collection (ordered by `ordre`).
 * Returns unsubscribe function.
 */
export function subscribeCarousel(
  callback: (slides: CarouselSlide[]) => void,
): () => void {
  const q = query(collection(db, 'carousel'), orderBy('ordre', 'asc'));
  return onSnapshot(q, (snap) => {
    const slides: CarouselSlide[] = snap.docs.map((d) => ({
      ...(d.data() as Omit<CarouselSlide, 'id'>),
      id: d.id,
    }));
    callback(slides);
  });
}

/**
 * One-shot fetch of active carousel slides (for homepage SSR/CSR).
 */
export async function getActiveCarouselSlides(): Promise<CarouselSlide[]> {
  const q = query(collection(db, 'carousel'), orderBy('ordre', 'asc'));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ ...(d.data() as Omit<CarouselSlide, 'id'>), id: d.id }))
    .filter((s) => s.actif);
}

// ── Écriture ──────────────────────────────────────────────────────────────────

/**
 * Add a product to the carousel (at the end).
 */
export async function addSlideToCarousel(
  productId: string,
  currentSlides: CarouselSlide[],
): Promise<void> {
  const maxOrdre = currentSlides.reduce((m, s) => Math.max(m, s.ordre), 0);
  const id = `slide-${Date.now()}`;
  await setDoc(doc(db, 'carousel', id), {
    productId,
    ordre: maxOrdre + 1,
    actif: true,
    createdAt: new Date().toISOString(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Toggle actif status of a slide.
 */
export async function toggleSlideActif(
  slide: CarouselSlide,
): Promise<void> {
  await setDoc(
    doc(db, 'carousel', slide.id),
    { actif: !slide.actif, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

/**
 * Move a slide up or down by swapping `ordre` values with its neighbour.
 */
export async function moveSlide(
  slides: CarouselSlide[],
  slideId: string,
  direction: 'up' | 'down',
): Promise<void> {
  const idx = slides.findIndex((s) => s.id === slideId);
  if (idx < 0) return;
  const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= slides.length) return;

  const a = slides[idx];
  const b = slides[targetIdx];

  // Swap ordre values
  await Promise.all([
    setDoc(doc(db, 'carousel', a.id), { ordre: b.ordre, updatedAt: serverTimestamp() }, { merge: true }),
    setDoc(doc(db, 'carousel', b.id), { ordre: a.ordre, updatedAt: serverTimestamp() }, { merge: true }),
  ]);
}

/**
 * Remove a slide from the carousel (does not delete the product).
 */
export async function removeSlide(slideId: string): Promise<void> {
  await deleteDoc(doc(db, 'carousel', slideId));
}
