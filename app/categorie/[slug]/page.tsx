import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { PRODUCTS } from '@/lib/products';
import CatalogueClient from '@/app/catalogue/CatalogueClient';
import type { Category } from '@/lib/types';

// Mapping slug → infos d'affichage
const CATEGORY_META: Record<string, { label: string; description: string; category: Category; subcategory?: string }> = {
  // Mode
  'mode':        { label: 'Mode',              description: 'Vêtements, chaussures, bijoux, maroquinerie et parfums.',        category: 'mode' },
  'vetements':   { label: 'Vêtements',         description: 'T-shirts, pantalons, robes, vestes, pulls et plus encore.',      category: 'mode', subcategory: 'Vêtements' },
  'chaussures':  { label: 'Chaussures',        description: 'Sneakers, boots, sandales — adultes et enfants.',               category: 'mode', subcategory: 'Chaussures' },
  'bijoux':      { label: 'Bijoux',            description: 'Boucles d\'oreille, bracelets, colliers et bagues.',            category: 'mode', subcategory: 'Bijoux & accessoires classiques' },
  'maroquinerie':{ label: 'Maroquinerie',      description: 'Sacs à main, portefeuilles, ceintures et pochettes.',           category: 'mode', subcategory: 'Maroquinerie' },
  'parfums':     { label: 'Parfums & Beauté',  description: 'Eaux de parfum, eaux de toilette, extraits et brumes.',         category: 'mode', subcategory: 'Parfums & beauté' },
  // Technologie
  'technologie': { label: 'Technologie',       description: 'Smartphones, ordinateurs et accessoires tech.',                 category: 'technologie' },
  'telephonie':  { label: 'Téléphonie',        description: 'Smartphones, tablettes et téléphones basiques.',               category: 'technologie', subcategory: 'Téléphonie' },
  'informatique':{ label: 'Informatique',      description: 'Laptops, ultrabooks, PC de bureau et tablettes graphiques.',    category: 'technologie', subcategory: 'Informatique' },
  'accessoires-tech': { label: 'Accessoires tech', description: 'Chargeurs, câbles, coques, clés USB, claviers et écrans.', category: 'technologie', subcategory: 'Accessoires tech' },
  // Hybrides / Wearables
  'hybrides':    { label: 'Wearables',         description: 'Montres connectées, bracelets fitness et accessoires connectés.', category: 'hybrides' },
  'wearables':   { label: 'Wearables',         description: 'Smartwatches, bracelets de fitness, lunettes et casques audio.', category: 'hybrides', subcategory: 'Wearables / accessoires connectés' },
  // Services digitaux
  'services':    { label: 'Services digitaux', description: 'Abonnements Netflix, Spotify, Adobe et forfaits data Kinshasa.', category: 'services' },
  'abonnements': { label: 'Abonnements',       description: 'Netflix, Spotify, YouTube Premium, Microsoft 365, PlayStation.', category: 'services', subcategory: 'Abonnements plateformes' },
  'forfaits-data':{ label: 'Forfaits data',    description: 'Vodacom, Airtel, Africell, Orange — 1 Go à 20 Go.',             category: 'services', subcategory: 'Forfaits data' },
};

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const meta = CATEGORY_META[slug];
  if (!meta) return { title: 'Catégorie — ILU SHOP' };
  return {
    title: `${meta.label} — ILU SHOP`,
    description: meta.description,
  };
}

export async function generateStaticParams() {
  return Object.keys(CATEGORY_META).map((slug) => ({ slug }));
}

export default async function CategoriePage({ params }: Props) {
  const { slug } = await params;
  const meta = CATEGORY_META[slug];
  if (!meta) notFound();

  // Pre-filter products for this category
  const filteredProducts = PRODUCTS.filter((p) => {
    if (p.category !== meta.category) return false;
    if (meta.subcategory) {
      return p.subcategory.toLowerCase().includes(meta.subcategory.toLowerCase()) ||
        (meta.subcategory === 'femme' && (p.tags.some((t) => t.includes('femme') || t.includes('woman')))) ||
        (meta.subcategory === 'homme' && (p.tags.some((t) => t.includes('homme') || t.includes('man'))));
    }
    return true;
  });

  return (
    <div>
      {/* Category hero */}
      <div className="bg-ink text-cream px-6 lg:px-10 py-12 lg:py-16">
        <div className="max-w-7xl mx-auto">
          <nav className="font-display text-[11px] tracking-widest uppercase text-cream/50 flex items-center gap-2 mb-4">
            <a href="/" className="hover:text-cream transition-colors">Accueil</a>
            <span>/</span>
            <span className="text-cream">{meta.label}</span>
          </nav>
          <h1 className="font-display font-extrabold text-5xl lg:text-6xl leading-none text-cream">
            {meta.label}<span className="text-terra">.</span>
          </h1>
          <p className="mt-4 text-cream/60 font-light max-w-md">{meta.description}</p>
          <div className="mt-3 font-display text-xs tracking-widest uppercase text-cream/40">
            {filteredProducts.length} article{filteredProducts.length > 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Reuse catalogue client with pre-filtered products */}
      <Suspense fallback={<div className="p-10 text-center text-muted font-display text-sm">Chargement…</div>}>
        <CatalogueClient
          initialCategory={meta.category}
          initialSubcategory={meta.subcategory}
          hideHeader
        />
      </Suspense>
    </div>
  );
}
