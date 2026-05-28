'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { useShop } from './ShopProvider';
import { CurrencyToggle } from './CurrencyToggle';
import { useAuth } from './AuthProvider';
import { useAllProducts } from '@/lib/hooks/useAllProducts';

const NAV_LINKS = [
  { href: '/', label: 'Accueil' },
  { href: '/catalogue', label: 'Catalogue' },
  { href: '/showroom', label: 'Showroom' },
  { href: '/catalogue?cat=mode', label: 'Mode' },
  { href: '/catalogue?cat=technologie', label: 'Technologie' },
  { href: '/catalogue?cat=services', label: 'Services' },
  { href: '/promo', label: '% Promo', highlight: true },
];

export function Navbar() {
  const { cartCount, wishlist } = useShop();
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Produits fusionnés seed + Firestore pour la recherche
  const allProducts = useAllProducts();

  // P27 — Focus input quand le modal s'ouvre
  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearchQuery('');
    }
  }, [searchOpen]);

  // P27 — Fermer avec Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSearchOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // P27 — Résultats de recherche (filtre en temps réel, inclut produits Firestore)
  const searchResults = searchQuery.length >= 2
    ? allProducts.filter((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.shortDescription.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))
      ).slice(0, 6)
    : [];

  return (
    <>
      <header className="sticky top-0 z-40 backdrop-blur-md bg-cream/85 border-b border-line">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <Link href="/" className="group flex items-center gap-2">
              <span className="font-display font-extrabold text-2xl tracking-[0.18em] text-terra group-hover:text-terra-dark transition-colors">
                ILU
              </span>
              <span className="font-display font-extrabold text-2xl tracking-[0.18em] text-ink">
                SHOP.
              </span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden lg:flex items-center gap-8">
              {NAV_LINKS.map((link) =>
                (link as { highlight?: boolean }).highlight ? (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="font-display text-[11px] font-bold tracking-widest uppercase px-3 py-1.5 rounded-full bg-gold/20 text-[#7A5A15] border border-gold/50 hover:bg-gold/40 transition-colors duration-200"
                  >
                    {link.label}
                  </Link>
                ) : (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="font-display text-[13px] font-medium tracking-wider uppercase text-ink/80 hover:text-terra transition-colors duration-200 relative group"
                  >
                    {link.label}
                    <span className="absolute -bottom-1 left-0 w-0 h-px bg-terra group-hover:w-full transition-all duration-300" />
                  </Link>
                )
              )}
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-3 md:gap-5">
              <CurrencyToggle />

              {/* P27 — Bouton recherche */}
              <button
                type="button"
                aria-label="Rechercher"
                onClick={() => setSearchOpen(true)}
                className="hidden md:flex w-10 h-10 items-center justify-center rounded-full border border-line text-ink hover:bg-beige transition-colors"
              >
                <SearchIcon />
              </button>

              <Link
                href={user ? '/compte' : '/connexion'}
                aria-label="Compte"
                className="hidden md:flex w-10 h-10 items-center justify-center rounded-full border border-line text-ink hover:bg-beige transition-colors relative"
                title={user ? `Connecté : ${user.displayName || user.email}` : 'Se connecter'}
              >
                {user ? (
                  <span className="w-5 h-5 rounded-full bg-terra text-cream text-[10px] font-display font-bold flex items-center justify-center">
                    {(user.displayName || user.email || 'U')[0].toUpperCase()}
                  </span>
                ) : (
                  <UserIcon />
                )}
              </Link>

              {/* P28 — Favoris : tooltip si non connecté */}
              {user ? (
                <Link
                  href="/compte#wishlist"
                  aria-label="Favoris"
                  className="relative hidden md:flex w-10 h-10 items-center justify-center rounded-full border border-line text-ink hover:bg-beige transition-colors"
                >
                  <HeartIcon />
                  {wishlist.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-terra text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center font-display">
                      {wishlist.length}
                    </span>
                  )}
                </Link>
              ) : (
                <div className="group relative hidden md:flex">
                  <Link
                    href="/connexion?redirect=/compte%23wishlist"
                    aria-label="Favoris"
                    className="w-10 h-10 items-center justify-center rounded-full border border-line text-ink hover:bg-beige transition-colors flex"
                  >
                    <HeartIcon />
                    {wishlist.length > 0 && (
                      <span className="absolute -top-1 -right-1 bg-terra text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center font-display">
                        {wishlist.length}
                      </span>
                    )}
                  </Link>
                  {/* Tooltip */}
                  <div className="pointer-events-none absolute top-full right-0 mt-2 w-48 bg-ink text-cream text-[11px] font-light rounded-md px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50 text-center leading-snug">
                    Connectez-vous pour accéder à vos favoris
                    <span className="absolute -top-1 right-3.5 w-2 h-2 bg-ink rotate-45" />
                  </div>
                </div>
              )}

              <Link
                href="/panier"
                aria-label="Panier"
                className="relative flex items-center gap-2 px-4 h-10 rounded-full bg-ink text-cream hover:bg-terra transition-colors"
              >
                <BagIcon />
                <span className="font-display text-xs font-semibold tracking-wider">
                  {cartCount}
                </span>
              </Link>

              <button
                type="button"
                className="lg:hidden w-10 h-10 flex flex-col items-center justify-center gap-1.5"
                onClick={() => setMobileOpen((v) => !v)}
                aria-label="Menu"
              >
                <span
                  className={`w-5 h-px bg-ink transition-transform ${mobileOpen ? 'rotate-45 translate-y-[3px]' : ''}`}
                />
                <span
                  className={`w-5 h-px bg-ink transition-transform ${mobileOpen ? '-rotate-45 -translate-y-[3px]' : ''}`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="lg:hidden border-t border-line bg-cream">
            <nav className="px-6 py-6 flex flex-col gap-1">
              {NAV_LINKS.map((link) =>
                (link as { highlight?: boolean }).highlight ? (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="font-display text-base font-bold py-3 border-b border-line/60 text-[#7A5A15] hover:text-gold transition-colors flex items-center gap-2"
                  >
                    <span className="px-2 py-0.5 rounded bg-gold/20 text-xs tracking-widest uppercase">
                      {link.label}
                    </span>
                  </Link>
                ) : (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="font-display text-base font-medium py-3 border-b border-line/60 text-ink hover:text-terra transition-colors"
                  >
                    {link.label}
                  </Link>
                )
              )}
            </nav>
          </div>
        )}
      </header>

      {/* P27 — Modal de recherche */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4">
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Fermer la recherche"
            onClick={() => setSearchOpen(false)}
            className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
          />

          {/* Panel */}
          <div className="relative w-full max-w-xl bg-cream rounded-2xl shadow-2xl overflow-hidden animate-fadeUp">
            {/* Input */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-line">
              <SearchIcon />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un produit, une marque…"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="text-muted hover:text-ink transition-colors font-display text-xs tracking-widest uppercase"
              >
                Esc
              </button>
            </div>

            {/* Résultats */}
            <div className="max-h-[60vh] overflow-y-auto">
              {searchQuery.length >= 2 && searchResults.length === 0 && (
                <div className="px-5 py-8 text-center text-sm text-muted font-light">
                  Aucun résultat pour «{searchQuery}»
                </div>
              )}
              {searchQuery.length < 2 && (
                <div className="px-5 py-4">
                  <div className="font-display text-[10px] tracking-[0.3em] uppercase text-muted font-semibold mb-3">
                    Suggestions populaires
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {['iPhone', 'Robe', 'MacBook', 'Sneakers', 'Samsung'].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSearchQuery(s)}
                        className="text-xs bg-bone border border-line rounded-full px-3 py-1.5 hover:border-terra hover:bg-terra/5 transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {searchResults.map((product) => (
                <Link
                  key={product.id}
                  href={`/produit/${product.slug}`}
                  onClick={() => setSearchOpen(false)}
                  className="flex items-center gap-4 px-5 py-3 hover:bg-bone transition-colors border-b border-line/50 last:border-0"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={product.images[0]}
                    alt=""
                    className="w-12 h-12 object-cover rounded-md shrink-0 bg-bone"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-display font-semibold text-sm text-ink truncate">
                      {product.name}
                    </div>
                    <div className="text-xs text-muted truncate">{product.shortDescription}</div>
                  </div>
                  <div className="font-display font-bold text-sm text-terra shrink-0">
                    ${product.priceUSD}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}
function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" strokeLinecap="round" />
    </svg>
  );
}
function HeartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path
        d="M12 20s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 10c0 5.65-7 10-7 10Z"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function BagIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M5 7h14l-1.5 12.5a2 2 0 0 1-2 1.75h-7a2 2 0 0 1-2-1.75L5 7Z" />
      <path d="M9 7V5a3 3 0 0 1 6 0v2" strokeLinecap="round" />
    </svg>
  );
}
