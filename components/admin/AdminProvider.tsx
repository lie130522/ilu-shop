'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  ADMIN_MAX,
  DEMO_PASSWORD,
  SEED_CLIENTS,
  SEED_INVITATIONS,
  SEED_NOTIFICATIONS,
  SEED_ORDERS,
  SEED_PRINCIPAL_ADMIN,
} from '@/lib/admin/seed';
import type {
  Admin,
  AdminNotification,
  AdminPermission,
  Client,
  Invitation,
  OrderConversation,
  OrderStatus,
} from '@/lib/admin/types';
import { PRODUCTS as SEED_PRODUCTS } from '@/lib/products';
import type { Product } from '@/lib/types';

const STORAGE = {
  admins: 'ilu_admins',
  invitations: 'ilu_invitations',
  clients: 'ilu_clients',
  orders: 'ilu_orders',
  notifications: 'ilu_notifications',
  products: 'ilu_products',
  rate: 'ilu_exchange_rate',
  session: 'ilu_admin_session',
} as const;

interface AdminError {
  code: 'ADMIN_LIMIT' | 'EMAIL_EXISTS' | 'INVALID_TOKEN' | 'EXPIRED_TOKEN' | 'TOKEN_USED' | 'UNAUTHORIZED';
  message: string;
}

interface AdminContextValue {
  ready: boolean;
  currentAdmin: Admin | null;
  admins: Admin[];
  invitations: Invitation[];
  clients: Client[];
  orders: OrderConversation[];
  notifications: AdminNotification[];
  products: Product[];
  exchangeRate: number;
  rateUpdatedAt: string;
  rateUpdatedBy: string;
  // Auth
  login: (email: string, password: string) => Admin | AdminError;
  logout: () => void;
  // Admin / invitations
  totalAdminSlots: number; // active admins + pending invitations
  canInvite: boolean;
  inviteAdmin: (
    email: string,
    permissions: AdminPermission[],
  ) => Invitation | AdminError;
  revokeInvitation: (invitationId: string) => void;
  acceptInvitation: (
    token: string,
    fullName: string,
    password: string,
  ) => Admin | AdminError;
  revokeAdmin: (adminId: string) => void;
  getInvitationByToken: (token: string) => Invitation | undefined;
  // Modules
  updateExchangeRate: (rate: number) => void;
  toggleFeatured: (productId: string) => void;
  toggleProductActive: (productId: string) => void;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
}

const AdminContext = createContext<AdminContextValue | null>(null);

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function nowISO() {
  return new Date().toISOString();
}

function expiryIn48h() {
  return new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
}

