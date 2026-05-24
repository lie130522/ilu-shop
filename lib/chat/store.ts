// ─── Chat Store — Firestore ────────────────────────────────────────────────────
// Source de vérité : Firestore collection `conversations/{convId}`
// Chaque document contient les métadonnées + un tableau `messages` embarqué.
// BroadcastChannel conservé uniquement pour les indicateurs de frappe (éphémères).
// API compatible avec les composants existants (useSyncExternalStore pattern).

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  where,
  arrayUnion,
  increment,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { ChatMessageRecord, OrderConversation, OrderStatus } from '@/lib/admin/types';

// ── Types internes ─────────────────────────────────────────────────────────────

export type RealtimeEvent =
  | { type: 'typing'; convId: string; sender: 'client' | 'admin' }
  | { type: 'notify_new_message'; convId: string; sender: 'client' | 'admin'; content: string; clientName: string }
  | { type: 'notify_new_order'; convId: string; clientName: string; totalUSD: number; itemsLabel: string };

type Listener = () => void;
type EventListener = (e: RealtimeEvent) => void;

// ── État en mémoire (cache Firestore → React) ──────────────────────────────────

let conversations: OrderConversation[] = [];
const stateListeners = new Set<Listener>();
const eventListeners = new Set<EventListener>();

// Unsubscribes Firestore
let adminUnsub: (() => void) | null = null;
const clientUnsubs = new Map<string, () => void>();

// BroadcastChannel (frappe uniquement)
let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined') return null;
  if (!channel) {
    try {
      channel = new BroadcastChannel('ilu-chat');
      channel.onmessage = (e: MessageEvent<RealtimeEvent>) => {
        eventListeners.forEach((cb) => cb(e.data));
      };
    } catch {
      return null;
    }
  }
  return channel;
}

// ── Helpers internes ───────────────────────────────────────────────────────────

function notifyState() {
  stateListeners.forEach((l) => l());
}

function notifyEvent(e: RealtimeEvent) {
  eventListeners.forEach((cb) => cb(e));
  if (e.type !== 'notify_new_order') getChannel()?.postMessage(e);
}

/** Normalise les Timestamps Firestore en chaînes ISO */
function normalizeConv(id: string, data: Record<string, unknown>): OrderConversation {
  const toISO = (v: unknown): string => {
    if (!v) return new Date().toISOString();
    if (typeof v === 'string') return v;
    if (typeof (v as { toDate?: unknown }).toDate === 'function') {
      return (v as { toDate: () => Date }).toDate().toISOString();
    }
    return new Date().toISOString();
  };

  const rawMessages = (data.messages as ChatMessageRecord[] | undefined) ?? [];
  const messages: ChatMessageRecord[] = rawMessages.map((m) => ({
    ...m,
    createdAt: toISO((m as unknown as Record<string, unknown>).createdAt),
  }));

  return {
    id,
    clientId: (data.clientId as string) ?? '',
    uid: (data.uid as string | undefined) ?? undefined,
    clientName: (data.clientName as string) ?? 'Client',
    status: (data.status as OrderStatus) ?? 'open',
    itemsLabel: (data.itemsLabel as string) ?? '',
    totalUSD: (data.totalUSD as number) ?? 0,
    paymentMethod: (data.paymentMethod as string | undefined) ?? undefined,
    lastMessage: (data.lastMessage as string) ?? '',
    lastMessageAt: toISO(data.lastMessageAt),
    unreadCount: (data.unreadCount as number) ?? 0,
    createdAt: toISO(data.createdAt),
    messages,
  };
}

// ── API React (useSyncExternalStore) ───────────────────────────────────────────

export function getConversations(): OrderConversation[] {
  return conversations;
}

export function getConversation(id: string): OrderConversation | undefined {
  return conversations.find((c) => c.id === id);
}

/** S'abonner aux changements d'état du store (pour useSyncExternalStore) */
export function subscribe(listener: Listener): () => void {
  stateListeners.add(listener);
  return () => stateListeners.delete(listener);
}

