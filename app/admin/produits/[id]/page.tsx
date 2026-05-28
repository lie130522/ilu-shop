'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAdmin } from '@/components/admin/AdminProvider';
import { AdminTopBar } from '@/components/admin/AdminTopBar';
import {
  getAdminProducts,
  updateAdminProductStatus,
  deleteAdminProduct,
  type StoredProduct,
} from '@/lib/admin/product-store';
import {
  updateProductStatusInFirestore,
  deleteProductFromFirestore,
  getProductByIdFirestore,
} from '@/lib/firebase/products';
import { formatUSD } from '@/lib/currency';
import type { Product } from '@/lib/types';
import type { ProductCategory } from '@/lib/admin/product-store';

// ── Conversion Product (Firestore) → StoredProduct (affichage admin) ──────────
function firestoreProductToStoredProduct(p: Product): StoredProduct {
  const now = new Date().toISOString();
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    category: p.category as ProductCategory,
    subcategory: p.subcategory ?? '',
    priceUSD: p.priceUSD,
    oldPriceUSD: p.oldPriceUSD,
    shortDescription: p.shortDescription ?? '',
    description: p.description ?? '',
    stock: p.stock ?? 0,
    tags: p.tags ?? [],
    sizes: p.sizes ?? [],
    colors: (p.colors ?? []).map((c) => ({ label: c.name ?? '', hex: c.hex ?? '' })),
    images: (p.images ?? []).map((url, i) => ({
      id: `img-${i}`,
      originalDataUrl: url,
      processedDataUrl: url,
      hasTransparentBg: false,
      pipelineStatus: 'done' as const,
      width: 0,
      height: 0,
      sizeBytes: 0,
    })),
    videos: [],
    colorImages: {},
    brand: p.brand,
    material: p.material,
    ram: p.ram,
    connectivity: p.connectivity,
    genre: p.genre,
    modele: p.modele,
    platform: p.platform,
    deliveryMode: p.deliveryMode,
    rdcAvailability: p.rdcAvailability,
    descriptionTone: p.descriptionTone,
    status: p.status,
    badge: p.badge === 'featured' ? undefined : p.badge,
    rating: p.rating ?? 0,
    reviewCount: p.reviewCount ?? 0,
    createdAt: (p as unknown as { createdAt?: string }).createdAt ?? now,
    updatedAt: now,
  };
}

