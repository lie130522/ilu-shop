import { notFound } from 'next/navigation';
import { PRODUCTS } from '@/lib/products';
import CatalogueClient from '@/app/catalogue/CatalogueClient';
import type { Category } from '@/lib/types';

// Mapping slug → infos d'affichage
const CATEGORY_META: Record<string, { label: string; description: string; category: Category; subcategory?: string }> = {
  // Mode principale
  'mode': { label: 'Mode', description: 'Toute notre sélection mode — vêtements, chaussures, accessoires.', category: 'mode' },
  'mode-femme': { label: 'Mode Femme', description: 'Robes, hauts, pantalons et accessoires pour femme.', category: 'mode', subcategory: 'femme' },
  'mode-homme': { label: 'Mode Homme', description: 'Chemises, vestes, pantalons et chaussures pour homme.', category: 'mode', subcategory: 'homme' },
  'mode-enfant': { label: 'Mode Enfant', description: 'Vêtements et chaussures pour enfants.', category: 'mode', subcategory: 'enfant' },
  'vestes-manteaux': { label: 'Vestes & Manteaux', description: 'Notre collection de vestes, blazers et manteaux.', category: 'mode', subcategory: 'Vestes & Manteaux' },
  'chaussures': { label: 'Chaussures', description: 'Sneakers, boots, sandales et plus encore.', category: 'mode', subcategory: 'Chaussures' },
  'accessoires': { label: 'Accessoires', description: 'Sacs, bijoux, ceintures et accessoires de mode.', category: 'mode', subcategory: 'Accessoires' },
  // High-tech
  'telephones': { label: 'Téléphones', description: 'Smartphones haut de gamme et accessoires.', category: 'telephones' },
  'ordinateurs': { label: 'Ordinateurs', description: 'Laptops, ultrabooks et accessoires informatiques.', category: 'ordinateurs' },
  'tablettes': { label: 'Tablettes', description: 'Tablettes et accessoires pour la productivité et le divertissement.', category: 'tablettes' },
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
      <CatalogueClient
        initialCategory={meta.category}
        initialSubcategory={meta.subcategory}
        hideHeader
      />
    </div>
  );
}
