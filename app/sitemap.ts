// ─── ILU SHOP — Sitemap dynamique ───────────────────────────────────────────
// Inclut les pages statiques + toutes les pages produit publiées.

import type { MetadataRoute } from 'next';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';

const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, '') ?? 'https://ilushop.cd';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // ── Pages statiques ───────────────────────────────────────────────────────
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL,                              lastModified: new Date(), changeFrequency: 'daily',   priority: 1.0 },
    { url: `${BASE_URL}/catalogue`,               lastModified: new Date(), changeFrequency: 'daily',   priority: 0.9 },
    { url: `${BASE_URL}/catalogue?cat=mode`,       lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${BASE_URL}/catalogue?cat=technologie`,lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${BASE_URL}/catalogue?cat=hybrides`,   lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${BASE_URL}/catalogue?cat=services`,   lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${BASE_URL}/a-propos`,                lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/connexion`,               lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE_URL}/inscription`,             lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
  ];

  // ── Pages produit dynamiques ──────────────────────────────────────────────
  try {
    const snap = await getDocs(
      query(collection(db, 'products'), where('status', '!=', 'archived')),
    );

    const productRoutes: MetadataRoute.Sitemap = snap.docs
      .map((d) => {
        const data = d.data() as { slug?: string; status?: string; updatedAt?: { toDate?: () => Date } };
        if (!data.slug) return null;
        return {
          url: `${BASE_URL}/produit/${data.slug}`,
          lastModified: data.updatedAt?.toDate?.() ?? new Date(),
          changeFrequency: 'weekly' as const,
          priority: data.status === 'featured' ? 0.9 : 0.7,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    return [...staticRoutes, ...productRoutes];
  } catch {
    // Fallback : pages statiques uniquement si Firestore inaccessible
    return staticRoutes;
  }
}
