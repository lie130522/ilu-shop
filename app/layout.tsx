import type { Metadata } from 'next';
import { Syne, DM_Sans } from 'next/font/google';
import './globals.css';
import { ShopProvider } from '@/components/ShopProvider';
import { ShopChrome } from '@/components/ShopChrome';

const syne = Syne({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-syne',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-dm-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ILU SHOP — Mode & High-Tech',
  description:
    "ILU SHOP — I Love You Shop. Mode, chaussures, accessoires et high-tech. Sélection éditoriale, bi-devise USD/CDF.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${syne.variable} ${dmSans.variable}`}>
      <body className="font-sans bg-cream text-ink min-h-screen flex flex-col">
        <ShopProvider>
          <ShopChrome>{children}</ShopChrome>
        </ShopProvider>
      </body>
    </html>
  );
}
