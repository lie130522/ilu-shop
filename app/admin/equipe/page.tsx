'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ADMIN_MAX,
  isAdminError,
  useAdmin,
} from '@/components/admin/AdminProvider';
import { AdminTopBar } from '@/components/admin/AdminTopBar';
import {
  PERMISSION_LABEL,
  ROLE_LABEL,
  type AdminPermission,
  type Invitation,
} from '@/lib/admin/types';

const ALL_PERMISSIONS: AdminPermission[] = [
  'catalog',
  'orders',
  'editorial',
  'clients',
  'exchange_rate',
  'notifications',
];

export default function AdminTeamPage() {
  const {
    currentAdmin,
    admins,
    invitations,
    inviteAdmin,
    revokeInvitation,
    revokeAdmin,
    totalAdminSlots,
    canInvite,
  } = useAdmin();

  const [email, setEmail] = useState('');
  const [perms, setPerms] = useState<Set<AdminPermission>>(new Set(['catalog', 'orders']));
  const [error, setError] = useState<string | null>(null);
  const [lastInvitation, setLastInvitation] = useState<Invitation | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const pendingInvitations = useMemo(
    () => invitations.filter((i) => i.status === 'pending'),
    [invitations],
  );
  const usedInvitations = useMemo(
    () => invitations.filter((i) => i.status === 'accepted'),
    [invitations],
  );

  if (!currentAdmin) return null;

  // Only principal admin can access
  if (currentAdmin.role !== 'admin_principal') {
    return (
      <>
        <AdminTopBar title="Équipe" subtitle="Accès restreint" />
        <div className="p-8">
          <div className="bg-terra/10 border border-terra/30 rounded-lg p-8 text-center max-w-lg mx-auto">
            <div className="text-4xl">🔒</div>
            <h2 className="mt-4 font-display font-bold text-xl text-terra-dark">
              Accès admin principal uniquement
            </h2>
            <p className="mt-2 text-sm text-muted">
              Seul l'admin principal peut gérer les comptes administrateurs.
            </p>
            <Link
              href="/admin"
              className="inline-block mt-6 font-display text-xs tracking-widest uppercase font-semibold underline text-terra hover:text-terra-dark"
            >
              ← Retour au dashboard
            </Link>
          </div>
        </div>
      </>
    );
  }

  const togglePerm = (perm: AdminPermission) => {
    setPerms((prev) => {
      const next = new Set(prev);
      if (next.has(perm)) next.delete(perm);
      else next.add(perm);
      return next;
    });
  };

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLastInvitation(null);
    if (perms.size === 0) {
      setError('Sélectionnez au moins une permission.');
      return;
    }
    const result = inviteAdmin(email.trim(), Array.from(perms));
    if (isAdminError(result)) {
      setError(result.message);
      return;
    }
    setLastInvitation(result);
    setEmail('');
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const buildLink = (token: string) => `${baseUrl}/admin/invitation/${token}`;

  return (
    <>
      <AdminTopBar
        title="Gestion de l'équipe"
        subtitle={`${admins.length} admin${admins.length > 1 ? 's' : ''} actif${admins.length > 1 ? 's' : ''} • ${pendingInvitations.length} invitation${pendingInvitations.length > 1 ? 's' : ''} en attente`}
      />

      <div className="p-8 space-y-8 max-w-5xl">
        {/* Slot indicator — règle des 3 max */}
        <div
          className={`rounded-lg p-6 ${
            totalAdminSlots >= ADMIN_MAX
              ? 'bg-terra text-cream'
              : 'bg-cream border border-line'
          }`}
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div
                className={`font-display text-[10px] tracking-[0.3em] uppercase font-semibold ${
                  totalAdminSlots >= ADMIN_MAX ? 'text-cream/70' : 'text-terra'
                }`}
              >
                ◯ Règle absolue
              </div>
              <h2
                className={`mt-2 font-display font-bold text-2xl ${
                  totalAdminSlots >= ADMIN_MAX ? 'text-cream' : 'text-ink'
                }`}
              >
                Maximum 3 administrateurs
              </h2>
              <p
                className={`mt-1 text-sm font-light ${
                  totalAdminSlots >= ADMIN_MAX ? 'text-cream/70' : 'text-muted'
                }`}
              >
                {admins.length} actif{admins.length > 1 ? 's' : ''} + {pendingInvitations.length}{' '}
                invitation{pendingInvitations.length > 1 ? 's' : ''} en attente ={' '}
                <strong>{totalAdminSlots}/{ADMIN_MAX}</strong>
              </p>
            </div>

            {/* Visual slot meter */}
            <div className="flex items-center gap-2">
              {Array.from({ length: ADMIN_MAX }).map((_, i) => {
                const isAdminSlot = i < admins.length;
                const isPendingSlot = i < admins.length + pendingInvitations.length && !isAdminSlot;
                return (
                  <div
                    key={i}
                    className={`w-14 h-14 rounded-full flex items-center justify-center border-2 ${
                      isAdminSlot
                        ? totalAdminSlots >= ADMIN_MAX
                          ? 'bg-cream border-cream text-terra'
                          : 'bg-terra border-terra text-cream'
                        : isPendingSlot
                          ? totalAdminSlots >= ADMIN_MAX
                            ? 'border-cream border-dashed text-cream/80 bg-transparent'
                            : 'border-gold border-dashed text-gold bg-transparent'
                          : totalAdminSlots >= ADMIN_MAX
                            ? 'border-cream/30 text-cream/30 bg-transparent'
                            : 'border-line text-muted bg-cream'
                    }`}
                  >
                    <span className="font-display font-bold text-base">
                      {isAdminSlot ? '✓' : isPendingSlot ? '⏱' : '+'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr_400px] gap-8">
          {/* Left: admins list + pending invitations */}
          <div className="space-y-8">
            {/* Active admins */}
            <section>
              <h3 className="font-display font-bold text-lg mb-4">Admins actifs</h3>
              <div className="bg-cream border border-line rounded-lg divide-y divide-line overflow-hidden">
                {admins.map((admin) => (
                  <div key={admin.id} className="flex items-center gap-4 p-5">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center font-display font-bold text-sm shrink-0 ${
                        admin.role === 'admin_principal'
                          ? 'bg-gold text-ink'
                          : 'bg-terra text-cream'
                      }`}
                    >
                      {admin.fullName
                        .split(' ')
                        .map((s) => s[0])
                        .slice(0, 2)
                        .join('')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-display font-bold text-base text-ink truncate">
                          {admin.fullName}
                        </span>
                        <span
                          className={`font-display text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded ${
                            admin.role === 'admin_principal'
                              ? 'bg-gold/20 text-[#7A5A15]'
                              : 'bg-terra/15 text-terra-dark'
                          }`}
                        >
                          {ROLE_LABEL[admin.role]}
                        </span>
                      </div>
                      <div className="text-xs text-muted mt-1">{admin.email}</div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {admin.permissions.map((p) => (
                          <span
                            key={p}
                            className="text-[10px] bg-bone border border-line px-1.5 py-0.5 rounded text-ink-light"
                          >
                            {PERMISSION_LABEL[p]}
                          </span>
                        ))}
                      </div>
                    </div>
                    {admin.role === 'admin_secondary' && admin.id !== currentAdmin.id && (
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            confirm(
                              `Révoquer ${admin.fullName} ? Le compte sera supprimé et un slot libéré.`,
                            )
                          ) {
                            revokeAdmin(admin.id);
                          }
                        }}
                        className="font-display text-[10px] tracking-widest uppercase font-semibold text-terra hover:bg-terra/10 px-3 py-2 rounded transition-colors"
                      >
                        Révoquer
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Pending invitations */}
            {pendingInvitations.length > 0 && (
              <section>
                <h3 className="font-display font-bold text-lg mb-4">Invitations en attente</h3>
                <div className="space-y-3">
                  {pendingInvitations.map((inv) => {
                    const expired = new Date(inv.expiresAt).getTime() <= Date.now();
                    const expiresIn = Math.max(
                      0,
                      Math.floor((new Date(inv.expiresAt).getTime() - Date.now()) / 3600000),
                    );
                    const link = buildLink(inv.token);
                    return (
                      <div
                        key={inv.id}
                        className="bg-cream border border-line rounded-lg p-5"
                      >
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="min-w-0">
                            <div className="font-display font-bold text-sm text-ink">
                              {inv.email}
                            </div>
                            <div className="text-[11px] text-muted mt-0.5">
                              {expired ? (
                                <span className="text-terra">Expirée</span>
                              ) : (
                                <>⏱ Expire dans {expiresIn}h • Token : {inv.token.slice(0, 8)}…</>
                              )}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1">
                              {inv.permissions.map((p) => (
                                <span
                                  key={p}
                                  className="text-[10px] bg-bone border border-line px-1.5 py-0.5 rounded text-ink-light"
                                >
                                  {PERMISSION_LABEL[p]}
                                </span>
                              ))}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm('Révoquer cette invitation ?')) revokeInvitation(inv.id);
                            }}
                            className="font-display text-[10px] tracking-widest uppercase font-semibold text-terra hover:bg-terra/10 px-3 py-2 rounded transition-colors"
                          >
                            Révoquer
                          </button>
                        </div>

                        {/* Copyable invitation link */}
                        <div className="mt-4 flex items-center gap-2 bg-bone rounded px-3 py-2">
                          <code className="text-[11px] font-mono text-ink-light truncate flex-1">
                            {link}
                          </code>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(link, inv.id)}
                            className="font-display text-[10px] tracking-widest uppercase font-semibold text-terra hover:text-terra-dark whitespace-nowrap"
                          >
                            {copied === inv.id ? '✓ Copié' : 'Copier'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* History (used invitations) */}
            {usedInvitations.length > 0 && (
              <section>
                <h3 className="font-display font-bold text-lg mb-4">Historique des activations</h3>
                <div className="bg-cream border border-line rounded-lg divide-y divide-line">
                  {usedInvitations.map((inv) => (
                    <div key={inv.id} className="px-5 py-3 flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium">{inv.email}</span>
                        <span className="ml-3 text-[11px] text-muted">
                          Activé le{' '}
                          {inv.usedAt
                            ? new Date(inv.usedAt).toLocaleDateString('fr-FR', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })
                            : ''}
                        </span>
                      </div>
                      <span className="text-[10px] font-display font-bold tracking-widest uppercase text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                        Accepté
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Right: invite form */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="bg-cream border border-line rounded-lg p-6">
              <h3 className="font-display font-bold text-lg">Inviter un admin</h3>
              <p className="mt-1 text-xs text-muted font-light">
                L'invité recevra (en mode démo : l'URL s'affichera ci-dessous) un lien à usage unique
                valide 48h.
              </p>

              {!canInvite && (
                <div className="mt-4 bg-terra/10 border border-terra/30 rounded-md p-3 text-xs text-terra-dark">
                  <strong>Limite atteinte.</strong> Révoquez un admin ou une invitation pour libérer
                  un slot.
                </div>
              )}

              <form onSubmit={handleInvite} className="mt-5 space-y-4">
                <div>
                  <label className="font-display text-[10px] tracking-widest uppercase font-semibold text-ink block mb-2">
                    Email de l'invité
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={!canInvite}
                    placeholder="nouvel.admin@ilushop.cd"
                    className="w-full bg-bone border border-line rounded-md px-3 py-2.5 text-sm outline-none focus:border-terra transition-colors disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="font-display text-[10px] tracking-widest uppercase font-semibold text-ink block mb-2">
                    Permissions
                  </label>
                  <div className="space-y-1.5">
                    {ALL_PERMISSIONS.map((p) => (
                      <label
                        key={p}
                        className={`flex items-center gap-2.5 cursor-pointer ${!canInvite ? 'opacity-50' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={perms.has(p)}
                          onChange={() => togglePerm(p)}
                          disabled={!canInvite}
                          className="sr-only peer"
                        />
                        <span className="w-4 h-4 border border-line rounded-sm flex items-center justify-center peer-checked:bg-terra peer-checked:border-terra transition-colors">
                          {perms.has(p) && (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                              <path d="m5 12 5 5 9-12" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </span>
                        <span className="text-sm">{PERMISSION_LABEL[p]}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {error && (
                  <div className="bg-terra/10 border border-terra/30 text-terra-dark text-xs rounded-md px-3 py-2.5">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!canInvite}
                  className="w-full h-11 rounded-full bg-terra hover:bg-terra-dark text-cream font-display text-xs font-semibold tracking-[0.25em] uppercase transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Envoyer l'invitation
                </button>
              </form>

              {lastInvitation && (
                <div className="mt-5 bg-emerald-50 border border-emerald-200 rounded-md p-4">
                  <div className="font-display text-[10px] tracking-widest uppercase font-semibold text-emerald-700">
                    ✓ Invitation créée
                  </div>
                  <p className="text-xs text-emerald-800 mt-1 font-light">
                    En production, un email serait envoyé. En mode démo, copiez le lien ci-dessous :
                  </p>
                  <div className="mt-3 flex items-center gap-2 bg-cream border border-line rounded px-2 py-1.5">
                    <code className="text-[10px] font-mono truncate flex-1">
                      {buildLink(lastInvitation.token)}
                    </code>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(buildLink(lastInvitation.token), 'last')}
                      className="font-display text-[10px] tracking-widest uppercase font-semibold text-terra whitespace-nowrap"
                    >
                      {copied === 'last' ? '✓' : 'Copier'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
