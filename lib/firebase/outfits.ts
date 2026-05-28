// ─── ILU SHOP — Outfits Firestore ─────────────────────────────────────────────
// Collection : outfits/{outfitId}
// Photos    : Firebase Storage outfits/{outfitId}/{photoId}

import {
  collection,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { db, storage } from './client';
import type { Outfit } from '@/lib/showroom/types';

// ── Upload photo ───────────────────────────────────────────────────────────────

async function uploadOutfitPhoto(
  outfitId: string,
  photoId: string,
  dataUrl: string,
): Promise<string> {
  // Déjà uploadé (URL Storage ou https externe)
  if (dataUrl.startsWith('http://') || dataUrl.startsWith('https://')) return dataUrl;

  const mimeMatch = dataUrl.match(/^data:([^;]+);/);
  const contentType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const imgRef = ref(storage, `outfits/${outfitId}/${photoId}`);
  await uploadString(imgRef, dataUrl, 'data_url', { contentType });
  return getDownloadURL(imgRef);
}

// ── Sauvegarde (create / update) ───────────────────────────────────────────────

export async function saveOutfitToFirestore(outfit: Outfit): Promise<void> {
  // Upload des photos non encore en ligne
  const photoUrls: string[] = [];
  await Promise.all(
    outfit.photos.map(async (dataUrl, i) => {
      photoUrls[i] = await uploadOutfitPhoto(outfit.id, `photo-${i}`, dataUrl);
    }),
  );

  await setDoc(doc(db, 'outfits', outfit.id), {
    ...outfit,
    photos: photoUrls,
    updatedAt: serverTimestamp(),
  });
}

// ── Suppression ───────────────────────────────────────────────────────────────

export async function deleteOutfitFromFirestore(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'outfits', id));
  } catch (err) {
    console.error('[outfits] deleteOutfitFromFirestore error:', err);
  }
}

// ── Lecture par ID (admin edit) ───────────────────────────────────────────────

export async function getOutfitByIdFirestore(id: string): Promise<Outfit | null> {
  try {
    const snap = await getDoc(doc(db, 'outfits', id));
    if (!snap.exists()) return null;
    return { ...(snap.data() as Outfit), id: snap.id };
  } catch (err) {
    console.error('[outfits] getOutfitByIdFirestore error:', err);
    return null;
  }
}

// ── Souscription temps réel — côté client (publiés uniquement) ─────────────────

export function subscribePublishedOutfits(cb: (outfits: Outfit[]) => void): () => void {
  try {
    return onSnapshot(
      query(collection(db, 'outfits'), where('status', '==', 'published')),
      (snap) => {
        const outfits = snap.docs.map((d) => ({ ...(d.data() as Outfit), id: d.id }));
        // Trier par date de création DESC
        outfits.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        cb(outfits);
      },
      (err) => {
        console.error('[outfits] subscribePublishedOutfits error:', err);
        cb([]);
      },
    );
  } catch {
    cb([]);
    return () => {};
  }
}

// ── Souscription temps réel — tous (admin) ────────────────────────────────────

export function subscribeAllOutfits(cb: (outfits: Outfit[]) => void): () => void {
  try {
    return onSnapshot(
      query(collection(db, 'outfits')),
      (snap) => {
        const outfits = snap.docs.map((d) => ({ ...(d.data() as Outfit), id: d.id }));
        outfits.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        cb(outfits);
      },
      (err) => {
        console.error('[outfits] subscribeAllOutfits error:', err);
        cb([]);
      },
    );
  } catch {
    cb([]);
    return () => {};
  }
}
