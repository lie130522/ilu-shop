import { notFound } from 'next/navigation';
import { getProductBySlug, getRelatedProducts, PRODUCTS } from '@/lib/products';
import { ProductDetail } from '@/components/ProductDetail';
import { ProductCard } from '@/components/ProductCard';

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
  const related = getRelatedProducts(product, 4);

  return (
    <>
      <ProductDetail product={product} />

      {/* Related */}
      {related.length > 0 && (
        <section className="py-24 bg-bone">
          <div className="max-w-7xl mx-auto px-6 lg:px-10">
            <div className="flex items-end justify-between mb-12">
              <div>
                <span className="font-display text-[10px] tracking-[0.35em] uppercase text-terra font-semibold">
                  — Vous aimerez aussi
                </span>
                <h2 className="mt-3 font-display font-bold text-3xl md:text-4xl text-ink">
                  Pièces associées
                </h2>
              </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-12">
              {related.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
