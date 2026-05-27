'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useAdmin } from '@/components/admin/AdminProvider';
import {
  getAdminProducts,
  updateAdminProductStatus,
  deleteAdminProduct,
} from '@/lib/admin/product-store';
import {
  updateProductStatusInFirestore,
  deleteProductFromFirestore,
} from '@/lib/firebase/products';
import { AdminTopBar } from '@/components/admin/AdminTopBar';
import { formatUSD } from '@/lib/currency';
import { hasPermission, PermissionDenied } from '@/components/admin/PermissionGuard';

// À la une > Actifs > Inactifs
const STATUS_ORDER: Record<string, number> = { featured: 0, active: 1, inactive: 2 };

export default function AdminProductsPage() {
  const { products: seedProducts, toggleFeatured, toggleProductActive, currentAdmin } = useAdmin();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive' | 'featured'>('all');
  const [tick, setTick] = useState(0);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const refresh = () => setTick((t) => t + 1);

  if (!currentAdmin) return null;
  if (!hasPermission(currentAdmin, 'catalog')) return <PermissionDenied permission="catalog" />;

  const adminCreated = typeof window !== 'undefined' ? getAdminProducts() : [];
  const products = [
    ...adminCreated.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      shortDescription: p.shortDescription,
      description: p.description,
      priceUSD: p.priceUSD,
      oldPriceUSD: p.oldPriceUSD,
      category: p.category,
      subcategory: p.subcategory,
      tags: p.tags,
      stock: p.stock,
      status: p.status,
      sizes: p.sizes,
      colors: p.colors.map((c) => c.label),
      images: p.images.map((img) => img.processedDataUrl || img.originalDataUrl),
      rating: p.rating,
      reviewCount: p.reviewCount,
      isNew: true,
      isFeatured: p.status === 'featured',
      _isAdminCreated: true as const,
    })),
    ...seedProducts,
  ];

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const filtered = useMemo(() => {
    return products
      .filter((p) => {
        if (filter !== 'all') {
          if (filter === 'active' && p.status === 'inactive') return false;
          if (filter === 'inactive' && p.status !== 'inactive') return false;
          if (filter === 'featured' && p.status !== 'featured') return false;
        }
        if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99));
  }, [products, filter, search, tick]);

  const handleDelete = async (id: string) => {
    deleteAdminProduct(id);
    await deleteProductFromFirestore(id);
    setConfirmDeleteId(null);
    refresh();
  };

  return (
    <>
      <AdminTopBar
        title="Catalogue"
        subtitle={`${products.length} produits • ${products.filter((p) => p.status === 'featured').length} à la une${adminCreated.length > 0 ? ` • ${adminCreated.length} ajouté${adminCreated.length > 1 ? 's' : ''} par l'admin` : ''}`}
      />

      <div className="p-8">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <input
            type="text"
            placeholder="Rechercher un produit…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-cream border border-line rounded-full px-4 py-2 text-sm outline-none focus:border-terra w-72"
          />
          <div className="flex items-center gap-1 bg-cream border border-line rounded-full p-1">
            {(['all', 'active', 'featured', 'inactive'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`font-display text-[11px] tracking-widest uppercase font-semibold px-3 py-1.5 rounded-full transition-colors ${
                  filter === f ? 'bg-ink text-cream' : 'text-muted hover:text-ink'
                }`}
              >
                {f === 'all' ? 'Tous' : f === 'active' ? 'Actifs' : f === 'featured' ? 'À la une' : 'Inactifs'}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <Link
            href="/admin/produits/nouveau"
            className="font-display text-[11px] tracking-widest uppercase font-semibold bg-terra hover:bg-terra-dark text-cream px-5 py-2 rounded-full transition-colors inline-block"
          >
            + Ajouter un produit
          </Link>
        </div>

        {/* Table */}
        <div className="bg-cream border border-line rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-ink text-cream/80 text-left">
                <th className="px-5 py-3 font-display text-[10px] tracking-widest uppercase font-semibold">Produit</th>
                <th className="px-5 py-3 font-display text-[10px] tracking-widest uppercase font-semibold">Catégorie</th>
                <th className="px-5 py-3 font-display text-[10px] tracking-widest uppercase font-semibold text-right">Prix</th>
                <th className="px-5 py-3 font-display text-[10px] tracking-widest uppercase font-semibold text-right">Stock</th>
                <th className="px-5 py-3 font-display text-[10px] tracking-widest uppercase font-semibold">Statut</th>
                <th className="px-5 py-3 font-display text-[10px] tracking-widest uppercase font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((product) =>
                confirmDeleteId === product.id ? (
                  /* ── Confirmation de suppression ── */
                  <tr key={product.id} className="bg-terra/5 border-l-2 border-terra">
                    <td colSpan={6} className="px-5 py-4">
                      <div className="flex items-center gap-4 flex-wrap">
                        <span className="text-sm font-semibold text-terra">
                          Supprimer «{product.name}» ?
                        </span>
                        <span className="text-xs text-muted">Cette action est irréversible.</span>
                        <div className="flex gap-2 ml-auto">
                          <button
                            type="button"
                            onClick={() => handleDelete(product.id)}
                            className="px-4 py-1.5 bg-terra text-cream rounded-lg text-[10px] font-display font-bold tracking-widest uppercase hover:bg-terra-dark transition-colors"
                          >
                            Oui, supprimer
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-4 py-1.5 border border-line rounded-lg text-[10px] font-display font-semibold tracking-widest uppercase hover:bg-bone transition-colors"
                          >
                            Annuler
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  /* ── Ligne normale ── */
                  <tr key={product.id} className="hover:bg-bone transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={product.images[0]}
                          alt=""
                          className="w-12 h-12 rounded object-cover bg-bone flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <Link
                            href={`/produit/${product.slug}`}
                            target="_blank"
                            className="font-display font-semibold text-sm text-ink hover:text-terra block truncate"
                          >
                            {product.name}
                          </Link>
                          <div className="text-[11px] text-muted truncate max-w-[200px]">
                            {product.shortDescription}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm">
                      <div className="font-medium capitalize">{product.category}</div>
                      <div className="text-[11px] text-muted">{product.subcategory}</div>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="font-display font-bold text-sm text-terra">{formatUSD(product.priceUSD)}</div>
                      {product.oldPriceUSD && (
                        <div className="text-[11px] text-muted line-through">
                          {formatUSD(product.oldPriceUSD)}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span
                        className={`font-display font-bold text-sm ${
                          product.stock >= 9999 ? 'text-muted' : product.stock < 5 ? 'text-terra' : 'text-ink'
                        }`}
                      >
                        {product.stock >= 9999 ? '∞' : product.stock}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {product.status === 'featured' && (
                        <span className="text-[10px] font-display font-bold tracking-widest uppercase px-2 py-0.5 rounded bg-terra/15 text-terra-dark border border-terra/30">
                          À la une
                        </span>
                      )}
                      {product.status === 'active' && (
                        <span className="text-[10px] font-display font-bold tracking-widest uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Actif
                        </span>
                      )}
                      {product.status === 'inactive' && (
                        <span className="text-[10px] font-display font-bold tracking-widest uppercase px-2 py-0.5 rounded bg-beige text-muted border border-line">
                          Inactif
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1 justify-end flex-wrap">
                        {/* ─ Contrôles de statut ─ */}
                        <button
                          type="button"
                          onClick={() => {
                            const newStatus = product.status === 'featured' ? 'active' : 'featured';
                            if ((product as { _isAdminCreated?: boolean })._isAdminCreated) {
                              updateAdminProductStatus(product.id, newStatus);
                            } else {
                              toggleFeatured(product.id);
                            }
                            updateProductStatusInFirestore(product.id, newStatus);
                            refresh();
                          }}
                          disabled={product.status === 'inactive' || product.stock === 0}
                          title={
                            product.status === 'inactive' || product.stock === 0
                              ? 'Actif et en stock requis pour être à la une'
                              : product.status === 'featured'
                                ? 'Retirer de À la une'
                                : 'Mettre à la une'
                          }
                          className={`px-2.5 py-1.5 rounded text-[10px] font-display tracking-widest uppercase font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                            product.status === 'featured'
                              ? 'bg-terra text-cream hover:bg-terra-dark'
                              : 'bg-bone hover:bg-terra/20 text-terra-dark'
                          }`}
                        >
                          ★
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const newStatus = product.status === 'inactive' ? 'active' : 'inactive';
                            if ((product as { _isAdminCreated?: boolean })._isAdminCreated) {
                              updateAdminProductStatus(product.id, newStatus);
                            } else {
                              toggleProductActive(product.id);
                            }
                            updateProductStatusInFirestore(product.id, newStatus);
                            refresh();
                          }}
                          className="px-2.5 py-1.5 rounded text-[10px] font-display tracking-widest uppercase font-semibold bg-bone hover:bg-beige transition-colors"
                        >
                          {product.status === 'inactive' ? 'Activer' : 'Désactiver'}
                        </button>

                        {/* ─ Actions CRUD (produits admin uniquement) ─ */}
                        {(product as { _isAdminCreated?: boolean })._isAdminCreated && (
                          <>
                            <span className="w-px h-4 bg-line mx-0.5 shrink-0" />
                            <Link
                              href={`/admin/produits/${product.id}`}
                              className="px-2.5 py-1.5 rounded text-[10px] font-display tracking-widest uppercase font-semibold bg-bone hover:bg-beige transition-colors"
                              title="Voir les détails"
                            >
                              Voir
                            </Link>
                            <Link
                              href={`/admin/produits/${product.id}/modifier`}
                              className="px-2.5 py-1.5 rounded text-[10px] font-display tracking-widest uppercase font-semibold bg-bone hover:bg-beige transition-colors"
                              title="Modifier le produit"
                            >
                              Modifier
                            </Link>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(product.id)}
                              className="px-2.5 py-1.5 rounded text-[10px] font-display tracking-widest uppercase font-semibold text-terra hover:bg-terra/10 transition-colors"
                              title="Supprimer"
                            >
                              Supprimer
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-12 text-center text-muted text-sm">Aucun produit ne correspond.</div>
          )}
        </div>
      </div>
    </>
  );
}
