'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useAdmin } from '@/components/admin/AdminProvider';
import { AdminTopBar } from '@/components/admin/AdminTopBar';
import { formatCDF, formatUSD } from '@/lib/currency';
import { STATUS_LABEL, STATUS_TONE, type OrderStatus } from '@/lib/admin/types';
import type { ChatMessageRecord } from '@/lib/admin/types';
import {
  subscribe as chatSubscribe,
  getConversations,
  sendMessage,
  markConversationRead,
  updateConversationStatus,
  broadcastTyping,
  subscribeEvents,
} from '@/lib/chat/store';
import {
  playNewMessageSound,
  playNewOrderSound,
  requestNotifPermission,
  showDesktopNotif,
} from '@/lib/sounds';

const STATUSES: OrderStatus[] = [
  'open',
  'in_progress',
  'order_confirmed',
  'shipped',
  'delivered',
  'closed',
];

// Stable server snapshot — module-level to avoid infinite loop in useSyncExternalStore
const EMPTY_CONVERSATIONS: ReturnType<typeof getConversations> = [];

export default function AdminOrdersPage() {
  const { currentAdmin, exchangeRate } = useAdmin();

  // ── Live conversations from the cross-tab store ──────────────
  const conversations = useSyncExternalStore(chatSubscribe, getConversations, () => EMPTY_CONVERSATIONS);

  const [filter, setFilter] = useState<'all' | OrderStatus>('all');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [adminInput, setAdminInput] = useState('');
  const [clientTyping, setClientTyping] = useState(false);

  // ── Persistent alert preferences (localStorage) ──────────────
  const [soundsMuted, setSoundsMuted] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('ilu_admin_sounds_muted') === '1';
  });
  const [notifsEnabled, setNotifsEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('ilu_admin_notifs_enabled') !== '0';
  });
  const soundsMutedRef = useRef(soundsMuted);
  soundsMutedRef.current = soundsMuted;
  const notifsEnabledRef = useRef(notifsEnabled);
  notifsEnabledRef.current = notifsEnabled;

  const toggleSounds = () => {
    const next = !soundsMuted;
    setSoundsMuted(next);
    localStorage.setItem('ilu_admin_sounds_muted', next ? '1' : '0');
  };
  const toggleNotifs = () => {
    const next = !notifsEnabled;
    setNotifsEnabled(next);
    localStorage.setItem('ilu_admin_notifs_enabled', next ? '1' : '0');
    if (next) requestNotifPermission();
  };

  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;

  const clientTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputThrottle = useRef<number>(0);
  const threadRef = useRef<HTMLDivElement>(null);

  // Set default active on first load
  useEffect(() => {
    if (!activeId && conversations.length > 0) {
      setActiveId(conversations[0].id);
    }
  }, [conversations, activeId]);

  // Request desktop notification permission once
  useEffect(() => {
    requestNotifPermission();
  }, []);

  // ── Cross-tab events: sounds + desktop notifs + typing ───────
  useEffect(() => {
    const unsub = subscribeEvents((e) => {
      if (e.type === 'notify_new_message' && e.sender === 'client') {
        if (!soundsMutedRef.current) playNewMessageSound();
        if (notifsEnabledRef.current) showDesktopNotif(`Nouveau message — ${e.clientName}`, e.content);
      }
      if (e.type === 'notify_new_order') {
        if (!soundsMutedRef.current) playNewOrderSound();
        if (notifsEnabledRef.current)
          showDesktopNotif(
            `Nouvelle commande — ${e.clientName}`,
            `${e.itemsLabel} • ${formatUSD(e.totalUSD)}`,
          );
      }
      if (
        e.type === 'typing' &&
        e.sender === 'client' &&
        e.convId === activeIdRef.current
      ) {
        setClientTyping(true);
        if (clientTypingTimer.current) clearTimeout(clientTypingTimer.current);
        clientTypingTimer.current = setTimeout(() => setClientTyping(false), 2500);
      }
    });
    return unsub;
  }, []);

  // ── Auto-scroll thread on new messages ──────────────────────
  const active = conversations.find((c) => c.id === activeId);
  const activeMessages = active?.messages ?? [];

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' });
  }, [activeMessages.length, clientTyping]);

  // ── Mark as read when switching conversation ─────────────────
  const handleSelectConv = (id: string) => {
    setActiveId(id);
    markConversationRead(id, 'admin');
  };

  // ── Admin sends a message ────────────────────────────────────
  const handleAdminSend = () => {
    const text = adminInput.trim();
    if (!text || !activeId) return;
    sendMessage(activeId, 'admin', text);
    setAdminInput('');
  };

  // ── Broadcast admin typing (throttled) ──────────────────────
  const handleAdminTyping = () => {
    if (!activeId) return;
    const now = Date.now();
    if (now - inputThrottle.current > 2000) {
      inputThrottle.current = now;
      broadcastTyping(activeId, 'admin');
    }
  };

  // ── Filtered list ────────────────────────────────────────────
  const filtered = useMemo(() => {
    return conversations
      .filter((o) => (filter === 'all' ? true : o.status === filter))
      .sort((a, b) => +new Date(b.lastMessageAt) - +new Date(a.lastMessageAt));
  }, [conversations, filter]);

  const unreadCount = conversations.filter((o) => o.unreadCount > 0).length;

  if (!currentAdmin) return null;

  return (
    <>
      <AdminTopBar
        title="Commandes & Chat"
        subtitle={`${unreadCount} conversation${unreadCount > 1 ? 's' : ''} non lue${unreadCount > 1 ? 's' : ''}`}
      />

      <div className="p-8">
        {/* ── Alert preferences ─────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <span className="font-display text-[10px] tracking-widest uppercase font-semibold text-muted">
            Alertes
          </span>
          <button
            type="button"
            onClick={toggleSounds}
            title={soundsMuted ? 'Réactiver les sons' : 'Couper les sons'}
            className={`flex items-center gap-1.5 text-[11px] font-display font-semibold tracking-widest uppercase px-3 py-1.5 rounded-full border transition-colors ${
              soundsMuted
                ? 'border-line text-muted hover:text-ink'
                : 'border-terra/40 bg-terra/10 text-terra hover:bg-terra/15'
            }`}
          >
            {soundsMuted ? '🔇' : '🔔'} {soundsMuted ? 'Sons désactivés' : 'Sons activés'}
          </button>
          <button
            type="button"
            onClick={toggleNotifs}
            title={notifsEnabled ? 'Désactiver les notifications bureau' : 'Activer les notifications bureau'}
            className={`flex items-center gap-1.5 text-[11px] font-display font-semibold tracking-widest uppercase px-3 py-1.5 rounded-full border transition-colors ${
              notifsEnabled
                ? 'border-terra/40 bg-terra/10 text-terra hover:bg-terra/15'
                : 'border-line text-muted hover:text-ink'
            }`}
          >
            💬 Notifs {notifsEnabled ? 'activées' : 'désactivées'}
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`font-display text-[11px] tracking-widest uppercase font-semibold px-3 py-1.5 rounded-full border transition-colors ${
              filter === 'all' ? 'bg-ink text-cream border-ink' : 'border-line text-muted hover:text-ink'
            }`}
          >
            Tous ({conversations.length})
          </button>
          {STATUSES.map((s) => {
            const count = conversations.filter((o) => o.status === s).length;
            if (count === 0) return null;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setFilter(s)}
                className={`font-display text-[11px] tracking-widest uppercase font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                  filter === s ? 'bg-ink text-cream border-ink' : 'border-line text-muted hover:text-ink'
                }`}
              >
                {STATUS_LABEL[s]} ({count})
              </button>
            );
          })}
        </div>

        <div className="grid lg:grid-cols-[380px_1fr] gap-0 bg-cream border border-line rounded-lg overflow-hidden min-h-[680px]">
          {/* ── Conversation list ───────────────────────────── */}
          <div className="border-r border-line divide-y divide-line max-h-[750px] overflow-y-auto">
            {filtered.length === 0 && (
              <div className="py-10 text-center text-muted text-sm">Aucune conversation.</div>
            )}
            {filtered.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => handleSelectConv(o.id)}
                className={`w-full text-left p-4 flex gap-3 hover:bg-bone transition-colors ${
                  activeId === o.id
                    ? 'bg-bone border-l-4 border-l-terra'
                    : 'border-l-4 border-l-transparent'
                }`}
              >
                <div className="w-11 h-11 rounded-full bg-terra text-cream flex items-center justify-center font-display font-bold text-sm shrink-0">
                  {o.clientName
                    .split(' ')
                    .map((s) => s[0])
                    .slice(0, 2)
                    .join('')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display font-semibold text-sm text-ink truncate">
                      {o.clientName}
                    </span>
                    <span className="text-[10px] text-muted shrink-0">
                      {new Date(o.lastMessageAt).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted truncate mt-0.5">{o.itemsLabel}</div>
                  <div className="text-xs text-ink-light truncate mt-1">{o.lastMessage}</div>
                  <div className="mt-2 flex items-center gap-2">
                    <span
                      className={`text-[9px] font-display font-bold tracking-widest uppercase px-2 py-0.5 rounded border ${STATUS_TONE[o.status]}`}
                    >
                      {STATUS_LABEL[o.status]}
                    </span>
                    <span className="font-display text-xs font-bold text-terra ml-auto">
                      {formatUSD(o.totalUSD)}
                    </span>
                    {o.unreadCount > 0 && (
                      <span className="bg-terra text-cream text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                        {o.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* ── Conversation detail ─────────────────────────── */}
          <div className="flex flex-col max-h-[750px]">
            {active ? (
              <>
                {/* Header */}
                <div className="border-b border-line p-5 flex items-start justify-between gap-4 flex-wrap shrink-0">
                  <div>
                    <h3 className="font-display font-bold text-lg">{active.clientName}</h3>
                    <p className="text-xs text-muted">{active.itemsLabel}</p>
                  </div>
                  <div className="text-right">
                    <div className="font-display font-extrabold text-2xl text-terra">
                      {formatUSD(active.totalUSD)}
                    </div>
                    <div className="text-[10px] text-gold font-semibold mt-0.5">
                      ≈ {formatCDF(active.totalUSD * exchangeRate)}
                    </div>
                  </div>
                </div>

                {/* Status + payment */}
                <div className="p-4 flex items-center gap-3 flex-wrap border-b border-line bg-bone shrink-0">
                  <span className="font-display text-[10px] tracking-widest uppercase font-semibold text-muted">
                    Statut
                  </span>
                  <select
                    value={active.status}
                    onChange={(e) =>
                      updateConversationStatus(active.id, e.target.value as OrderStatus)
                    }
                    className="bg-cream border border-line rounded-full px-4 py-1.5 text-xs font-medium outline-none cursor-pointer"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                  {active.paymentMethod && (
                    <span className="ml-auto text-xs text-muted">
                      💳 <strong className="text-ink">{active.paymentMethod}</strong>
                    </span>
                  )}
                </div>

                {/* Thread */}
                <div
                  ref={threadRef}
                  className="flex-1 overflow-y-auto px-5 py-4 bg-bone flex flex-col gap-3"
                >
                  {activeMessages.map((m) => (
                    <ThreadBubble key={m.id} msg={m} />
                  ))}
                  {clientTyping && (
                    <div className="self-start flex items-center gap-1 px-4 py-3 bg-cream rounded-2xl rounded-bl-sm border border-line">
                      <span
                        className="w-2 h-2 rounded-full bg-muted animate-bounce"
                        style={{ animationDelay: '0ms' }}
                      />
                      <span
                        className="w-2 h-2 rounded-full bg-muted animate-bounce"
                        style={{ animationDelay: '120ms' }}
                      />
                      <span
                        className="w-2 h-2 rounded-full bg-muted animate-bounce"
                        style={{ animationDelay: '240ms' }}
                      />
                    </div>
                  )}
                </div>

                {/* Input */}
                <div className="border-t border-line p-4 flex items-center gap-2 bg-cream shrink-0">
                  <input
                    type="text"
                    value={adminInput}
                    onChange={(e) => {
                      setAdminInput(e.target.value);
                      handleAdminTyping();
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleAdminSend()}
                    placeholder="Répondre au client…"
                    className="flex-1 bg-bone border border-line rounded-full px-4 py-2.5 text-sm outline-none focus:border-terra"
                  />
                  <button
                    type="button"
                    onClick={handleAdminSend}
                    disabled={!adminInput.trim()}
                    className="w-10 h-10 rounded-full bg-terra text-cream hover:bg-terra-dark disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors shrink-0"
                    aria-label="Envoyer"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="m4 4 16 8-16 8 3-8-3-8Z" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center flex-1 text-muted text-sm">
                Sélectionnez une conversation
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Bubble component for the admin thread view ───────────────
function ThreadBubble({ msg }: { msg: ChatMessageRecord }) {
  const isAdmin = msg.sender === 'admin';
  const isSystem = msg.sender === 'system';

  if (isSystem) {
    return (
      <div className="text-center">
        <span className="text-[10px] font-display tracking-widest uppercase text-muted bg-bone/80 border border-line px-3 py-1 rounded-full">
          {msg.content}
        </span>
      </div>
    );
  }

  const time = new Date(msg.createdAt).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={`flex flex-col max-w-[80%] ${isAdmin ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
      <div
        className={`rounded-2xl overflow-hidden text-sm leading-relaxed ${
          isAdmin
            ? 'bg-terra text-cream rounded-br-sm'
            : 'bg-cream text-ink rounded-bl-sm border border-line'
        }`}
      >
        {/* Media attachment */}
        {msg.mediaUrl && msg.mediaType === 'image' && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={msg.mediaUrl}
            alt="Photo"
            className="w-full max-w-[260px] object-cover block"
            style={{ maxHeight: 200 }}
          />
        )}
        {msg.mediaUrl && msg.mediaType === 'video' && (
          <video
            src={msg.mediaUrl}
            controls
            className="w-full max-w-[260px] block"
            style={{ maxHeight: 200 }}
          />
        )}
        {/* Text content */}
        {msg.content && !(msg.mediaUrl && (msg.content === '📷 Photo' || msg.content === '🎥 Vidéo')) && (
          <div className="px-4 py-2.5 whitespace-pre-line">{msg.content}</div>
        )}
      </div>
      <div className="text-[10px] text-muted mt-1 flex items-center gap-1.5">
        <span>{isAdmin ? 'Vous' : msg.sender === 'client' ? 'Client' : 'Système'}</span>
        <span>•</span>
        <span>{time}</span>
        {isAdmin && msg.readByClient && (
          <span className="text-terra" title="Lu par le client">
            ✓✓
          </span>
        )}
        {isAdmin && !msg.readByClient && (
          <span className="text-muted" title="Non lu">
            ✓
          </span>
        )}
      </div>
    </div>
  );
}
