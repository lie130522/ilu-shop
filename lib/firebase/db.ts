// ─── Firestore helpers — ILU SHOP ─────────────────────────────────────────────
// Toutes les opérations Firestore côté client sont centralisées ici.
// Collections: users/{uid}/profile, wishlist, orders, behavior

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp,
  increment,
  arrayUnion,
  arrayRemove,
  onSnapshot,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './client';
import type { CartItem } from '@/lib/types';
import type { OrderStatus } from '@/lib/admin/types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UserProfile {
  displayName: string;
  email: string;
  phone?: string;
  city?: string;
  address?: string;
  neighborhood?: string;
  updatedAt?: unknown;
}

export interface DeliveryInfo {
  name: string;
  phone: string;
  address: string;
  city: string;
  neighborhood: string;
}

export interface ClientOrder {
  id?: string;
  items: CartItem[];       // CartItem.priceUSD est snapshotté au moment de la commande (P16)
  itemsLabel: string;
  totalUSD: number;
  withdrawalFeeCDF?: number; // frais de retrait MM inclus dans le total réel (P19)
  deliveryInfo: DeliveryInfo;
  paymentMethod: string;
  status: OrderStatus;     // aligné sur lib/admin/types (P15)
  chatConvId?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface BehaviorEvent {
  type: 'view' | 'cart' | 'wishlist' | 'purchase';
  productId: string;
  category: string;
  timestamp?: unknown;
}

// ── User Profile ──────────────────────────────────────────────────────────────

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'data', 'profile'));
    return snap.exists() ? (snap.data() as UserProfile) : null;
  } catch { return null; }
}

export async function setUserProfile(uid: string, profile: Partial<UserProfile>): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'data', 'profile'), {
    ...profile,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

// ── Wishlist ──────────────────────────────────────────────────────────────────

export async function getWishlist(uid: string): Promise<string[]> {
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'data', 'wishlist'));
    return snap.exists() ? ((snap.data() as { productIds: string[] }).productIds ?? []) : [];
  } catch { return []; }
}

export async function addToWishlist(uid: string, productId: string): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'data', 'wishlist'), {
    productIds: arrayUnion(productId),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function removeFromWishlist(uid: string, productId: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid, 'data', 'wishlist'), {
    productIds: arrayRemove(productId),
    updatedAt: serverTimestamp(),
  });
}

export function subscribeWishlist(uid: string, cb: (ids: string[]) => void): Unsubscribe {
  return onSnapshot(doc(db, 'users', uid, 'data', 'wishlist'), (snap) => {
    cb(snap.exists() ? ((snap.data() as { productIds: string[] }).productIds ?? []) : []);
  }, () => cb([]));
}

/** P23 — Fusionne une wishlist locale dans Firestore (union, sans doublons) */
export async function mergeWishlist(uid: string, localIds: string[]): Promise<void> {
  if (localIds.length === 0) return;
  await setDoc(doc(db, 'users', uid, 'data', 'wishlist'), {
    productIds: arrayUnion(...localIds),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

// ── Orders ────────────────────────────────────────────────────────────────────

export async function createOrder(uid: string, order: Omit<ClientOrder, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'users', uid, 'orders'), {
    ...order,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getUserOrders(uid: string): Promise<ClientOrder[]> {
  try {
    const q = query(collection(db, 'users', uid, 'orders'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ClientOrder));
  } catch { return []; }
}

export function subscribeOrders(uid: string, cb: (orders: ClientOrder[]) => void): Unsubscribe {
  const q = query(collection(db, 'users', uid, 'orders'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ClientOrder)));
  }, () => cb([]));
}

// ── Behavioral tracking ───────────────────────────────────────────────────────

export async function trackEvent(uid: string | null, event: BehaviorEvent): Promise<void> {
  try {
    const coll = uid
      ? collection(db, 'users', uid, 'behavior')
      : collection(db, 'anonymous_behavior');
    await addDoc(coll, { ...event, timestamp: serverTimestamp() });

    // Aggregate: increment product view counter
    if (event.type === 'view') {
      await setDoc(doc(db, 'product_stats', event.productId), {
        views: increment(1),
        category: event.category,
        lastSeen: serverTimestamp(),
      }, { merge: true });
    }
  } catch { /* tracking is non-blocking */ }
}

export async function getTopProducts(n = 10): Promise<Array<{ productId: string; views: number; category: string }>> {
  try {
    const q = query(collection(db, 'product_stats'), orderBy('views', 'desc'), limit(n));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ productId: d.id, ...d.data() } as { productId: string; views: number; category: string }));
  } catch { return []; }
}

export async function getUserBehavior(uid: string, n = 50): Promise<BehaviorEvent[]> {
  try {
    const q = query(collection(db, 'users', uid, 'behavior'), orderBy('timestamp', 'desc'), limit(n));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as BehaviorEvent);
  } catch { return []; }
}

/**
 * Supprime tous les événements comportementaux d'un utilisateur.
 * Récursif si plus de 500 documents (limite batch Firestore).
 */
export async function deleteUserBehavior(uid: string): Promise<void> {
  try {
    const q = query(collection(db, 'users', uid, 'behavior'), limit(500));
    const snap = await getDocs(q);
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    // S'il reste des documents, on recommence
    if (snap.docs.length === 500) await deleteUserBehavior(uid);
  } catch { /* non-bloquant */ }
}

/**
 * Supprime le document profil d'un utilisateur
 * (utilisé lors d'une demande de suppression de compte).
 */
export async function deleteUserData(uid: string): Promise<void> {
  try {
    await deleteUserBehavior(uid);
    await deleteDoc(doc(db, 'users', uid, 'data', 'profile'));
    await deleteDoc(doc(db, 'users', uid, 'data', 'wishlist'));
  } catch { /* non-bloquant */ }
}
