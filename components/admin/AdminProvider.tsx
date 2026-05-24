'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { bootstrapAdminIfNeeded, subscribeAdminByUid } from '@/lib/firebase/admins';
import { subscribeShopSettings, saveShopSettings, getShopSettings } from '@/lib/firebase/settings';
import {
  subscribe as chatSubscribe,
  getConversations,
  initAdminConversations,
  updateConversationStatus,
} from '@/lib/chat/store';
import {
  ADMIN_MAX,
  SEED_CLIENTS,
  SEED_INVITATIONS,
  SEED_NOTIFICATIONS,
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
  invitations: 'ilu_invitations',
  clients: 'ilu_clients',
  notifications: 'ilu_notifications',
  products: 'ilu_products',
} as const;

// Cookie léger posé côté client pour le middleware (protection routes /admin/*)
function setAdminCookie(value: boolean) {
  if (typeof document === 'undefined') return;
  if (value) {
    document.cookie = '__ilu_admin=1; path=/; SameSite=Strict; max-age=86400';
  } else {
    document.cookie = '__ilu_admin=; path=/; max-age=0';
  }
}

export interface AdminError {
  code: 'ADMIN_LIMIT' | 'EMAIL_EXISTS' | 'INVALID_TOKEN' | 'EXPIRED_TOKEN' | 'TOKEN_USED' | 'UNAUTHORIZED';
  message: string;
}

interface AdminContextValue {
  ready: boolean;
  currentAdmin: Admin | null;
  admins: Admin[];
  invitations: Invitation[];
  clients: Client[];
  orders: OrderConversation[];         // Firestore via chat store (P13)
  notifications: AdminNotification[];
  products: Product[];
  exchangeRate: number;               // Firestore shop_settings (P11)
  rateUpdatedAt: string;
  rateUpdatedBy: string;
  // Auth
  logout: () => void | Promise<void>;
  // Admin / invitations
  totalAdminSlots: number;
  canInvite: boolean;
  inviteAdmin: (email: string, permissions: AdminPermission[]) => Invitation | AdminError;
  revokeInvitation: (invitationId: string) => void;
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

// Snapshot stable pour useSyncExternalStore (évite les recréations d'array)
const EMPTY_CONVERSATIONS: OrderConversation[] = [];

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [currentAdmin, setCurrentAdmin] = useState<Admin | null>(null);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>(SEED_INVITATIONS);
  const [clients, setClients] = useState<Client[]>(SEED_CLIENTS);
  const [notifications, setNotifications] = useState<AdminNotification[]>(SEED_NOTIFICATIONS);
  const [products, setProducts] = useState<Product[]>(SEED_PRODUCTS);

  // P11 — Taux depuis Firestore (shop_settings)
  const [exchangeRate, setExchangeRate] = useState<number>(2000);
  const [rateUpdatedAt, setRateUpdatedAt] = useState<string>('2026-05-24T00:00:00Z');
  const [rateUpdatedBy, setRateUpdatedBy] = useState<string>('Lievin Kabamba');

  // P13 — Commandes depuis Firestore via chat store (useSyncExternalStore)
  const orders = useSyncExternalStore(chatSubscribe, getConversations, () => EMPTY_CONVERSATIONS);

  // Hydrate non-auth data from localStorage (invitations, clients, notifications, products)
  useEffect(() => {
    setInvitations(loadFromStorage<Invitation[]>(STORAGE.invitations, SEED_INVITATIONS));
    setClients(loadFromStorage<Client[]>(STORAGE.clients, SEED_CLIENTS));
    setNotifications(loadFromStorage<AdminNotification[]>(STORAGE.notifications, SEED_NOTIFICATIONS));
    setProducts(loadFromStorage<Product[]>(STORAGE.products, SEED_PRODUCTS));
  }, []);