export default function AdminProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { currentAdmin } = useAdmin();

  const [product, setProduct] = useState<StoredProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [imgIdx, setImgIdx] = useState(0);

  useEffect(() => {
    const local = getAdminProducts().find((p) => p.id === id) ?? null;
    if (local) {
      setProduct(local);
      setLoading(false);
      return;
    }
    // Fallback : produit créé depuis un autre navigateur (Firestore uniquement)
    getProductByIdFirestore(id).then((fp) => {
      setProduct(fp ? firestoreProductToStoredProduct(fp) : null);
      setLoading(false);
    });
  }, [id]);

  if (!currentAdmin) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted font-display text-sm tracking-widest uppercase">
        Chargement…
      </div>
    );
  }

  if (!product) {
    return (
      <div className="p-8">
        <p className="text-muted mb-4">Produit introuvable (id : {id}).</p>
        <Link href="/admin/produits" className="text-terra hover:underline text-sm">
          ← Retour au catalogue
        </Link>
      </div>
    );
  }

  const displayImage = product.images[imgIdx] ?? product.images[0];

  const handleStatusToggle = async (type: 'featured' | 'active') => {
    let newStatus: StoredProduct['status'];
    if (type === 'featured') {
      newStatus = product.status === 'featured' ? 'active' : 'featured';
    } else {
      newStatus = product.status === 'inactive' ? 'active' : 'inactive';
    }
    updateAdminProductStatus(product.id, newStatus);
    await updateProductStatusInFirestore(product.id, newStatus);
    setProduct((prev) => (prev ? { ...prev, status: newStatus } : null));
  };

  const handleDelete = async () => {
    setDeleting(true);
    deleteAdminProduct(product.id);
    await deleteProductFromFirestore(product.id);
    router.push('/admin/produits');
  };

  return (
    <>
      <AdminTopBar
        title={product.name}
        subtitle={`${product.category} • ${product.subcategory}`}
      />

      <div className="p-8 max-w-5xl">
        {/* Back */}
        <Link
          href="/admin/produits"
          className="inline-flex items-center gap-2 font-display text-[11px] tracking-widest uppercase font-semibold text-muted hover:text-ink transition-colors mb-8"
        >
          ← Retour au catalogue
        </Link>

        <div className="grid lg:grid-cols-[1fr_380px] gap-10">
          {/* ── Images ─────────────────────────────────────────────────── */}
          <div>
            {/* Image principale */}
            <div
              className="aspect-square rounded-2xl overflow-hidden bg-bone border border-line mb-4"
              style={
                displayImage?.hasTransparentBg
                  ? { backgroundImage: 'repeating-conic-gradient(#ddd 0% 25%, white 0% 50%)', backgroundSize: '16px 16px' }
                  : {}
              }
            >
              {displayImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={displayImage.processedDataUrl || displayImage.originalDataUrl}
                  alt={product.name}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-6xl text-beige">
                  📦
                </div>
              )}
            </div>

            {/* Miniatures */}
            {product.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {product.images.map((img, i) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setImgIdx(i)}
                    className={`w-16 h-16 rounded-lg overflow-hidden shrink-0 border-2 transition-colors ${
                      imgIdx === i ? 'border-terra' : 'border-line hover:border-terra/50'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.processedDataUrl || img.originalDataUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}

            {product.images.length === 0 && (
              <p className="text-center text-sm text-muted mt-2">Aucune image</p>
            )}
          </div>

          {/* ── Infos + Actions ─────────────────────────────────────────── */}
          <div className="space-y-5">
            {/* Badges de statut */}
            <div className="flex flex-wrap gap-2">
              {product.status === 'featured' && (
                <span className="text-[10px] font-display font-bold tracking-widest uppercase px-3 py-1 rounded-full bg-terra/15 text-terra-dark border border-terra/30">
                  ★ À la une
                </span>
              )}
              {product.status === 'active' && (
                <span className="text-[10px] font-display font-bold tracking-widest uppercase px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  ✓ Actif
                </span>
              )}
              {product.status === 'inactive' && (
                <span className="text-[10px] font-display font-bold tracking-widest uppercase px-3 py-1 rounded-full bg-beige text-muted border border-line">
                  ○ Inactif
                </span>
              )}
              {product.badge && (
                <span className={`text-[10px] font-display font-bold tracking-widest uppercase px-3 py-1 rounded-full border ${
                  product.badge === 'new'
                    ? 'bg-terra text-cream border-terra'
                    : product.badge === 'sale'
                      ? 'bg-gold/20 text-[#7A5A15] border-gold/40'
                      : 'bg-ink text-cream border-ink'
                }`}>
                  {product.badge === 'new' ? '✦ Nouveau' : product.badge === 'sale' ? '% Promo' : '🔥 Tendance'}
                </span>
              )}
            </div>

            {/* Nom + prix */}
            <div>
              <h1 className="font-display font-extrabold text-2xl text-ink leading-tight">
                {product.name}
              </h1>
              {product.shortDescription && (
                <p className="text-muted text-sm mt-1">{product.shortDescription}</p>
              )}
              <div className="flex items-baseline gap-3 mt-3">
                <span className="font-display font-extrabold text-3xl text-terra">
                  {formatUSD(product.priceUSD)}
                </span>
                {product.oldPriceUSD && (
                  <span className="text-muted line-through text-lg">
                    {formatUSD(product.oldPriceUSD)}
                  </span>
                )}
              </div>
            </div>

            {/* Infos rapides */}
            <div className="grid grid-cols-2 gap-3">
              <InfoCard label="Catégorie" value={`${product.category} / ${product.subcategory}`} />
              <InfoCard
                label="Stock"
                value={`${product.stock} unité${product.stock > 1 ? 's' : ''}`}
                highlight={product.stock < 5}
              />
              <InfoCard
                label="Note"
                value={`${product.rating}/5 — ${product.reviewCount} avis`}
              />
              <InfoCard
                label="Créé le"
                value={new Date(product.createdAt).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              />
            </div>

            {/* Tailles */}
            {product.sizes.length > 0 && (
              <div>
                <p className="font-display text-[11px] tracking-widest uppercase font-semibold text-muted mb-2">
                  Tailles
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {product.sizes.map((s) => (
                    <span key={s} className="px-3 py-1 rounded border border-line text-xs font-medium bg-bone">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Couleurs */}
            {product.colors.length > 0 && (
              <div>
                <p className="font-display text-[11px] tracking-widest uppercase font-semibold text-muted mb-2">
                  Couleurs
                </p>
                <div className="flex flex-wrap gap-2">
                  {product.colors.map((c) => (
                    <span
                      key={c.hex}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-line text-xs bg-bone"
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-line/50"
                        style={{ backgroundColor: c.hex }}
                      />
                      {c.label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Tags */}
            {product.tags.length > 0 && (
              <div>
                <p className="font-display text-[11px] tracking-widest uppercase font-semibold text-muted mb-2">
                  Tags
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {product.tags.map((t) => (
                    <span key={t} className="px-2.5 py-1 rounded-full bg-beige text-xs text-muted">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Infos additionnelles */}
            {(product.genre || product.brand || product.material || product.modele ||
              (product.ram && product.ram.length > 0) ||
              (product.connectivity && product.connectivity.length > 0) ||
              product.platform || product.deliveryMode || product.rdcAvailability) && (
              <div>
                <p className="font-display text-[11px] tracking-widest uppercase font-semibold text-muted mb-2">
                  Infos additionnelles
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {product.genre && (
                    <InfoCard label="Genre" value={{ femme: 'Femme', homme: 'Homme', mixte: 'Mixte', enfant: 'Enfant' }[product.genre] ?? product.genre} />
                  )}
                  {product.brand && <InfoCard label="Marque" value={product.brand} />}
                  {product.material && <InfoCard label="Matière" value={product.material} />}
                  {product.modele && <InfoCard label="Modèle" value={product.modele} />}
                  {product.ram && product.ram.length > 0 && (
                    <InfoCard label="RAM" value={product.ram.join(' / ')} />
                  )}
                  {product.connectivity && product.connectivity.length > 0 && (
                    <InfoCard label="Connectivité" value={product.connectivity.join(', ')} />
                  )}
                  {product.platform && <InfoCard label="Plateforme" value={product.platform} />}
                  {product.deliveryMode && (
                    <InfoCard label="Livraison digitale" value={{
                      activation_code: 'Code d\'activation',
                      configured_account: 'Compte configuré',
                      direct_recharge: 'Rechargement direct',
                    }[product.deliveryMode] ?? product.deliveryMode} />
                  )}
                  {product.rdcAvailability && (
                    <InfoCard label="Dispo RDC" value={{
                      confirmed: '✓ Confirmée',
                      to_verify: '⚠ À vérifier',
                      limited: '⚡ Limitée',
                    }[product.rdcAvailability] ?? product.rdcAvailability} />
                  )}
                </div>
              </div>
            )}

            {/* ── Boutons d'action ─ */}
            <div className="flex flex-col gap-2.5 pt-4 border-t border-line">
              <Link
                href={`/admin/produits/${product.id}/modifier`}
                className="w-full py-3 bg-ink text-cream font-display font-bold text-xs tracking-widest uppercase rounded-xl hover:bg-terra transition-colors text-center"
              >
                ✏ Modifier ce produit
              </Link>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleStatusToggle('featured')}
                  disabled={product.status === 'inactive' || product.stock === 0}
                  className="py-2.5 rounded-xl border border-line text-xs font-display font-semibold tracking-widest uppercase hover:bg-bone transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {product.status === 'featured' ? '★ Retirer' : '★ À la une'}
                </button>
                <button
                  type="button"
                  onClick={() => handleStatusToggle('active')}
                  className="py-2.5 rounded-xl border border-line text-xs font-display font-semibold tracking-widest uppercase hover:bg-bone transition-colors"
                >
                  {product.status === 'inactive' ? 'Activer' : 'Désactiver'}
                </button>
              </div>

              <Link
                href={`/produit/${product.slug}`}
                target="_blank"
                className="w-full py-2.5 rounded-xl border border-line text-xs font-display font-semibold tracking-widest uppercase hover:bg-bone transition-colors text-center"
              >
                👁 Voir sur le site
              </Link>

              {/* Suppression */}
              {!confirmDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="w-full py-2.5 rounded-xl border border-terra/30 text-terra text-xs font-display font-semibold tracking-widest uppercase hover:bg-terra/5 transition-colors"
                >
                  🗑 Supprimer ce produit
                </button>
              ) : (
                <div className="p-4 bg-terra/5 border border-terra/30 rounded-xl">
                  <p className="text-sm font-semibold text-terra mb-1 text-center">
                    Supprimer ce produit ?
                  </p>
                  <p className="text-[11px] text-muted text-center mb-4">
                    Il sera retiré du catalogue et de Firestore. Irréversible.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleting}
                      className="flex-1 py-2.5 bg-terra text-cream rounded-xl text-xs font-display font-bold tracking-widest uppercase hover:bg-terra-dark disabled:opacity-60 transition-colors"
                    >
                      {deleting ? 'Suppression…' : 'Oui, supprimer'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="flex-1 py-2.5 border border-line rounded-xl text-xs font-display font-semibold tracking-widest uppercase hover:bg-bone transition-colors"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Description complète */}
        {product.description && (
          <div className="mt-10 p-6 bg-cream border border-line rounded-xl">
            <h2 className="font-display font-bold text-lg mb-4 border-b border-line pb-3">
              Description complète
            </h2>
            <p className="text-sm text-ink-light leading-relaxed whitespace-pre-line">
              {product.description}
            </p>
          </div>
        )}
      </div>
    </>
  );
}

function InfoCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="p-3 bg-bone rounded-lg border border-line">
      <p className="font-display text-[10px] tracking-widest uppercase font-semibold text-muted">
        {label}
      </p>
      <p className={`text-sm font-semibold mt-1 ${highlight ? 'text-terra' : 'text-ink'}`}>
        {value}
      </p>
    </div>
  );
}
