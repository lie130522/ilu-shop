'use client';

import { usePathname } from 'next/navigation';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { ChatModal } from './ChatModal';

export function ShopChrome({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const isAdmin = path?.startsWith('/admin');
  // Pages full-screen sans Navbar/Footer (auth pages)
  const isAuthPage = path === '/connexion';

  if (isAdmin || isAuthPage) return <>{children}</>;

  return (
    <>
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
      <ChatModal />
    </>
  );
}
