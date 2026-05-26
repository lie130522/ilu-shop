import { notFound } from 'next/navigation';
import { getProductBySlug, PRODUCTS } from '@/lib/products';
import { ProductDetail } from '@/components/ProductDetail';
import { RecommendedSection, RecentlyViewedSection } from '@/components/RecommendedSection';
import { FirestoreProductPage } from './FirestoreProductPage';

// Autoriser les slugs dynamiques au-delà de generateStaticParams
// (nécessaire pour les produits créés via l'admin et stockés dans Firestore)
export const dynamicParams = true;

export function generateStaticParams() {
  // Pré-génère uniquement les produits seed (lib/products.ts)
  // Les produits Firestore sont rendus dynamiquement côté client
  return PRODUCTS.map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const product = getProductBySlug(params.slug);
  if (!product) {
    // Peut être un produit Firestore — metadata générique (sans Firebase Admin SDK)
    return {
      title: 'Produit — ILU SHOP',
      description: 'Découvrez ce produit sur ILU SHOP.',
    };
  }
  return {
    title: `${product.name} — ILU SHOP`,
    description: product.shortDescription,
  };
}

export default function ProductPage({ params }: { params: { slug: string } }) {
  const product = getProductBySlug(params.slug);

  // Produit seed introuvable → peut être un produit Firestore admin
  // On délègue au client component qui lira Firestore
  if (!product) {
    return <FirestoreProductPage slug={params.slug} />;
  }

  // Produit seed : rendu statique complet
  return (
    <>
      <ProductDetail product={product} />
      <RecentlyViewedSection excludeId={product.id} />
      <RecommendedSection excludeId={product.id} />
    </>
  );
}
