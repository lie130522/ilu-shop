'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useShop } from './ShopProvider';
import { CurrencyToggle } from './CurrencyToggle';

const NAV_LINKS = [
  { href: '/', label: 'Accueil' },
  { href: '/catalogue', label: 'Catalogue' },
  { href: '/catalogue?cat=mode', label: 'Mode' },
  { href: '/catalogue?cat=telephones', label: 'High-Tech' },
  { href: '/#featured', label: 'À la une' },
];

export function Navbar() {
  const { cartCount, wishlist } = useShop();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
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
          <nav className="hidden lg:flex items-center gap-10">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="font-display text-[13px] font-medium tracking-wider uppercase text-ink/80 hover:text-terra transition-colors duration-200 relative group"
              >
                {link.label}
                <span className="absolute -bottom-1 left-0 w-0 h-px bg-terra group-hover:w-full transition-all duration-300" />
              </Link>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-3 md:gap-5">
            <CurrencyToggle />

            <button
              type="button"
              aria-label="Rechercher"
              className="hidden md:flex w-10 h-10 items-center justify-center rounded-full border border-line text-ink hover:bg-beige transition-colors"
            >
              <SearchIcon />
            </button>

            <Link
              href="/compte"
              aria-label="Compte"
              className="hidden md:flex w-10 h-10 items-center justify-center rounded-full border border-line text-ink hover:bg-beige transition-colors"
            >
              <UserIcon />
            </Link>

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
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="font-display text-base font-medium py-3 border-b border-line/60 text-ink hover:text-terra transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
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
