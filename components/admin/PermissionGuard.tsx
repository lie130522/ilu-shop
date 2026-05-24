'use client';

// ─── PermissionGuard — P09 ────────────────────────────────────────────────────
// Protège une page admin contre les accès sans permission.
// Usage A (wrapper) : <PermissionGuard permission="catalog">...</PermissionGuard>
// Usage B (inline)  : if (!hasPermission(currentAdmin, 'catalog')) return <PermissionDenied />;

import Link from 'next/link';
import { useAdmin } from './AdminProvider';
import type { Admin, AdminPermission } from '@/lib/admin/types';

// ── Helper (utilisable hors composant) ────────────────────────────────────────
export function hasPermission(
  admin: Admin | null,
  permission: AdminPermission | 'admin_principal',
): boolean {
  if (!admin) return false;
  if (admin.role === 'admin_principal') return true;
  if (permission === 'admin_principal') return false;
  return admin.permissions.includes(permission);
}

// ── Composant "accès refusé" réutilisable ─────────────────────────────────────
export function PermissionDenied({ permission }: { permission: string }) {
  return (
    <div className="p-8 flex items-center justify-center min-h-[60vh]">
      <div className="bg-terra/8 border border-terra/25 rounded-xl p-10 text-center max-w-md">
        <div className="text-5xl mb-4">🔒</div>
        <h2 className="font-display font-bold text-xl text-ink mb-2">Accès restreint</h2>
        <p className="text-sm text-muted font-light mb-6">
          Permission requise :{' '}
          <strong className="text-ink">{permission}</strong>. Contactez
          l&apos;admin principal.
        </p>
        <Link
          href="/admin"
          className="inline-block font-display text-xs tracking-widest uppercase font-semibold text-terra hover:text-terra-dark underline transition-colors"
        >
          ← Retour au dashboard
        </Link>
      </div>
    </div>
  );
}

interface Props {
  /** Permission requise, ou 'admin_principal' pour réserver aux principaux */
  permission: AdminPermission | 'admin_principal';
  children: React.ReactNode;
}

export function PermissionGuard({ permission, children }: Props) {
  const { currentAdmin, ready } = useAdmin();

  // Pas encore chargé — ne rien afficher pour éviter le flash
  if (!ready || !currentAdmin) return null;

  const allowed =
    permission === 'admin_principal'
      ? currentAdmin.role === 'admin_principal'
      : currentAdmin.role === 'admin_principal' ||
        currentAdmin.permissions.includes(permission);

  if (!allowed) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="bg-terra/8 border border-terra/25 rounded-xl p-10 text-center max-w-md">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="font-display font-bold text-xl text-ink mb-2">
            Accès restreint
          </h2>
          <p className="text-sm text-muted font-light mb-6">
            Vous n&apos;avez pas la permission <strong>{permission}</strong> pour
            accéder à cette section. Contactez l&apos;admin principal.
          </p>
          <Link
            href="/admin"
            className="inline-block font-display text-xs tracking-widest uppercase font-semibold text-terra hover:text-terra-dark underline transition-colors"
          >
            ← Retour au dashboard
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