/** S'abonner aux événements temps réel (notifications, frappe) */
export function subscribeEvents(callback: EventListener): () => void {
  getChannel();
  eventListeners.add(callback);
  return () => eventListeners.delete(callback);
}

// ── Abonnements Firestore ──────────────────────────────────────────────────────

/**
 * Admin : s'abonner à toutes les conversations en temps réel.
 * À appeler dans un useEffect du composant admin.
 */
export function initAdminConversations(): () => void {
  if (adminUnsub) return () => {};
  try {
    const q = query(collection(db, 'conversations'), orderBy('lastMessageAt', 'desc'));
    adminUnsub = onSnapshot(
      q,
      (snap) => {
        conversations = snap.docs.map((d) =>
          normalizeConv(d.id, d.data() as Record<string, unknown>),
        );
        notifyState();
      },
      (err) => console.error('[chat/store] admin subscription error:', err),
    );
  } catch (err) {
    console.error('[chat/store] initAdminConversations failed:', err);
  }
  return () => {
    adminUnsub?.();
    adminUnsub = null;
  };
}

/**
 * Client : s'abonner à une conversation spécifique.
 * À appeler dans un useEffect du ChatModal avec le convId.
 */
export function initClientConversation(convId: string): () => void {
  if (clientUnsubs.has(convId)) return () => {};
  try {
    const unsub = onSnapshot(
      doc(db, 'conversations', convId),
      (snap) => {
        if (!snap.exists()) return;
        const updated = normalizeConv(snap.id, snap.data() as Record<string, unknown>);
        const idx = conversations.findIndex((c) => c.id === convId);
        if (idx >= 0) {
          conversations = [
            ...conversations.slice(0, idx),
            updated,
            ...conversations.slice(idx + 1),
          ];
        } else {
          conversations = [updated, ...conversations];
        }
        notifyState();
      },
      () => {},
    );
    clientUnsubs.set(convId, unsub);
    return () => {
      unsub();
      clientUnsubs.delete(convId);
    };
  } catch {
    return () => {};
  }
}

// ── Mutations ──────────────────────────────────────────────────────────────────

/** Crée une nouvelle conversation dans Firestore */
export async function createConversation(input: {
  clientName: string;
  sessionId: string;
  uid?: string;
  cartSummary: string;
  itemsLabel: string;
  totalUSD: number;
}): Promise<OrderConversation> {
  const now = new Date().toISOString();
  const systemMsg: ChatMessageRecord = {
    id: `msg-${Date.now()}-sys`,
    sender: 'system',
    content: `Panier : ${input.cartSummary}`,
    createdAt: now,
  };

  const data = {
    clientId: input.sessionId,
    uid: input.uid ?? undefined,
    clientName: input.clientName,
    status: 'open' as OrderStatus,
    itemsLabel: input.itemsLabel,
    totalUSD: input.totalUSD,
    lastMessage: 'Nouveau panier',
    lastMessageAt: now,
    unreadCount: 0,
    createdAt: now,
    messages: [systemMsg],
  };

  const ref = await addDoc(collection(db, 'conversations'), data);
  const conv: OrderConversation = { id: ref.id, ...data };

  // Mise à jour optimiste
  conversations = [conv, ...conversations];
  notifyState();

  // Événement nouvelle commande (sons + notifs admin)
  notifyEvent({
    type: 'notify_new_order',
    convId: ref.id,
    clientName: input.clientName,
    totalUSD: input.totalUSD,
    itemsLabel: input.itemsLabel,
  });

  return conv;
}

/**
 * Trouve la conversation ouverte d'une session ou en crée une nouvelle.
 * Cherche d'abord dans le cache, puis dans Firestore.
 */
