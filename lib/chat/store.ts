// Vanilla cross-tab chat store.
// Source of truth: localStorage. Sync: BroadcastChannel + storage events.
// Used by both the client-side ChatModal and the admin /admin/commandes page.

import { SEED_ORDERS } from '@/lib/admin/seed';
import type {
  ChatMessageRecord,
  OrderConversation,
  OrderStatus,
} from '@/lib/admin/types';

const KEY = 'ilu_conversations';
const CHANNEL_NAME = 'ilu-chat';

type Listener = () => void;
type RealtimeEvent =
  | { type: 'sync' }
  | { type: 'typing'; convId: string; sender: 'client' | 'admin' }
  | {
      type: 'notify_new_message';
      convId: string;
      sender: 'client' | 'admin';
      content: string;
      clientName: string;
    }
  | {
      type: 'notify_new_order';
      convId: string;
      clientName: string;
      totalUSD: number;
      itemsLabel: string;
    };

let store: OrderConversation[] = [];
let hydrated = false;
const stateListeners = new Set<Listener>();
const eventListeners = new Set<(e: RealtimeEvent) => void>();
let channel: BroadcastChannel | null = null;

function hydrate() {
  if (hydrated || typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      store = JSON.parse(raw);
    } else {
      store = SEED_ORDERS.map((o) => ({ ...o, messages: [...o.messages] }));
      localStorage.setItem(KEY, JSON.stringify(store));
    }
  } catch {
    store = [];
  }

  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (e: MessageEvent<RealtimeEvent>) => {
      handleRemoteEvent(e.data);
    };
  } catch {
    channel = null;
  }

  // Fallback: storage events (fired on OTHER tabs)
  window.addEventListener('storage', (e) => {
    if (e.key === KEY && e.newValue) {
      try {
        store = JSON.parse(e.newValue);
        notifyState();
      } catch {}
    }
  });

  hydrated = true;
}

function handleRemoteEvent(e: RealtimeEvent) {
  if (e.type === 'sync') {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        store = JSON.parse(raw);
        notifyState();
      }
    } catch {}
  }
  eventListeners.forEach((cb) => cb(e));
}

function persistAndBroadcast(extraEvent?: RealtimeEvent) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(store));
  channel?.postMessage({ type: 'sync' });
  if (extraEvent) {
    channel?.postMessage(extraEvent);
    eventListeners.forEach((cb) => cb(extraEvent));
  }
  notifyState();
}

function notifyState() {
  stateListeners.forEach((l) => l());
}

// ─── React-friendly snapshot API ──────────────────────────────

export function getConversations(): OrderConversation[] {
  hydrate();
  return store;
}

export function getConversation(id: string): OrderConversation | undefined {
  hydrate();
  return store.find((c) => c.id === id);
}

export function subscribe(listener: Listener): () => void {
  hydrate();
  stateListeners.add(listener);
  return () => {
    stateListeners.delete(listener);
  };
}

export function subscribeEvents(callback: (e: RealtimeEvent) => void): () => void {
  hydrate();
  eventListeners.add(callback);
  return () => {
    eventListeners.delete(callback);
  };
}

// ─── Mutations ────────────────────────────────────────────────

export function createConversation(input: {
  clientName: string;
  sessionId?: string;
  cartSummary: string;
  itemsLabel: string;
  totalUSD: number;
}): OrderConversation {
  hydrate();
  const id = `conv-${Date.now()}`;
  const now = new Date().toISOString();
  const conv: OrderConversation = {
    id,
    clientId: input.sessionId || `anon-${Date.now()}`,
    clientName: input.clientName,
    status: 'open',
    itemsLabel: input.itemsLabel,
    totalUSD: input.totalUSD,
    lastMessage: 'Nouveau panier',
    lastMessageAt: now,
    unreadCount: 0,
    createdAt: now,
    messages: [
      {
        id: `msg-${Date.now()}-sys`,
        sender: 'system',
        content: `Panier : ${input.cartSummary}`,
        createdAt: now,
      },
    ],
  };
  store = [conv, ...store];
  persistAndBroadcast({
    type: 'notify_new_order',
    convId: id,
    clientName: input.clientName,
    totalUSD: input.totalUSD,
    itemsLabel: input.itemsLabel,
  });
  return conv;
}

export function findOrCreateConversation(
  sessionId: string,
  input: {
    clientName: string;
    cartSummary: string;
    itemsLabel: string;
    totalUSD: number;
  },
): OrderConversation {
  hydrate();
  const existing = store.find((c) => c.clientId === sessionId && c.status !== 'closed');
  if (existing) return existing;
  return createConversation({ ...input, sessionId });
}

export function sendMessage(
  convId: string,
  sender: 'client' | 'admin' | 'system',
  content: string,
): ChatMessageRecord | null {
  hydrate();
  const conv = store.find((c) => c.id === convId);
  if (!conv) return null;

  const msg: ChatMessageRecord = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    sender,
    content,
    createdAt: new Date().toISOString(),
    readByAdmin: sender === 'admin',
    readByClient: sender === 'client',
  };
  conv.messages = [...conv.messages, msg];
  conv.lastMessage = content;
  conv.lastMessageAt = msg.createdAt;
  if (sender === 'client') {
    conv.unreadCount = (conv.unreadCount ?? 0) + 1;
  }
  store = [...store];

  persistAndBroadcast(
    sender !== 'system'
      ? {
          type: 'notify_new_message',
          convId: conv.id,
          sender,
          content,
          clientName: conv.clientName,
        }
      : undefined,
  );

  return msg;
}

export function markConversationRead(convId: string, by: 'admin' | 'client'): void {
  hydrate();
  const conv = store.find((c) => c.id === convId);
  if (!conv) return;
  let changed = false;
  conv.messages = conv.messages.map((m) => {
    if (by === 'admin' && !m.readByAdmin) {
      changed = true;
      return { ...m, readByAdmin: true };
    }
    if (by === 'client' && !m.readByClient) {
      changed = true;
      return { ...m, readByClient: true };
    }
    return m;
  });
  if (by === 'admin' && conv.unreadCount > 0) {
    conv.unreadCount = 0;
    changed = true;
  }
  if (changed) {
    store = [...store];
    persistAndBroadcast();
  }
}

export function updateConversationStatus(
  convId: string,
  status: OrderStatus,
  paymentMethod?: string,
): void {
  hydrate();
  const conv = store.find((c) => c.id === convId);
  if (!conv) return;
  conv.status = status;
  if (paymentMethod) conv.paymentMethod = paymentMethod;
  store = [...store];
  persistAndBroadcast();
}

export function broadcastTyping(convId: string, sender: 'client' | 'admin'): void {
  hydrate();
  const event: RealtimeEvent = { type: 'typing', convId, sender };
  channel?.postMessage(event);
  eventListeners.forEach((cb) => cb(event));
}

// ─── Session helper (anonymous client identifier) ─────────────

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

export type { RealtimeEvent };
