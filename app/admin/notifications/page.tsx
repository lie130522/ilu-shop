'use client';

import { useState } from 'react';
import { useAdmin } from '@/components/admin/AdminProvider';
import { AdminTopBar } from '@/components/admin/AdminTopBar';
import type { NotificationType } from '@/lib/admin/types';

const TYPE_LABEL: Record<NotificationType, string> = {
  new_message: 'Message',
  new_order: 'Commande',
  new_client: 'Client',
  system: 'Système',
};

const TYPE_ICON: Record<NotificationType, string> = {
  new_message: '💬',
  new_order: '🛍️',
  new_client: '👤',
  system: '⚙',
};

export default function AdminNotificationsPage() {
  const { notifications, markNotificationRead, markAllNotificationsRead, currentAdmin } =
    useAdmin();
  const [filter, setFilter] = useState<'all' | NotificationType | 'unread'>('all');

  if (!currentAdmin) return null;

  const filtered = notifications.filter((n) => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !n.read;
    return n.type === filter;
  });

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <>
      <AdminTopBar
        title="Historique des notifications"
        subtitle={`${notifications.length} notifications • ${unread} non lue${unread > 1 ? 's' : ''}`}
      />

      <div className="p-8 max-w-4xl">
        {/* Note about phase 2 */}
        <div className="bg-cream border-l-4 border-l-terra border border-line rounded-md p-5 mb-6">
          <div className="font-display text-[10px] tracking-widest uppercase font-semibold text-terra">
            ◯ À venir en phase 2
          </div>
          <p className="mt-2 text-sm text-ink-light font-light">
            En mode mock, les notifications ne sont pas générées en temps réel. La phase 2 ajoutera
            les <strong>WebSocket + Web Notifications API + sons WhatsApp-style</strong> pour
            recevoir les alertes hors-onglet, comme spécifié dans le cahier.
          </p>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {(['all', 'unread', 'new_order', 'new_message', 'new_client', 'system'] as const).map(
              (f) => {
                const label =
                  f === 'all'
                    ? 'Tout'
                    : f === 'unread'
                      ? `Non lues (${unread})`
                      : TYPE_LABEL[f as NotificationType];
                const active = filter === f;
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFilter(f)}
                    className={`font-display text-[11px] tracking-widest uppercase font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                      active ? 'bg-ink text-cream border-ink' : 'border-line text-muted hover:text-ink'
                    }`}
                  >
                    {label}
                  </button>
                );
              },
            )}
          </div>

          {unread > 0 && (
            <button
              type="button"
              onClick={markAllNotificationsRead}
              className="font-display text-[10px] tracking-widest uppercase font-semibold text-terra hover:text-terra-dark underline"
            >
              ✓ Tout marquer comme lu
            </button>
          )}
        </div>

        {/* List */}
        <div className="bg-cream border border-line rounded-lg divide-y divide-line">
          {filtered.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => markNotificationRead(n.id)}
              className={`w-full text-left flex gap-4 p-5 hover:bg-bone transition-colors ${
                !n.read ? 'bg-terra/5' : ''
              }`}
            >
              <div
                className={`w-11 h-11 rounded-full flex items-center justify-center text-lg shrink-0 ${
                  n.type === 'new_order'
                    ? 'bg-terra text-cream'
                    : n.type === 'new_message'
                      ? 'bg-gold text-ink'
                      : n.type === 'new_client'
                        ? 'bg-beige text-ink'
                        : 'bg-bone text-muted'
                }`}
              >
                {TYPE_ICON[n.type]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-display font-bold text-sm text-ink">{n.title}</span>
                  <span className="text-[10px] font-display tracking-widest uppercase font-semibold bg-bone text-muted px-2 py-0.5 rounded border border-line">
                    {TYPE_LABEL[n.type]}
                  </span>
                </div>
                <div className="text-sm text-ink-light mt-1 font-light">{n.body}</div>
                <div className="text-[11px] text-muted mt-1">
                  {new Date(n.createdAt).toLocaleString('fr-FR', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
              {!n.read && <span className="w-2 h-2 rounded-full bg-terra shrink-0 mt-2" />}
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="py-12 text-center text-muted text-sm">Aucune notification.</div>
          )}
        </div>
      </div>
    </>
  );
}
