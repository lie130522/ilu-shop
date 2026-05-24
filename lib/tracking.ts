// ─── Tracking comportemental — ILU SHOP ──────────────────────────────────────
// Enregistre les événements utilisateur dans Firestore (si consentement accordé).
// Appels non bloquants — les erreurs sont silencieuses.

import { trackEvent } from './firebase/db';
import type { BehaviorEvent } from './firebase/db';

function hasConsent(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('ilu_cookie_consent') === 'all';
}

export async function trackView(
  uid: string | null,
  productId: string,
  category: string,
): Promise<void> {
  if (!hasConsent()) return;
  await trackEvent(uid, { type: 'view', productId, category });
}

export async function trackCartAdd(
  uid: string | null,
  productId: string,
  category: string,
): Promise<void> {
  if (!hasConsent()) return;
  await trackEvent(uid, { type: 'cart', productId, category });
}

export async function trackWishlist(
  uid: string | null,
  productId: string,
  category: string,
): Promise<void> {
  if (!hasConsent()) return;
  await trackEvent(uid, { type: 'wishlist', productId, category });
}

export async function trackPurchase(
  uid: string | null,
  productId: string,
  category: string,
): Promise<void> {
  await trackEvent(uid, { type: 'purchase', productId, category });
}

// Recently viewed — stocké en localStorage, pas Firestore (opt-in non requis)
const RECENT_KEY = 'ilu_recently_viewed';
const MAX_RECENT = 12;

export function addRecentlyViewed(productId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    const filtered = list.filter((id) => id !== productId);
    const next = [productId, ...filtered].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch { /* ignore */ }
}

export function getRecentlyViewed(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