  // Persist non-auth data (orders et taux maintenant dans Firestore — non persistés ici)
  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE.invitations, JSON.stringify(invitations));
  }, [invitations]);
  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE.clients, JSON.stringify(clients));
  }, [clients]);
  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE.notifications, JSON.stringify(notifications));
  }, [notifications]);
  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE.products, JSON.stringify(products));
  }, [products]);

  // P11 — S'abonner au taux de change depuis Firestore
  useEffect(() => {
    const unsub = subscribeShopSettings((settings) => {
      setExchangeRate(settings.exchangeRate ?? 2000);
      if (settings.rateUpdatedAt) setRateUpdatedAt(settings.rateUpdatedAt);
      if (settings.rateUpdatedBy) setRateUpdatedBy(settings.rateUpdatedBy);
    });
    return unsub;
  }, []);

  // P13 — Initialiser l'abonnement Firestore aux conversations (commandes)
  useEffect(() => {
    const unsub = initAdminConversations();
    return unsub;
  }, []);

  // ─── Firebase Auth → Firestore admin lookup ──────────────────────────────────
  const unsubAdminRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      unsubAdminRef.current?.();
      unsubAdminRef.current = null;

      if (!firebaseUser) {
        setCurrentAdmin(null);
        setAdmins([]);
        setAdminCookie(false);
        setReady(true);
        return;
      }

      const admin = await bootstrapAdminIfNeeded(
        firebaseUser.uid,
        firebaseUser.email ?? '',
        firebaseUser.displayName ?? '',
      );

      if (!admin) {
        setCurrentAdmin(null);
        setAdminCookie(false);
        setReady(true);
        return;
      }

      setCurrentAdmin(admin);
      setAdmins([admin]);
      setAdminCookie(true);

      unsubAdminRef.current = subscribeAdminByUid(firebaseUser.uid, (updated) => {
        if (updated) {
          setCurrentAdmin(updated);
          setAdmins((prev) => {
            const others = prev.filter((a) => a.id !== updated.id);
            return [updated, ...others];
          });
        } else {
          setCurrentAdmin(null);
          setAdmins([]);
          setAdminCookie(false);
        }
      });

      setReady(true);
    });

    return () => {
      unsubAuth();
      unsubAdminRef.current?.();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Auth ─────────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    setCurrentAdmin(null);
    setAdminCookie(false);
    try { await firebaseSignOut(auth); } catch { /* ignore */ }
  }, []);

  // ─── Admins & invitations ────────────────────────────────────────────────────
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
        return { code: 'UNAUTHORIZED', message: "Seul l'admin principal peut inviter." };
      }
      if (totalAdminSlots >= ADMIN_MAX) {
        return {
          code: 'ADMIN_LIMIT',
          message: `Limite atteinte : ${ADMIN_MAX} admins maximum (actifs + invitations en attente). Révoquez une invitation avant d'inviter.`,
        };
      }
      const normalizedEmail = email.toLowerCase().trim();
      if (admins.some((a) => a.email.toLowerCase() === normalizedEmail)) {
        return { code: 'EMAIL_EXISTS', message: 'Cet email correspond déjà à un admin existant.' };
      }
      if (activeInvitations.some((i) => i.email.toLowerCase() === normalizedEmail)) {
        return { code: 'EMAIL_EXISTS', message: 'Une invitation est déjà en attente pour cet email.' };
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

  const revokeAdmin = useCallback(
    (adminId: string) => {
      if (!currentAdmin || currentAdmin.role !== 'admin_principal') return;
      const target = admins.find((a) => a.id === adminId);
      if (!target || target.role === 'admin_principal') return;
      setAdmins((prev) => prev.filter((a) => a.id !== adminId));
      // TODO Groupe 3 finition : supprimer le document Firestore `admins/{adminId}`
    },
    [currentAdmin, admins],
  );

  const getInvitationByToken = useCallback(
    (token: string) => invitations.find((i) => i.token === token),
    [invitations],
  );

  // ─── Modules ──────────────────────────────────────────────────────────────────

  // P11 — Met à jour le taux dans Firestore (source de vérité partagée)
  const currentAdminRef = useRef(currentAdmin);
  currentAdminRef.current = currentAdmin;

  const updateExchangeRate = useCallback((rate: number) => {
    const admin = currentAdminRef.current;
    if (!admin) return;
    const now = nowISO();
    const updatedBy = admin.fullName;
    // Mise à jour optimiste locale
    setExchangeRate(rate);
    setRateUpdatedAt(now);
    setRateUpdatedBy(updatedBy);
    // Persistance Firestore (fire-and-forget)
    getShopSettings().then((current) => {
      saveShopSettings({ ...current, exchangeRate: rate, rateUpdatedAt: now, rateUpdatedBy: updatedBy });
    }).catch(() => {});
  }, []);

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

  // P13 — updateOrderStatus passe maintenant par le chat store Firestore
  const updateOrderStatus = useCallback((orderId: string, status: OrderStatus) => {
    updateConversationStatus(orderId, status).catch(() => {});
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
    logout,
    totalAdminSlots,
    canInvite,
    inviteAdmin,
    revokeInvitation,
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

export { ADMIN_MAX };
