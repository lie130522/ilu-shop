'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAdmin } from './AdminProvider';
import { AdminSidebar } from './AdminSidebar';

const PUBLIC_PREFIXES = ['/admin/invitation', '/admin/login'];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { ready, currentAdmin } = useAdmin();
  const path = usePathname() ?? '';
  const router = useRouter();

  const isPublic = PUBLIC_PREFIXES.some((p) => path.startsWith(p));

  useEffect(() => {
    if (!ready) return;
    if (!isPublic && !currentAdmin) {
      router.replace('/connexion');
    }
  }, [ready, currentAdmin, isPublic, router]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bone">
        <div className="font-display text-sm tracking-widest uppercase text-muted animate-pulse">
          Chargement…
        </div>
      </div>
    );
  }

  // Public routes: no sidebar, centered layout
  if (isPublic) {
    return <div className="min-h-screen bg-bone">{children}</div>;
  }

  if (!currentAdmin) {
    // Redirect in progress
    return (
      <div className="min-h-screen flex items-center justify-center bg-bone">
        <div className="font-display text-sm tracking-widest uppercase text-muted">
          Redirection…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-bone">
      <AdminSidebar />
      <div className="flex-1 min-w-0 flex flex-col">{children}</div>
    </div>
  );
}
