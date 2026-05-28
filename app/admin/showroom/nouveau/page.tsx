'use client';

import Link from 'next/link';
import { useAdmin } from '@/components/admin/AdminProvider';
import { AdminTopBar } from '@/components/admin/AdminTopBar';
import { hasPermission, PermissionDenied } from '@/components/admin/PermissionGuard';
import { OutfitForm } from '../_components/OutfitForm';

export default function NouvelOutfitPage() {
  const { currentAdmin } = useAdmin();
  if (!currentAdmin) return null;
  if (!hasPermission(currentAdmin, 'showroom')) return <PermissionDenied permission="showroom" />;

  return (
    <>
      <AdminTopBar
        title="Nouvel outfit"
        subtitle="Créer un nouveau look pour le showroom"
      />
      <div className="px-8 pt-6">
        <Link
          href="/admin/showroom"
          className="inline-flex items-center gap-2 font-display text-[11px] tracking-widest uppercase font-semibold text-muted hover:text-ink transition-colors"
        >
          ← Retour au showroom
        </Link>
      </div>
      <OutfitForm />
    </>
  );
}
