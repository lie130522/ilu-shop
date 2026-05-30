'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAdmin } from '@/components/admin/AdminProvider';
import { AdminTopBar } from '@/components/admin/AdminTopBar';
import {
  subscribeCarousels,
  createCarousel,
  activateCarousel,
  deactivateCarousel,
  deleteCarousel,
  type Carousel,
} from '@/lib/firebase/carousel';

export default function CarouselListPage() {
  const { currentAdmin } = useAdmin();
  const [carousels, setCarousels] = useState<Carousel[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => subscribeCarousels(setCarousels), []);

  if (!currentAdmin) return null;

  const activeCount = carousels.filter((c) => c.actif).length;

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await createCarousel(newName, newDesc);
      setShowCreate(false);
      setNewName('');
      setNewDesc('');
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (carousel: Carousel) => {
    // Bloquer la désactivation si c'est le seul actif
    if (carousel.actif && activeCount <= 1) return;
    setToggling(carousel.id);
    try {
      if (carousel.actif) {
        await deactivateCarousel(carousel.id);
      } else {
        // Activer = désactiver tous les autres
        await activateCarousel(carousel.id, carousels);
      }
    } finally {
      setToggling(null);
    }
  };

  const handleDelete = async (carousel: Carousel) => {
    if (carousel.actif && activeCount <= 1) {
      alert('Impossible de supprimer le seul carousel actif. Activez un autre carousel d\'abord.');
      return;
    }
    if (!confirm(`Supprimer "${carousel.name}" définitivement ?`)) return;
    setDeleting(carousel.id);
    try {
      await deleteCarousel(carousel.id);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <>
      <AdminTopBar
        title="Carousels Hero"
        subtitle={`${carousels.length} carousel${carousels.length !== 1 ? 's' : ''} · ${activeCount} actif`}
      />

      <div className="p-6 max-w-3xl space-y-6">

        {/* Bouton créer */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-terra text-cream font-display text-[11px] tracking-widest uppercase font-bold hover:opacity-90 transition-opacity"
          >
            + Créer un carousel
          </button>
        </div>

        {/* Règle info */}
        <div className="bg-terra/5 border border-terra/20 rounded-xl px-4 py-3 text-sm text-ink">
          <span className="font-semibold">Règle :</span>{' '}
          un seul carousel est actif à la fois sur la page d&apos;accueil. Activer un carousel
          désactive automatiquement l&apos;autre. Il doit toujours y en avoir un actif.
        </div>

        {/* Liste vide */}
        {carousels.length === 0 && (
          <div className="py-20 text-center border-2 border-dashed border-line rounded-2xl">
            <div className="text-5xl mb-4">🎠</div>
            <p className="font-display font-semibold text-ink mb-2">Aucun carousel</p>
            <p className="text-sm text-muted mb-6">
              Créez votre premier carousel pour gérer les bannières de la page d&apos;accueil.
            </p>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-ink text-cream font-display text-[11px] tracking-widest uppercase font-bold hover:bg-terra transition-colors"
            >
              + Créer un carousel
            </button>
          </div>
        )}

        {/* Liste des carousels */}
        <div className="space-y-3">
          {carousels.map((carousel) => {
            const isOnlyActive = carousel.actif && activeCount <= 1;
            const isToggling = toggling === carousel.id;
            const isDeleting = deleting === carousel.id;

            return (
              <div
                key={carousel.id}
                className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                  carousel.actif
                    ? 'bg-cream border-terra/30 shadow-sm'
                    : 'bg-bone border-line opacity-70'
                }`}
              >
                {/* Indicateur actif */}
                <div
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    carousel.actif ? 'bg-emerald-500' : 'bg-line'
                  }`}
                />

                {/* Infos */}
                <div className="flex-1 min-w-0">
                  <div className="font-display font-bold text-sm text-ink">
                    {carousel.name}
                    {carousel.actif && (
                      <span className="ml-2 text-[9px] font-bold tracking-widest uppercase text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">
                        Actif
                      </span>
                    )}
                  </div>
                  {carousel.description && (
                    <div className="text-xs text-muted mt-0.5 truncate">{carousel.description}</div>
                  )}
                  <div className="text-[10px] text-muted/70 mt-1">
                    {carousel.productIds.length} produit{carousel.productIds.length !== 1 ? 's' : ''}
                  </div>
                </div>

                {/* Toggle actif/inactif */}
                <button
                  type="button"
                  onClick={() => handleToggle(carousel)}
                  disabled={isToggling || isOnlyActive}
                  title={
                    isOnlyActive
                      ? 'Impossible — dernier carousel actif'
                      : carousel.actif
                      ? 'Désactiver'
                      : 'Activer sur la page d\'accueil'
                  }
                  className={`shrink-0 relative w-12 h-6 rounded-full transition-colors duration-200 disabled:cursor-not-allowed ${
                    carousel.actif ? 'bg-emerald-500' : 'bg-line'
                  } ${isOnlyActive ? 'opacity-40' : ''}`}
                >
                  {isToggling ? (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    </span>
                  ) : (
                    <span
                      className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
                        carousel.actif ? 'translate-x-6' : 'translate-x-0.5'
                      }`}
                    />
                  )}
                </button>

                {/* Modifier */}
                <Link
                  href={`/admin/carousel/${carousel.id}`}
                  className="shrink-0 px-3 py-1.5 rounded-lg border border-line bg-cream hover:bg-bone font-display text-[10px] tracking-widest uppercase font-bold text-ink transition-colors"
                >
                  Modifier
                </Link>

                {/* Supprimer */}
                <button
                  type="button"
                  onClick={() => handleDelete(carousel)}
                  disabled={isDeleting || isOnlyActive}
                  title={isOnlyActive ? 'Impossible — dernier carousel actif' : 'Supprimer'}
                  className="shrink-0 w-8 h-8 rounded-full border border-line bg-bone hover:bg-terra hover:text-cream hover:border-terra text-muted flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {isDeleting ? (
                    <span className="w-3 h-3 border-2 border-current/40 border-t-current rounded-full animate-spin" />
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Modal création carousel ── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Fermer"
            onClick={() => { setShowCreate(false); setNewName(''); setNewDesc(''); }}
            className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
          />
          <div className="relative bg-cream rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="font-display font-bold text-lg mb-5">Nouveau carousel</h3>

            <div className="space-y-4">
              <div>
                <label className="block font-display text-[10px] tracking-widest uppercase text-muted font-semibold mb-1.5">
                  Nom du carousel *
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="ex: Carousel Été 2026"
                  autoFocus
                  className="w-full px-4 py-2.5 bg-bone border border-line rounded-xl text-sm outline-none focus:border-terra"
                />
              </div>
              <div>
                <label className="block font-display text-[10px] tracking-widest uppercase text-muted font-semibold mb-1.5">
                  Description (optionnel)
                </label>
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="ex: Sélection de pièces légères et colorées"
                  className="w-full px-4 py-2.5 bg-bone border border-line rounded-xl text-sm outline-none focus:border-terra"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => { setShowCreate(false); setNewName(''); setNewDesc(''); }}
                className="flex-1 py-2.5 rounded-xl border border-line text-muted font-display text-[11px] tracking-widest uppercase font-bold hover:bg-bone transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={!newName.trim() || creating}
                className="flex-1 py-2.5 rounded-xl bg-terra text-cream font-display text-[11px] tracking-widest uppercase font-bold hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {creating ? (
                  <><span className="w-3.5 h-3.5 border-2 border-cream/40 border-t-cream rounded-full animate-spin" /> Création…</>
                ) : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
