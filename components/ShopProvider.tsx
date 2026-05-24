'use client';

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import type { CartItem, Currency } from '@/lib/types';

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
}

const ShopContext = createContext<ShopContextValue | null>(null);

const STORAGE = { cart: 'ilu_cart', currency: 'ilu_currency', wishlist: 'ilu_wishlist' };

export function ShopProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>('USD');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

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
    setWishlist((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId],
    );
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
  };

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop() {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error('useShop must be used within ShopProvider');
  return ctx;
}
