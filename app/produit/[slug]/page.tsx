import { notFound } from 'next/navigation';
import { getProductBySlug, PRODUCTS } from '@/lib/products';
import { ProductDetail } from '@/components/ProductDetail';
import { RecommendedSection, RecentlyViewedSection } from '@/components/RecommendedSection';

export function generateStaticParams() {
  return PRODUCTS.map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const product = getProductBySlug(params.slug);
  if (!product) return { title: 'Produit introuvable — ILU SHOP' };
  return {
    title: `${product.name} — ILU SHOP`,
    description: product.shortDescription,
  };
}

export default function ProductPage({ params }: { params: { slug: string } }) {
  const product = getProductBySlug(params.slug);
  if (!product) notFound();

  return (
    <>
      <ProductDetail product={product} />
      <RecentlyViewedSection excludeId={product.id} />
      <RecommendedSection excludeId={product.id} />
    </>
  );
}
