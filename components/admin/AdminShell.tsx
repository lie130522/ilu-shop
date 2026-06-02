'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAdmin } from './AdminProvider';
import { AdminSidebar } from './AdminSidebar';
import { SidebarContext } from './SidebarContext';

const PUBLIC_PREFIXES = ['/admin/invitation', '/admin/login'];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { ready, currentAdmin } = useAdmin();
  const path = usePathname() ?? '';
  const router = useRouter();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isPublic = PUBLIC_PREFIXES.some((p) => path.startsWith(p));

  // Fermer la sidebar automatiquement quand on change de page
  useEffect(() => {
    setSidebarOpen(false);
  }, [path]);

  // Bloquer le scroll body quand la sidebar overlay est ouverte sur mobile
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  useEffect(() => {
    if (!ready) return;
    if (!isPublic && !currentAdmin) {
      router.replace(`/admin/login?redirect=${encodeURIComponent(path)}`);
    }
  }, [ready, currentAdmin, isPublic, path, router]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bone">
        <div className="font-display text-sm tracking-widest uppercase text-muted animate-pulse">
          Chargement…
        </div>
      </div>
    );
  }

  // Routes publiques : pas de sidebar
  if (isPublic) {
    return (
      <SidebarContext.Provider value={{ open: false, setOpen: () => {} }}>
        <div className="min-h-screen bg-bone">{children}</div>
      </SidebarContext.Provider>
    );
  }

  if (!currentAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bone">
        <div className="font-display text-sm tracking-widest uppercase text-muted">
          Redirection…
        </div>
      </div>
    );
  }

  return (
    <SidebarContext.Provider value={{ open: sidebarOpen, setOpen: setSidebarOpen }}>
      <div className="min-h-screen flex bg-bone">

        {/* ── Backdrop mobile : fond semi-transparent derrière la sidebar ── */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-ink/60 backdrop-blur-[2px] z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* ── Sidebar ── */}
        <AdminSidebar />

        {/* ── Contenu principal — pleine largeur sur mobile ── */}
        <div className="flex-1 min-w-0 flex flex-col">{children}</div>

      </div>
    </SidebarContext.Provider>
  );
}
