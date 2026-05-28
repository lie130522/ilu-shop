'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAdmin } from '@/components/admin/AdminProvider';
import { AdminTopBar } from '@/components/admin/AdminTopBar';
import { hasPermission, PermissionDenied } from '@/components/admin/PermissionGuard';
import { getOutfitByIdFirestore } from '@/lib/firebase/outfits';
import { OutfitForm } from '../../_components/OutfitForm';
import type { Outfit } from '@/lib/showroom/types';

export default function ModifierOutfitPage() {
  const { id } = useParams<{ id: string }>();
  const { currentAdmin } = useAdmin();
  const [outfit, setOutfit] = useState<Outfit | null | undefined>(undefined); // undefined = chargement

  useEffect(() => {
    getOutfitByIdFirestore(id).then(setOutfit);
  }, [id]);

  if (!currentAdmin) return null;
  if (!hasPermission(currentAdmin, 'showroom')) return <PermissionDenied permission="showroom" />;

  if (outfit === undefined) {
    return (
      <div className="flex items-center justify-center h-64 text-muted font-display text-sm tracking-widest uppercase">
        Chargement…
      </div>
    );
  }

  if (outfit === null) {
    return (
      <div className="p-8">
        <p className="text-muted mb-4">Outfit introuvable (id : {id}).</p>
        <Link href="/admin/showroom" className="text-terra hover:underline text-sm">
          ← Retour au showroom
        </Link>
      </div>
    );
  }

  return (
    <>
      <AdminTopBar
        title={`Modifier — ${outfit.name}`}
        subtitle="Modifier les informations de l'outfit"
      />
      <div className="px-8 pt-6">
        <Link
          href="/admin/showroom"
          className="inline-flex items-center gap-2 font-display text-[11px] tracking-widest uppercase font-semibold text-muted hover:text-ink transition-colors"
        >
          ← Retour au showroom
        </Link>
      </div>
      <OutfitForm initialOutfit={outfit} />
    </>
  );
}