function generateToken(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `tok-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [admins, setAdmins] = useState<Admin[]>([SEED_PRINCIPAL_ADMIN]);
  const [invitations, setInvitations] = useState<Invitation[]>(SEED_INVITATIONS);
  const [clients, setClients] = useState<Client[]>(SEED_CLIENTS);
  const [orders, setOrders] = useState<OrderConversation[]>(SEED_ORDERS);
  const [notifications, setNotifications] = useState<AdminNotification[]>(SEED_NOTIFICATIONS);
  const [products, setProducts] = useState<Product[]>(SEED_PRODUCTS);
  const [exchangeRate, setExchangeRate] = useState<number>(2000);
  const [rateUpdatedAt, setRateUpdatedAt] = useState<string>('2026-05-22T14:00:00Z');
  const [rateUpdatedBy, setRateUpdatedBy] = useState<string>('Lievin Mwamba');
  const [currentAdmin, setCurrentAdmin] = useState<Admin | null>(null);

  // Hydrate from localStorage
  useEffect(() => {
    setAdmins(loadFromStorage<Admin[]>(STORAGE.admins, [SEED_PRINCIPAL_ADMIN]));
    setInvitations(loadFromStorage<Invitation[]>(STORAGE.invitations, SEED_INVITATIONS));
    setClients(loadFromStorage<Client[]>(STORAGE.clients, SEED_CLIENTS));
    setOrders(loadFromStorage<OrderConversation[]>(STORAGE.orders, SEED_ORDERS));
    setNotifications(loadFromStorage<AdminNotification[]>(STORAGE.notifications, SEED_NOTIFICATIONS));
    setProducts(loadFromStorage<Product[]>(STORAGE.products, SEED_PRODUCTS));
    const rateData = loadFromStorage<{ rate: number; updatedAt: string; updatedBy: string }>(
      STORAGE.rate,
      { rate: 2000, updatedAt: '2026-05-22T14:00:00Z', updatedBy: 'Lievin Mwamba' },
    );
    setExchangeRate(rateData.rate);
    setRateUpdatedAt(rateData.updatedAt);
    setRateUpdatedBy(rateData.updatedBy);

    const sessionId = loadFromStorage<string | null>(STORAGE.session, null);
    if (sessionId) {
      const stored = loadFromStorage<Admin[]>(STORAGE.admins, [SEED_PRINCIPAL_ADMIN]);
      const found = stored.find((a) => a.id === sessionId);
      if (found) setCurrentAdmin(found);
    }
    setReady(true);
  }, []);

  // Persist
  useEffect(() => {
    if (ready) localStorage.setItem(STORAGE.admins, JSON.stringify(admins));
  }, [admins, ready]);
  useEffect(() => {
    if (ready) localStorage.setItem(STORAGE.invitations, JSON.stringify(invitations));
  }, [invitations, ready]);
  useEffect(() => {
    if (ready) localStorage.setItem(STORAGE.clients, JSON.stringify(clients));
  }, [clients, ready]);
  useEffect(() => {
    if (ready) localStorage.setItem(STORAGE.orders, JSON.stringify(orders));
  }, [orders, ready]);
  useEffect(() => {
    if (ready) localStorage.setItem(STORAGE.notifications, JSON.stringify(notifications));
  }, [notifications, ready]);
  useEffect(() => {
    if (ready) localStorage.setItem(STORAGE.products, JSON.stringify(products));
  }, [products, ready]);
  useEffect(() => {
    if (ready)
      localStorage.setItem(
        STORAGE.rate,
        JSON.stringify({ rate: exchangeRate, updatedAt: rateUpdatedAt, updatedBy: rateUpdatedBy }),
      );
  }, [exchangeRate, rateUpdatedAt, rateUpdatedBy, ready]);
  useEffect(() => {
    if (!ready) return;
    if (currentAdmin) localStorage.setItem(STORAGE.session, JSON.stringify(currentAdmin.id));
    else localStorage.removeItem(STORAGE.session);
  }, [currentAdmin, ready]);

  // ─── Auth ────────────────────────────────────────────────
  const login = useCallback(
    (email: string, password: string): Admin | AdminError => {
      const admin = admins.find((a) => a.email.toLowerCase() === email.toLowerCase());
      if (!admin || admin.passwordHash !== `mock_hash_${password}`) {
        return { code: 'UNAUTHORIZED', message: 'Email ou mot de passe incorrect.' };
      }
      const updated = { ...admin, lastLogin: nowISO() };
      setAdmins((prev) => prev.map((a) => (a.id === admin.id ? updated : a)));
      setCurrentAdmin(updated);
      return updated;
    },
    [admins],
  );

  const logout = useCallback(() => setCurrentAdmin(null), []);

  // ─── Admins & invitations ────────────────────────────────
  // Règle absolue : max 3 admins (actifs + invitations en attente non expirées)
  const activeInvitations = useMemo(
    () =>
      invitations.filter((inv) => {
        if (inv.status !== 'pending') return false;
        return new Date(inv.expiresAt).getTime() > Date.now();
      }),
    [invitations],
  );

  const totalAdminSlots = admins.length + activeInvitations.length;
  const canInvite = totalAdminSlots < ADMIN_MAX;

  const inviteAdmin = useCallback(
    (email: string, permissions: AdminPermission[]): Invitation | AdminError => {
      if (!currentAdmin || currentAdmin.role !== 'admin_principal') {
        return { code: 'UNAUTHORIZED', message: 'Seul l\'admin principal peut inviter.' };
      }
      if (totalAdminSlots >= ADMIN_MAX) {
        return {
          code: 'ADMIN_LIMIT',
          message: `HTTP 409 — Limite atteinte : ${ADMIN_MAX} admins maximum (actifs + invitations en attente). Révoquez une invitation ou un admin avant d'inviter.`,
        };
      }
      const normalizedEmail = email.toLowerCase().trim();
      if (admins.some((a) => a.email.toLowerCase() === normalizedEmail)) {
        return { code: 'EMAIL_EXISTS', message: 'Cet email correspond déjà à un admin existant.' };
      }
      if (activeInvitations.some((i) => i.email.toLowerCase() === normalizedEmail)) {
        return {
          code: 'EMAIL_EXISTS',
          message: 'Une invitation est déjà en attente pour cet email.',
        };
      }

      const invitation: Invitation = {
        id: `inv-${Date.now()}`,
        token: generateToken(),
        email: normalizedEmail,
        permissions,
        invitedBy: currentAdmin.id,
        createdAt: nowISO(),
        expiresAt: expiryIn48h(),
        status: 'pending',
      };
      setInvitations((prev) => [invitation, ...prev]);
      return invitation;
    },
    [currentAdmin, totalAdminSlots, admins, activeInvitations],
  );

  const revokeInvitation = useCallback((invitationId: string) => {
    setInvitations((prev) =>
      prev.map((i) => (i.id === invitationId ? { ...i, status: 'revoked' as const } : i)),
    );
  }, []);

  const acceptInvitation = useCallback(
    (token: string, fullName: string, password: string): Admin | AdminError => {
      const inv = invitations.find((i) => i.token === token);
      if (!inv) return { code: 'INVALID_TOKEN', message: 'Lien d\'invitation invalide.' };
      if (inv.status === 'accepted' || inv.usedAt) {
        return { code: 'TOKEN_USED', message: 'Cette invitation a déjà été utilisée.' };
      }
      if (inv.status === 'revoked') {
        return { code: 'INVALID_TOKEN', message: 'Cette invitation a été révoquée.' };
      }
      if (new Date(inv.expiresAt).getTime() <= Date.now()) {
        return { code: 'EXPIRED_TOKEN', message: 'Ce lien d\'invitation a expiré (48h dépassées).' };
      }
      // Re-vérification stricte (server-side equivalent)
      if (admins.length >= ADMIN_MAX) {
        return {
          code: 'ADMIN_LIMIT',
          message: `HTTP 409 — Limite atteinte : ${ADMIN_MAX} admins maximum.`,
        };
      }

      const newAdmin: Admin = {
        id: `adm-${Date.now()}`,
        email: inv.email,
        fullName,
        role: 'admin_secondary',
        permissions: inv.permissions,
        invitedBy: inv.invitedBy,
        createdAt: nowISO(),
        passwordHash: `mock_hash_${password}`,
      };
      setAdmins((prev) => [...prev, newAdmin]);
      setInvitations((prev) =>
        prev.map((i) =>
          i.id === inv.id ? { ...i, status: 'accepted' as const, usedAt: nowISO() } : i,
        ),
      );
      return newAdmin;
    },
    [invitations, admins],
  );

  const revokeAdmin = useCallback(
    (adminId: string) => {
      if (!currentAdmin || currentAdmin.role !== 'admin_principal') return;
      // ne jamais supprimer l'admin principal
      const target = admins.find((a) => a.id === adminId);
      if (!target || target.role === 'admin_principal') return;
      setAdmins((prev) => prev.filter((a) => a.id !== adminId));
    },
    [currentAdmin, admins],
  );

  const getInvitationByToken = useCallback(
    (token: string) => invitations.find((i) => i.token === token),
    [invitations],
  );

  // ─── Modules ─────────────────────────────────────────────
  const updateExchangeRate = useCallback(
    (rate: number) => {
      if (!currentAdmin) return;
      setExchangeRate(rate);
      setRateUpdatedAt(nowISO());
      setRateUpdatedBy(currentAdmin.fullName);
    },
    [currentAdmin],
  );

  const toggleFeatured = useCallback((productId: string) => {
    setProducts((prev) =>
      prev.map((p) =>
        p.id === productId
          ? { ...p, status: p.status === 'featured' ? 'active' : 'featured' }
          : p,
      ),
    );
  }, []);

  const toggleProductActive = useCallback((productId: string) => {
    setProducts((prev) =>
      prev.map((p) =>
        p.id === productId
          ? { ...p, status: p.status === 'inactive' ? 'active' : 'inactive' }
          : p,
      ),
    );
  }, []);

  const updateOrderStatus = useCallback((orderId: string, status: OrderStatus) => {
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const value: AdminContextValue = {
    ready,
    currentAdmin,
    admins,
    invitations,
    clients,
    orders,
    notifications,
    products,
    exchangeRate,
    rateUpdatedAt,
    rateUpdatedBy,
    login,
    logout,
    totalAdminSlots,
    canInvite,
    inviteAdmin,
    revokeInvitation,
    acceptInvitation,
    revokeAdmin,
    getInvitationByToken,
    updateExchangeRate,
    toggleFeatured,
    toggleProductActive,
    updateOrderStatus,
    markNotificationRead,
    markAllNotificationsRead,
  };

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used within AdminProvider');
  return ctx;
}

export function isAdminError(value: unknown): value is AdminError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    typeof (value as { code: unknown }).code === 'string'
  );
}

export { DEMO_PASSWORD, ADMIN_MAX };
