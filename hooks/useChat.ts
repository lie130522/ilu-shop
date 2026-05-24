'use client';

// React hooks wrapping the vanilla cross-tab chat store.
// Components should import from here rather than lib/chat/store directly.

import { useSyncExternalStore, useEffect, useRef } from 'react';
import {
  subscribe,
  subscribeEvents,
  getConversations,
} from '@/lib/chat/store';
import type { RealtimeEvent } from '@/lib/chat/store';

/** Live-updating list of all conversations (cross-tab). */
export function useConversations() {
  return useSyncExternalStore(subscribe, getConversations, () => []);
}

/** Live-updating single conversation by id. Returns undefined if not found. */
export function useConversation(id: string | null) {
  const all = useConversations();
  if (!id) return undefined;
  return all.find((c) => c.id === id);
}

/**
 * Subscribe to cross-tab realtime events (typing, new_message, new_order, sync).
 * Callback ref is always up to date — safe to use inside render state without
 * re-subscribing on every render.
 */
export function useChatEvents(callback: (e: RealtimeEvent) => void) {
  const ref = useRef(callback);
  ref.current = callback;
  useEffect(() => {
    return subscribeEvents((e) => ref.current(e));
  }, []);
}
