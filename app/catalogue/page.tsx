import { Suspense } from 'react';
import CatalogueClient from './CatalogueClient';

export const metadata = {
  title: 'Catalogue — ILU SHOP',
  description: 'Mode & High-Tech. Filtrez par catégorie, prix, couleur, taille.',
};

export default function CataloguePage() {
  return (
    <Suspense fallback={<div className="py-32 text-center text-muted">Chargement…</div>}>
      <CatalogueClient />
    </Suspense>
  );
}