export async function findOrCreateConversation(
  sessionId: string,
  input: {
    clientName: string;
    cartSummary: string;
    itemsLabel: string;
    totalUSD: number;
    uid?: string;
  },
): Promise<OrderConversation> {
  // 1. Chercher dans le cache mémoire
  const cached = conversations.find(
    (c) => c.clientId === sessionId && c.status !== 'closed',
  );
  if (cached) return cached;

  // 2. Chercher dans Firestore
  try {
    const q = query(
      collection(db, 'conversations'),
      where('clientId', '==', sessionId),
    );
    const snap = await getDocs(q);
    const openDoc = snap.docs.find((d) => d.data().status !== 'closed');
    if (openDoc) {
      const conv = normalizeConv(openDoc.id, openDoc.data() as Record<string, unknown>);
      if (!conversations.find((c) => c.id === conv.id)) {
        conversations = [conv, ...conversations];
        notifyState();
      }
      return conv;
    }
  } catch {
    // Firestore indisponible — créer sans vérification
  }

  // 3. Créer une nouvelle conversation
  return createConversation({ ...input, sessionId });
}

/**
 * Envoie un message dans une conversation.
 * Écrit dans Firestore via arrayUnion (sans lecture préalable).
 */
export async function sendMessage(
  convId: string,
  sender: 'client' | 'admin' | 'system',
  content: string,
  media?: { mediaUrl: string; mediaType: 'image' | 'video' },
): Promise<ChatMessageRecord | null> {
  const now = new Date().toISOString();
  const displayContent = content || (media?.mediaType === 'image' ? '📷 Photo' : '🎥 Vidéo');

  const msg: ChatMessageRecord = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    sender,
    content,
    ...(media ?? {}),
    createdAt: now,
  };

  const updates: Record<string, unknown> = {
    messages: arrayUnion(msg),
    lastMessage: displayContent,
    lastMessageAt: now,
  };

  if (sender === 'client') {
    updates.unreadCount = increment(1);
  }

  try {
    await updateDoc(doc(db, 'conversations', convId), updates);

    // Mise à jour optimiste du cache
    const conv = conversations.find((c) => c.id === convId);
    if (conv) {
      const updated: OrderConversation = {
        ...conv,
        messages: [...conv.messages, msg],
        lastMessage: displayContent,
        lastMessageAt: now,
        unreadCount: sender === 'client' ? (conv.unreadCount ?? 0) + 1 : conv.unreadCount,
      };
      conversations = conversations.map((c) => (c.id === convId ? updated : c));
      notifyState();
    }

    if (sender !== 'system') {
      notifyEvent({
        type: 'notify_new_message',
        convId,
        sender,
        content: displayContent,
        clientName: conversations.find((c) => c.id === convId)?.clientName ?? 'Client',
      });
    }
  } catch (err) {
    console.error('[chat/store] sendMessage error:', err);
    return null;
  }

  return msg;
}

/** Marque une conversation comme lue (remet unreadCount à 0 côté admin) */
export async function markConversationRead(convId: string, by: 'admin' | 'client'): Promise<void> {
  if (by !== 'admin') return;
  try {
    await updateDoc(doc(db, 'conversations', convId), { unreadCount: 0 });
    conversations = conversations.map((c) =>
      c.id === convId ? { ...c, unreadCount: 0 } : c,
    );
    notifyState();
  } catch {}
}

/** Met à jour le statut d'une conversation */
export async function updateConversationStatus(
  convId: string,
  status: OrderStatus,
  paymentMethod?: string,
): Promise<void> {
  try {
    const updates: Record<string, unknown> = { status };
    if (paymentMethod !== undefined) updates.paymentMethod = paymentMethod;
    await updateDoc(doc(db, 'conversations', convId), updates);
    conversations = conversations.map((c) =>
      c.id === convId
        ? { ...c, status, ...(paymentMethod !== undefined ? { paymentMethod } : {}) }
        : c,
    );
    notifyState();
  } catch {}
}

/** Diffuse un indicateur de frappe (BroadcastChannel uniquement — éphémère) */
export function broadcastTyping(convId: string, sender: 'client' | 'admin'): void {
  const event: RealtimeEvent = { type: 'typing', convId, sender };
  getChannel()?.postMessage(event);
  eventListeners.forEach((cb) => cb(event));
}

// ── Session client ─────────────────────────────────────────────────────────────

const SESSION_KEY = 'ilu_chat_session';

export function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return 'ssr-session';
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? `sess-${crypto.randomUUID()}`
        : `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}
