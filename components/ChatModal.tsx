'use client';

import { useEffect, useRef, useState } from 'react';
import { useSyncExternalStore } from 'react';
import { useShop } from './ShopProvider';
import { PRODUCTS } from '@/lib/products';
import { formatCDF, formatUSD, usdToCdf } from '@/lib/currency';
import type { ChatMessageRecord } from '@/lib/admin/types';
import { uploadChatFile } from '@/lib/firebase/settings';
import {
  subscribe,
  getConversations,
  findOrCreateConversation,
  sendMessage,
  markConversationRead,
  broadcastTyping,
  subscribeEvents,
  getOrCreateSessionId,
} from '@/lib/chat/store';

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

// Stable server snapshot — must be module-level to avoid re-creating on every render
const EMPTY_CONVERSATIONS: ReturnType<typeof getConversations> = [];

export function ChatModal() {
  const { chatOpen, closeChat, cart } = useShop();

  const [convId, setConvId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [adminTyping, setAdminTyping] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const bodyRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputThrottle = useRef<number>(0);

  // Live messages from the cross-tab store
  const conversations = useSyncExternalStore(subscribe, getConversations, () => EMPTY_CONVERSATIONS);
  const conv = convId ? conversations.find((c) => c.id === convId) : null;
  const messages = (conv?.messages ?? []).filter((m) => m.sender !== 'system');

  // ── Listen for admin typing events ──────────────────────────
  useEffect(() => {
    const unsub = subscribeEvents((e) => {
      if (e.type === 'typing' && e.convId === convId && e.sender === 'admin') {
        setAdminTyping(true);
        if (typingTimer.current) clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setAdminTyping(false), 2500);
      }
    });
    return unsub;
  }, [convId]);

  // ── On open: find or create conversation ────────────────────
  useEffect(() => {
    if (!chatOpen) {
      setConvId(null);
      setAdminTyping(false);
      setInput('');
      return;
    }

    const sessionId = getOrCreateSessionId();

    // Build cart summary strings
    const cartLines = cart
      .map((item) => {
        const p = PRODUCTS.find((x) => x.id === item.productId);
        if (!p) return null;
        const variant = [item.size, item.color].filter(Boolean).join(' / ');
        return `${p.name}${variant ? ` (${variant})` : ''} × ${item.quantity} — ${formatUSD(p.priceUSD)}`;
      })
      .filter(Boolean) as string[];

    const totalUSD = cart.reduce((sum, item) => {
      const p = PRODUCTS.find((x) => x.id === item.productId);
      return sum + (p ? p.priceUSD * item.quantity : 0);
    }, 0);

    const cartSummary = cartLines.length
      ? cartLines.join('\n') + `\nTotal : ${formatUSD(totalUSD)}`
      : 'Panier vide';

    const itemsLabel = cartLines.length
      ? cart
          .slice(0, 2)
          .map((item) => PRODUCTS.find((x) => x.id === item.productId)?.name ?? '')
          .filter(Boolean)
          .join(' + ') + (cart.length > 2 ? ` +${cart.length - 2}` : '')
      : 'Aucun article';

    // Try to find an existing open conversation for this session
    const existing = getConversations().find(
      (c) => c.clientId === sessionId && c.status !== 'closed',
    );

    if (existing) {
      setConvId(existing.id);
      markConversationRead(existing.id, 'client');
    } else {
      // Create a new conversation and send a simulated admin greeting
      const cid = findOrCreateConversation(sessionId, {
        clientName: 'Visiteur',
        cartSummary,
        itemsLabel,
        totalUSD,
      }).id;
      setConvId(cid);

      // Show typing indicator then greeting
      setTimeout(() => broadcastTyping(cid, 'admin'), 500);
      setTimeout(() => {
        const greeting =
          cartLines.length > 0
            ? `Bonjour ! 👋 Merci pour votre intérêt.\n\nVotre panier :\n${cartLines.join('\n')}\n\nTotal : ${formatUSD(totalUSD)} / ≈ ${formatCDF(usdToCdf(totalUSD))}\n\nComment souhaitez-vous payer (Mobile Money, virement, cash) et où livrer ?`
            : `Bonjour ! 👋 Bienvenue chez ILU SHOP. Comment pouvons-nous vous aider ?`;
        sendMessage(cid, 'admin', greeting);
      }, 1400);
    }
  }, [chatOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mark read when new admin messages arrive ─────────────────
  useEffect(() => {
    if (chatOpen && convId) {
      const hasUnread = (conv?.messages ?? []).some(
        (m) => m.sender !== 'client' && !m.readByClient,
      );
      if (hasUnread) markConversationRead(convId, 'client');
    }
  }, [messages.length, chatOpen, convId, conv?.messages]);

  // ── Auto-scroll ──────────────────────────────────────────────
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, adminTyping, uploadProgress]);

  // ── Send text message ─────────────────────────────────────────
  const handleSend = () => {
    const text = input.trim();
    if (!text || !convId) return;
    sendMessage(convId, 'client', text);
    setInput('');

    // Simulate admin reply (mock mode)
    const cid = convId;
    setTimeout(() => broadcastTyping(cid, 'admin'), 700);
    const replies = [
      'Parfait ! On accepte M-Pesa, Airtel Money et Orange Money. Pour Kinshasa, livraison sous 24h à 5 000 FC. Ça vous convient ?',
      'Très bien, je note. Pouvez-vous me confirmer votre adresse exacte ?',
      "Merci ! Je vous envoie le numéro M-Pesa pour le paiement dans un instant. Vous préférez le matin ou l'après-midi pour la livraison ?",
      'Reçu ! Je confirme votre commande et vous tiens informé du suivi. 🛍️',
    ];
    setTimeout(() => {
      sendMessage(cid, 'admin', replies[Math.floor(Math.random() * replies.length)]);
    }, 1900);
  };

  // ── Handle file selection ─────────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !convId) return;

    // Reset input value so the same file can be re-selected
    e.target.value = '';

    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');

    if (!isImage && !isVideo) return;

    // Validate video duration ≤ 30s
    if (isVideo) {
      const valid = await checkVideoDuration(file);
      if (!valid) {
        alert('La vidéo ne doit pas dépasser 30 secondes.');
        return;
      }
    }

    setUploading(true);
    setUploadProgress(0);

    const cid = convId;
    try {
      const url = await uploadChatFile(cid, file, ({ percent }) => {
        setUploadProgress(percent);
      });
      sendMessage(cid, 'client', isVideo ? '🎥 Vidéo' : '📷 Photo', {
        mediaUrl: url,
        mediaType: isVideo ? 'video' : 'image',
      });
    } catch {
      alert("Erreur lors de l'envoi du fichier. Réessaie.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // ── Broadcast client typing (throttled) ──────────────────────
  const handleTyping = () => {
    if (!convId) return;
    const now = Date.now();
    if (now - inputThrottle.current > 2000) {
      inputThrottle.current = now;
      broadcastTyping(convId, 'client');
    }
  };

  if (!chatOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:justify-end p-0 md:p-6">
      {/* Backdrop */}
      <button
        type="button"
        onClick={closeChat}
        aria-label="Fermer"
        className="absolute inset-0 bg-ink/40 backdrop-blur-[2px] animate-fadeUp"
      />

      {/* Modal */}
      <div className="relative w-full md:w-[420px] h-[80vh] md:h-[640px] bg-cream rounded-t-2xl md:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-fadeUp">
        {/* Header */}
        <div className="bg-terra px-5 py-4 flex items-center gap-3 text-cream">
          <div className="w-10 h-10 rounded-full bg-cream/20 flex items-center justify-center text-xl">
            🛍️
          </div>
          <div className="flex-1">
            <div className="font-display font-semibold text-sm">ILU SHOP — Service Commande</div>
            <div className="flex items-center gap-1.5 text-[11px] text-cream/80">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              En ligne — répond en quelques minutes
            </div>
          </div>
          <button
            type="button"
            onClick={closeChat}
            aria-label="Fermer"
            className="w-8 h-8 rounded-full hover:bg-cream/10 flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div ref={bodyRef} className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-3 bg-bone">
          {messages.map((m) => (
            <Bubble key={m.id} msg={m} />
          ))}
          {/* Upload progress bubble */}
          {uploading && (
            <div className="self-end max-w-[85%]">
              <div className="bg-terra/80 text-cream px-4 py-3 rounded-2xl rounded-br-sm text-sm">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-3 h-3 border-2 border-cream/40 border-t-cream rounded-full animate-spin" />
                  <span className="text-xs">Envoi en cours…</span>
                </div>
                <div className="w-full h-1.5 bg-cream/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cream rounded-full transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <div className="text-right text-[10px] text-cream/70 mt-1">{uploadProgress}%</div>
              </div>
            </div>
          )}
          {adminTyping && (
            <div className="self-start flex items-center gap-1 px-4 py-3 bg-cream rounded-2xl rounded-bl-sm">
              <span className="w-2 h-2 rounded-full bg-terra animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 rounded-full bg-terra animate-bounce" style={{ animationDelay: '120ms' }} />
              <span className="w-2 h-2 rounded-full bg-terra animate-bounce" style={{ animationDelay: '240ms' }} />
            </div>
          )}
        </div>

        {/* Quick replies */}
        <div className="px-4 py-3 border-t border-line bg-cream flex flex-wrap gap-2">
          {['M-Pesa', 'Airtel Money', 'Cash à la livraison', 'Livraison Gombe', 'Retrait boutique'].map(
            (q) => (
              <button
                key={q}
                type="button"
                onClick={() => setInput(q)}
                className="text-[11px] font-medium px-3 py-1.5 rounded-full bg-beige hover:bg-terra hover:text-cream transition-colors"
              >
                {q}
              </button>
            ),
          )}
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-line bg-cream flex items-center gap-2">
          {/* File upload button */}
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            title="Envoyer une photo ou vidéo (max 30s)"
            className="w-9 h-9 rounded-full bg-bone border border-line hover:border-terra hover:bg-terra/5 flex items-center justify-center transition-colors disabled:opacity-40 shrink-0"
            aria-label="Envoyer un fichier"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-muted">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.41 17.41a2 2 0 0 1-2.83-2.83l8.49-8.48" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={handleFileChange}
          />

          <input
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              handleTyping();
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Écrire un message…"
            className="flex-1 px-4 py-2.5 rounded-full bg-bone border border-line text-sm outline-none focus:border-terra"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || uploading}
            className="w-10 h-10 rounded-full bg-terra text-cream hover:bg-terra-dark disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
            aria-label="Envoyer"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m4 4 16 8-16 8 3-8-3-8Z" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Video duration check ──────────────────────────────────────
function checkVideoDuration(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    const url = URL.createObjectURL(file);
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(video.duration <= 30);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(false);
    };
    video.src = url;
  });
}

// ── Message bubble ────────────────────────────────────────────
function Bubble({ msg }: { msg: ChatMessageRecord }) {
  const isClient = msg.sender === 'client';
  return (
    <div className={`max-w-[85%] ${isClient ? 'self-end' : 'self-start'}`}>
      <div
        className={`rounded-2xl overflow-hidden text-sm leading-relaxed ${
          isClient
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
        {/* Text content (hide generic label if media present) */}
        {msg.content && !(msg.mediaUrl && (msg.content === '📷 Photo' || msg.content === '🎥 Vidéo')) && (
          <div className="px-4 py-2.5 whitespace-pre-line">{msg.content}</div>
        )}
      </div>
      <div className={`text-[10px] text-muted mt-1 ${isClient ? 'text-right' : 'text-left'}`}>
        {isClient ? 'Vous' : 'ILU SHOP'} • {fmtTime(msg.createdAt)}
      </div>
    </div>
  );
}
