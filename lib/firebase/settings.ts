// ─── Shop Settings — Firestore ────────────────────────────────────────────────
// Collection: shop_settings / doc: default
// Contient les paramètres publics (numéros MM, frais) + infos admin boutique.

import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from './client';

export interface MobileMoneyConfig {
  number: string;
  accountName: string;
  active: boolean;
}

export interface ShopSettings {
  mpesa: MobileMoneyConfig;
  airtel: MobileMoneyConfig;
  orange: MobileMoneyConfig;
  withdrawalFeeCDF: number;   // frais de retrait MM (défaut 3000)
  deliveryNote: string;       // note auto envoyée dans le chat à la livraison
  updatedAt?: unknown;
}

export const DEFAULT_SETTINGS: ShopSettings = {
  mpesa:  { number: '', accountName: 'ILU SHOP', active: true },
  airtel: { number: '', accountName: 'ILU SHOP', active: true },
  orange: { number: '', accountName: 'ILU SHOP', active: false },
  withdrawalFeeCDF: 3000,
  deliveryNote: 'Pour confirmer votre présence au lieu de livraison, merci d\'envoyer une photo ou courte vidéo (max 30s) de l\'endroit.',
};

const SETTINGS_DOC = () => doc(db, 'shop_settings', 'default');

export async function getShopSettings(): Promise<ShopSettings> {
  try {
    const snap = await getDoc(SETTINGS_DOC());
    if (snap.exists()) return { ...DEFAULT_SETTINGS, ...snap.data() } as ShopSettings;
  } catch {
    // Firestore not available, return defaults
  }
  return DEFAULT_SETTINGS;
}

export async function saveShopSettings(settings: ShopSettings): Promise<void> {
  await setDoc(SETTINGS_DOC(), { ...settings, updatedAt: serverTimestamp() });
}

export function subscribeShopSettings(cb: (s: ShopSettings) => void): () => void {
  try {
    return onSnapshot(SETTINGS_DOC(), (snap) => {
      if (snap.exists()) cb({ ...DEFAULT_SETTINGS, ...snap.data() } as ShopSettings);
      else cb(DEFAULT_SETTINGS);
    }, () => cb(DEFAULT_SETTINGS));
  } catch {
    cb(DEFAULT_SETTINGS);
    return () => {};
  }
}

// ─── Firebase Storage — upload fichier chat ───────────────────────────────────
export interface UploadProgress {
  percent: number;
  url?: string;
}

export function uploadChatFile(
  convId: string,
  file: File,
  onProgress: (p: UploadProgress) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const ext = file.name.split('.').pop() ?? 'bin';
    const path = `chat-uploads/${convId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const storageRef = ref(storage, path);
    const task = uploadBytesResumable(storageRef, file);

    task.on(
      'state_changed',
      (snap) => {
        const percent = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
        onProgress({ percent });
      },
      (err) => reject(err),
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        onProgress({ percent: 100, url });
        resolve(url);
      },
    );
  });
}
