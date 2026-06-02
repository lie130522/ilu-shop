'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAdmin } from './AdminProvider';
import { useSidebar } from './SidebarContext';
import { useRouter } from 'next/navigation';

export function AdminTopBar({ title, subtitle }: { title?: string; subtitle?: string }) {
  const { currentAdmin, notifications, markNotificationRead, markAllNotificationsRead, logout } =
    useAdmin();
  const { setOpen: openSidebar } = useSidebar();
  const router = useRouter();
  const [notifsOpen, setNotifsOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  if (!currentAdmin) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleLogout = () => {
    logout();
    router.push('/admin/login');
  };

  return (
    <header className="bg-cream border-b border-line sticky top-0 z-30">
      <div className="px-4 md:px-8 py-3 md:py-4 flex items-center justify-between gap-3 md:gap-6">

        {/* ── Hamburger — mobile uniquement ── */}
        <button
          type="button"
          onClick={() => openSidebar(true)}
          aria-label="Ouvrir le menu"
          className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg hover:bg-bone transition-colors shrink-0 -ml-1"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
          </svg>
        </button>

        <div className="min-w-0 flex-1">
          {title && (
            <h1 className="font-display font-bold text-xl md:text-2xl text-ink leading-tight truncate">
              {title}
            </h1>
          )}
          {subtitle && <p className="text-xs text-muted font-light mt-0.5 truncate">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="hidden md:flex items-center bg-bone border border-line rounded-full px-4 py-2 w-72">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8A7060" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder="Rechercher…"
              className="ml-2 bg-transparent text-sm outline-none flex-1 placeholder:text-muted"
            />
          </div>

          {/* Notifications */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setNotifsOpen((v) => !v);
                setUserOpen(false);
              }}
              className="relative w-10 h-10 rounded-full border border-line bg-cream hover:bg-beige flex items-center justify-center transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2H4.5L6 16Z" strokeLinejoin="round" />
                <path d="M10 21h4" strokeLinecap="round" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-terra text-cream text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>
            {notifsOpen && (
              <div className="absolute right-0 mt-2 w-96 bg-cream border border-line rounded-lg shadow-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-line flex items-center justify-between">
                  <h3 className="font-display text-sm font-bold">Notifications</h3>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllNotificationsRead}
                      className="font-display text-[10px] tracking-widest uppercase text-terra hover:text-terra-dark underline"
                    >
                      Tout marquer lu
                    </button>
                  )}
                </div>
                <div className="max-h-96 overflow-y-auto divide-y divide-line">
                  {notifications.slice(0, 10).map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => markNotificationRead(n.id)}
                      className={`w-full text-left px-4 py-3 hover:bg-bone transition-colors flex gap-3 ${
                        !n.read ? 'bg-terra/5' : ''
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-base shrink-0 ${
                          n.type === 'new_order'
                            ? 'bg-terra text-cream'
                            : n.type === 'new_message'
                              ? 'bg-gold text-ink'
                              : n.type === 'new_client'
                                ? 'bg-beige text-ink'
                                : 'bg-bone text-muted'
                        }`}
                      >
                        {n.type === 'new_order' ? '🛍️' : n.type === 'new_message' ? '💬' : n.type === 'new_client' ? '👤' : '⚙'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-display text-sm font-semibold text-ink">{n.title}</div>
                        <div className="text-xs text-muted truncate mt-0.5">{n.body}</div>
                      </div>
                      {!n.read && <span className="w-2 h-2 rounded-full bg-terra shrink-0 mt-2" />}
                    </button>
                  ))}
                </div>
                <Link
                  href="/admin/notifications"
                  onClick={() => setNotifsOpen(false)}
                  className="block px-4 py-3 border-t border-line text-center font-display text-[11px] tracking-widest uppercase font-semibold text-terra hover:bg-bone transition-colors"
                >
                  Voir toutes les notifications →
                </Link>
              </div>
            )}
          </div>

          {/* User menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setUserOpen((v) => !v);
                setNotifsOpen(false);
              }}
              className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border border-line bg-cream hover:bg-beige transition-colors"
            >
              <span className="w-8 h-8 rounded-full bg-terra text-cream flex items-center justify-center font-display font-bold text-xs">
                {currentAdmin.fullName
                  .split(' ')
                  .map((s) => s[0])
                  .slice(0, 2)
                  .join('')}
              </span>
              <span className="font-display text-xs font-semibold tracking-wider text-ink hidden md:inline">
                {currentAdmin.fullName.split(' ')[0]}
              </span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {userOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-cream border border-line rounded-lg shadow-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-line">
                  <div className="font-display text-sm font-bold text-ink">
                    {currentAdmin.fullName}
                  </div>
                  <div className="text-xs text-muted">{currentAdmin.email}</div>
                </div>
                <div className="py-1">
                  <Link
                    href="/admin"
                    onClick={() => setUserOpen(false)}
                    className="block px-4 py-2 text-sm hover:bg-bone transition-colors"
                  >
                    Dashboard
                  </Link>
                  {currentAdmin.role === 'admin_principal' && (
                    <Link
                      href="/admin/equipe"
                      onClick={() => setUserOpen(false)}
                      className="block px-4 py-2 text-sm hover:bg-bone transition-colors"
                    >
                      Gestion de l'équipe
                    </Link>
                  )}
                  <Link
                    href="/"
                    target="_blank"
                    onClick={() => setUserOpen(false)}
                    className="block px-4 py-2 text-sm hover:bg-bone transition-colors"
                  >
                    Voir la boutique ↗
                  </Link>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-3 text-sm font-medium text-terra-dark hover:bg-bone border-t border-line transition-colors"
                >
                  Déconnexion
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
