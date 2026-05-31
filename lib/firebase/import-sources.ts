// ─── ILU SHOP — Sources d'import Firestore ───────────────────────────────────
// Collection : "importSources"
// Chaque document = un site fournisseur depuis lequel on scrape régulièrement.

import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './client';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ImportSource {
  id: string;
  name: string;
  url: string;
  lastRun: string | null;
  productsImported: number;
  createdAt: string;
}

// ── Lecture temps réel ────────────────────────────────────────────────────────

export function subscribeImportSources(
  callback: (sources: ImportSource[]) => void,
): () => void {
  const q = query(collection(db, 'importSources'), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snap) => {
    callback(
      snap.docs.map((d) => ({
        ...(d.data() as Omit<ImportSource, 'id'>),
        id: d.id,
      })),
    );
  }, () => callback([]));
}

// ── Création ──────────────────────────────────────────────────────────────────

export async function createImportSource(
  name: string,
  url: string,
): Promise<string> {
  const id = `src-${Date.now()}`;
  await setDoc(doc(db, 'importSources', id), {
    name: name.trim(),
    url: url.trim(),
    lastRun: null,
    productsImported: 0,
    createdAt: new Date().toISOString(),
    updatedAt: serverTimestamp(),
  });
  return id;
}

// ── Mise à jour après un import ───────────────────────────────────────────────

export async function recordImportRun(
  sourceId: string,
  productsAdded: number,
): Promise<void> {
  await setDoc(
    doc(db, 'importSources', sourceId),
    {
      lastRun: new Date().toISOString(),
      productsImported: productsAdded,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

// ── Suppression ───────────────────────────────────────────────────────────────

export async function deleteImportSource(sourceId: string): Promise<void> {
  await deleteDoc(doc(db, 'importSources', sourceId));
}
