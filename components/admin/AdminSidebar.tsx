'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAdmin } from './AdminProvider';
import type { AdminPermission } from '@/lib/admin/types';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  permission?: AdminPermission;
  principalOnly?: boolean;
  badge?: number;
}

export function AdminSidebar() {
  const path = usePathname();
  const { currentAdmin, orders, notifications, invitations } = useAdmin();
  if (!currentAdmin) return null;

  const unreadOrders = orders.filter((o) => o.unreadCount > 0).length;
  const unreadNotifs = notifications.filter((n) => !n.read).length;
  const pendingInv = invitations.filter((i) => i.status === 'pending').length;

  const items: NavItem[] = [
    { href: '/admin', label: 'Dashboard', icon: <DashboardIcon /> },
    { href: '/admin/produits', label: 'Catalogue', icon: <BagIcon />, permission: 'catalog' },
    { href: '/admin/imports', label: 'Imports', icon: <ImportIcon />, permission: 'catalog' },
    {
      href: '/admin/commandes',
      label: 'Commandes & Chat',
      icon: <ChatIcon />,
      permission: 'orders',
      badge: unreadOrders,
    },
    { href: '/admin/editorial', label: 'Éditorial', icon: <StarIcon />, permission: 'editorial' },
    { href: '/admin/taux', label: 'Taux de change', icon: <CoinIcon />, permission: 'exchange_rate' },
    { href: '/admin/clients', label: 'Clients', icon: <UsersIcon />, permission: 'clients' },
    { href: '/admin/statistiques', label: 'Statistiques', icon: <ChartIcon />, permission: 'orders' },
    {
      href: '/admin/notifications',
      label: 'Notifications',
      icon: <BellIcon />,
      permission: 'notifications',
      badge: unreadNotifs,
    },
    {
      href: '/admin/equipe',
      label: 'Équipe',
      icon: <CrownIcon />,
      principalOnly: true,
      badge: pendingInv,
    },
    {
      href: '/admin/parametres',
      label: 'Paramètres',
      icon: <GearIcon />,
      principalOnly: true,
    },
  ];

  const isPrincipal = currentAdmin.role === 'admin_principal';

  const visible = items.filter((item) => {
    // Items réservés aux admins principaux
    if (item.principalOnly && !isPrincipal) return false;
    // L'admin principal voit tous les modules sans restriction de permissions
    if (item.permission && !isPrincipal && !currentAdmin.permissions.includes(item.permission)) return false;
    return true;
  });

  return (
    <aside className="w-64 shrink-0 bg-ink text-cream/90 flex flex-col h-screen sticky top-0">
      {/* Brand */}
      <Link href="/admin" className="p-6 border-b border-cream/10 flex items-center gap-2">
        <span className="font-display font-extrabold text-xl tracking-[0.18em] text-terra">
          ILU
        </span>
        <span className="font-display font-extrabold text-xl tracking-[0.18em] text-cream">
          ADMIN.
        </span>
      </Link>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <span className="block px-3 py-2 font-display text-[10px] tracking-[0.3em] uppercase text-cream/30 font-semibold">
          Modules
        </span>
        <ul className="space-y-0.5">
          {visible.map((item) => {
            const active =
              item.href === '/admin' ? path === '/admin' : path?.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                    active
                      ? 'bg-terra text-cream'
                      : 'text-cream/70 hover:bg-cream/5 hover:text-cream'
                  }`}
                >
                  <span className={active ? 'text-cream' : 'text-cream/40'}>{item.icon}</span>
                  <span className="flex-1">{item.label}</span>
                  {item.badge ? (
                    <span
                      className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center ${
                        active ? 'bg-cream text-terra' : 'bg-terra text-cream'
                      }`}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>

        <span className="block px-3 py-2 mt-6 font-display text-[10px] tracking-[0.3em] uppercase text-cream/30 font-semibold">
          Liens rapides
        </span>
        <ul className="space-y-0.5">
          <li>
            <Link
              href="/"
              target="_blank"
              className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-cream/70 hover:bg-cream/5 hover:text-cream transition-colors"
            >
              <ExternalIcon />
              Voir la boutique
            </Link>
          </li>
        </ul>
      </nav>

      {/* User block */}
      <div className="p-4 border-t border-cream/10">
        <div className="flex items-center gap-3 px-2">
          <div className="w-9 h-9 rounded-full bg-terra flex items-center justify-center font-display font-bold text-sm text-cream">
            {currentAdmin.fullName
              .split(' ')
              .map((s) => s[0])
              .slice(0, 2)
              .join('')}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-cream truncate">{currentAdmin.fullName}</div>
            <div className="text-[10px] text-cream/40 font-display tracking-widest uppercase truncate">
              {currentAdmin.role === 'admin_principal' ? 'Principal' : 'Secondaire'}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function DashboardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
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
function ChatIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M21 12a9 9 0 0 1-13.4 7.86L3 21l1.14-4.6A9 9 0 1 1 21 12Z" strokeLinejoin="round" />
    </svg>
  );
}
function StarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="m12 2 3 6.5 7 1-5 4.8 1.2 7L12 17.8 5.8 21.3 7 14.3 2 9.5l7-1L12 2Z" strokeLinejoin="round" />
    </svg>
  );
}
function CoinIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9h4a2 2 0 1 1 0 4H9m0 0v4m0-4h6" strokeLinecap="round" />
    </svg>
  );
}
function UsersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2 21c0-3.9 3.1-7 7-7s7 3.1 7 7" strokeLinecap="round" />
      <path d="M17 11a3 3 0 1 0 0-6m5 16c0-2.5-1.7-4.6-4-5.3" strokeLinecap="round" />
    </svg>
  );
}
function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2H4.5L6 16Z" strokeLinejoin="round" />
      <path d="M10 21h4" strokeLinecap="round" />
    </svg>
  );
}
function CrownIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 9l3 9h12l3-9-5 3-4-6-4 6-5-3Z" strokeLinejoin="round" />
    </svg>
  );
}
function ImportIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3v12m0 0-4-4m4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 17v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2" strokeLinecap="round" />
    </svg>
  );
}
function ChartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 3v18h18" strokeLinecap="round" />
      <path d="M7 16l4-6 4 4 4-8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ExternalIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M14 4h6v6M10 14 20 4M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
