'use client';

import { usePathname } from 'next/navigation';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { ChatModal } from './ChatModal';

export function ShopChrome({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const isAdmin = path?.startsWith('/admin');

  if (isAdmin) return <>{children}</>;

  return (
    <>
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
      <ChatModal />
    </>
  );
}
