'use client';

import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import type { CartItem, Currency } from '@/lib/types';
import { subscribeWishlist, addToWishlist, removeFromWishlist, mergeWishlist } from '@/lib/firebase/db';
import { subscribeShopSettings } from '@/lib/firebase/settings';
import { auth } from '@/lib/firebase/client';
import { onAuthStateChanged } from 'firebase/auth';
import { USD_TO_CDF_RATE } from '@/lib/currency';

interface ShopContextValue {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (productId: string, size?: string, color?: string) => void;
  updateQuantity: (productId: string, quantity: number, size?: string, color?: string) => void;
  clearCart: () => void;
  cartCount: number;
  wishlist: string[];
  toggleWishlist: (productId: string) => void;
  chatOpen: boolean;
  openChat: () => void;
  closeChat: () => void;
  // P11 — taux de change depuis Firestore (fallback: USD_TO_CDF_RATE)
  exchangeRate: number;
  rateUpdatedAt: string;
}

const ShopContext = createContext<ShopContextValue | null>(null);

const STORAGE = { cart: 'ilu_cart', currency: 'ilu_currency', wishlist: 'ilu_wishlist' };

export function ShopProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>('USD');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [exchangeRate, setExchangeRate] = useState<number>(USD_TO_CDF_RATE);
  const [rateUpdatedAt, setRateUpdatedAt] = useState<string>('');
  const uidRef = useRef<string | null>(null);

  // Hydrate from localStorage
  useEffect(() => {
    try {
      const c = localStorage.getItem(STORAGE.cart);
      const cur = localStorage.getItem(STORAGE.currency);
      const wl = localStorage.getItem(STORAGE.wishlist);
      if (c) setCart(JSON.parse(c));
      if (cur === 'USD' || cur === 'CDF') setCurrencyState(cur);
      if (wl) setWishlist(JSON.parse(wl));
    } catch {}
    setHydrated(true);
  }, []);

  // P11 — Taux de change depuis Firestore en temps réel
  useEffect(() => {
    const unsub = subscribeShopSettings((settings) => {
      if (settings.exchangeRate) setExchangeRate(settings.exchangeRate);
      if (settings.rateUpdatedAt) setRateUpdatedAt(settings.rateUpdatedAt);
    });
    return unsub;
  }, []);

  // P17 — Firestore wishlist sync (fuite mémoire corrigée)
  // Le listener Firestore est correctement nettoyé quand l'utilisateur se déconnecte
  // ou quand le composant est démonté.
  useEffect(() => {
    let unsubFirestore: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      // Nettoyer l'ancien listener Firestore à chaque changement d'auth
      unsubFirestore?.();
      unsubFirestore = null;
      uidRef.current = user?.uid ?? null;

      if (user) {
        // P23 — Fusionner la wishlist locale dans Firestore au login (union sans doublons)
        try {
          const localIds = JSON.parse(localStorage.getItem(STORAGE.wishlist) ?? '[]') as string[];
          if (localIds.length > 0) {
            mergeWishlist(user.uid, localIds).catch(() => {});
          }
        } catch { /* ignore */ }

        unsubFirestore = subscribeWishlist(user.uid, (ids) => {
          setWishlist(ids);
          localStorage.setItem(STORAGE.wishlist, JSON.stringify(ids));
        });
      }
    });

    return () => {
      unsubAuth();
      unsubFirestore?.(); // nettoyage du listener Firestore à l'unmount
    };
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE.cart, JSON.stringify(cart));
  }, [cart, hydrated]);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE.currency, currency);
  }, [currency, hydrated]);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE.wishlist, JSON.stringify(wishlist));
  }, [wishlist, hydrated]);

  const setCurrency = useCallback((c: Currency) => setCurrencyState(c), []);

  const sameLine = (a: CartItem, b: CartItem) =>
    a.productId === b.productId && a.size === b.size && a.color === b.color;

  const addToCart = useCallback((item: CartItem) => {
    setCart((prev) => {
      const idx = prev.findIndex((p) => sameLine(p, item));
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + item.quantity };
        return next;
      }
      return [...prev, item];
    });
  }, []);

  const removeFromCart = useCallback((productId: string, size?: string, color?: string) => {
    setCart((prev) =>
      prev.filter((p) => !(p.productId === productId && p.size === size && p.color === color)),
    );
  }, []);

  const updateQuantity = useCallback(
    (productId: string, quantity: number, size?: string, color?: string) => {
      setCart((prev) =>
        prev
          .map((p) =>
            p.productId === productId && p.size === size && p.color === color
              ? { ...p, quantity }
              : p,
          )
          .filter((p) => p.quantity > 0),
      );
    },
    [],
  );

  const clearCart = useCallback(() => setCart([]), []);

  const toggleWishlist = useCallback((productId: string) => {
    setWishlist((prev) => {
      const next = prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId];
      const uid = uidRef.current;
      if (uid) {
        if (prev.includes(productId)) removeFromWishlist(uid, productId).catch(() => {});
        else addToWishlist(uid, productId).catch(() => {});
      }
      return next;
    });
  }, []);

  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);

  const value: ShopContextValue = {
    currency,
    setCurrency,
    cart,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    cartCount,
    wishlist,
    toggleWishlist,
    chatOpen,
    openChat: () => setChatOpen(true),
    closeChat: () => setChatOpen(false),
    exchangeRate,
    rateUpdatedAt,
  };

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop() {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error('useShop must be used within ShopProvider');
  return ctx;
}
