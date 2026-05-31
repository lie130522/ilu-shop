'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AdminTopBar } from '@/components/admin/AdminTopBar';
import { useAdmin } from '@/components/admin/AdminProvider';
import { hasPermission, PermissionDenied } from '@/components/admin/PermissionGuard';
import { BulkFileImport } from './_components/BulkFileImport';
import {
  subscribeImportSources,
  createImportSource,
  deleteImportSource,
  type ImportSource,
} from '@/lib/firebase/import-sources';

interface ScrapeResult {
  title: string;
  description: string;
  images: string[];
  price: string;
  currency: string;
  url: string;
  siteName: string;
}

export default function ImportsPage() {
  const { currentAdmin } = useAdmin();
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScrapeResult | null>(null);
  const [selectedImages, setSelectedImages] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState<'files' | 'scrape' | 'sources'>('files');

  // ── Sources Firestore ────────────────────────────────────────────────────────
  const [sources, setSources] = useState<ImportSource[]>([]);
  const [showAddSource, setShowAddSource] = useState(false);
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceUrl, setNewSourceUrl] = useState('');
  const [addingSource, setAddingSource] = useState(false);
  const [deletingSource, setDeletingSource] = useState<string | null>(null);

  useEffect(() => subscribeImportSources(setSources), []);

  const handleAddSource = async () => {
    if (!newSourceName.trim() || !newSourceUrl.trim()) return;
    setAddingSource(true);
    try {
      await createImportSource(newSourceName, newSourceUrl);
      setShowAddSource(false);
      setNewSourceName('');
      setNewSourceUrl('');
    } finally {
      setAddingSource(false);
    }
  };

  const handleDeleteSource = async (source: ImportSource) => {
    if (!confirm(`Supprimer "${source.name}" définitivement ?`)) return;
    setDeletingSource(source.id);
    try {
      await deleteImportSource(source.id);
    } finally {
      setDeletingSource(null);
    }
  };

  if (!currentAdmin) return null;
  if (!hasPermission(currentAdmin, 'catalog')) return <PermissionDenied permission="catalog" />;

  const handleScrape = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setSelectedImages(new Set());
    try {
      const res = await fetch('/api/admin/imports/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json() as ScrapeResult & { error?: string };
      if (!res.ok || data.error) {
        setError(data.error ?? 'Erreur lors du scraping.');
        return;
      }
      setResult(data);
      // Select first image by default
      if (data.images.length > 0) setSelectedImages(new Set([0]));
    } catch {
      setError('Impossible de contacter le serveur.');
    } finally {
      setLoading(false);
    }
  };

  const toggleImage = (idx: number) => {
    setSelectedImages((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleImport = () => {
    if (!result) return;
    // Pre-fill the new product form via URL params
    const params = new URLSearchParams({
      name: result.title,
      description: result.description,
      price: result.price,
      currency: result.currency,
      source: result.url,
      images: [...selectedImages].map((i) => result.images[i]).join(','),
    });
    router.push(`/admin/produits/nouveau?${params.toString()}`);
  };

  return (
    <>
      <AdminTopBar
        title="Imports"
        subtitle="Scraping d'URLs sources et import manuel"
      />

      <div className="p-6 lg:p-8 max-w-5xl">
        {/* Tabs */}
        <div className="flex gap-1 bg-bone rounded-lg p-1 mb-8 w-fit">
          {([
            { key: 'files',   label: '📁 Depuis des fichiers' },
            { key: 'scrape',  label: '🔍 Scraper une URL' },
            { key: 'sources', label: '📋 Sources enregistrées' },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`px-5 py-2 rounded-md font-display text-xs font-semibold tracking-widest uppercase transition-colors ${
                activeTab === key ? 'bg-cream shadow-sm text-ink' : 'text-muted hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Fichiers tab ── */}
        {activeTab === 'files' && (
          <div className="space-y-4">
            <div className="bg-cream border border-line rounded-xl p-6">
              <h2 className="font-display font-bold text-base text-ink mb-2">
                Import depuis des fichiers locaux
              </h2>
              <p className="text-sm text-muted font-light mb-6 leading-relaxed">
                Dépose tes images directement depuis ton ordinateur.{' '}
                <strong className="text-ink">Gemini analyse chaque article automatiquement</strong>{' '}
                (nom, catégorie, description, prix suggéré). Tu peux tout corriger avant d'importer.
              </p>
              <BulkFileImport />
            </div>
          </div>
        )}

        {/* ── Scraper tab ── */}
        {activeTab === 'scrape' && (
          <div className="space-y-6">
            <div className="bg-cream border border-line rounded-xl p-6">
              <h2 className="font-display font-bold text-base text-ink mb-4">
                Importer depuis une URL
              </h2>
              <p className="text-sm text-muted font-light mb-5 leading-relaxed">
                Colle l&apos;URL d&apos;une fiche produit (Zalando, Jumia, Amazon, boutique partenaire…). Le système extrait automatiquement le titre, la description, les images et le prix.
              </p>

              <div className="flex gap-3">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleScrape()}
                  placeholder="https://www.exemple.com/produit/veste-cargo"
                  className="flex-1 bg-bone border border-line rounded-md px-4 py-3 text-sm outline-none focus:border-terra transition-colors font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={handleScrape}
                  disabled={loading || !url.trim()}
                  className="h-12 px-6 rounded-full bg-ink hover:bg-terra text-cream font-display text-xs font-semibold tracking-widest uppercase transition-colors disabled:opacity-50 flex items-center gap-2 shrink-0"
                >
                  {loading ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-cream/40 border-t-cream rounded-full animate-spin" />
                      Scraping…
                    </>
                  ) : '🔍 Analyser'}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-terra/10 border border-terra/30 text-terra-dark text-sm rounded-xl px-5 py-4">
                {error}
              </div>
            )}

            {result && (
              <div className="bg-cream border border-line rounded-xl p-6 space-y-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-emerald-500 text-lg">✓</span>
                  <span className="font-display font-semibold text-sm text-ink">
                    Données extraites depuis <span className="text-terra">{result.siteName}</span>
                  </span>
                </div>

                {/* Title */}
                <div>
                  <label className="font-display text-[11px] tracking-widest uppercase font-semibold text-muted block mb-1">
                    Titre détecté
                  </label>
                  <div className="bg-bone rounded-md px-4 py-3 text-sm text-ink">{result.title || '—'}</div>
                </div>

                {/* Description */}
                {result.description && (
                  <div>
                    <label className="font-display text-[11px] tracking-widest uppercase font-semibold text-muted block mb-1">
                      Description
                    </label>
                    <div className="bg-bone rounded-md px-4 py-3 text-sm text-ink font-light leading-relaxed line-clamp-4">
                      {result.description}
                    </div>
                  </div>
                )}

                {/* Price */}
                {result.price && (
                  <div>
                    <label className="font-display text-[11px] tracking-widest uppercase font-semibold text-muted block mb-1">
                      Prix détecté
                    </label>
                    <div className="bg-bone rounded-md px-4 py-3 text-sm font-display font-bold text-terra">
                      {result.currency === 'USD' ? '$' : result.currency === 'EUR' ? '€' : ''}{result.price} {result.currency}
                    </div>
                  </div>
                )}

                {/* Images */}
                {result.images.length > 0 && (
                  <div>
                    <label className="font-display text-[11px] tracking-widest uppercase font-semibold text-muted block mb-3">
                      Images détectées — Sélectionne celles à importer
                    </label>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                      {result.images.map((img, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => toggleImage(idx)}
                          className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                            selectedImages.has(idx)
                              ? 'border-terra shadow-sm scale-105'
                              : 'border-line hover:border-terra/40'
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={img}
                            alt={`Image ${idx + 1}`}
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                          {selectedImages.has(idx) && (
                            <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-terra flex items-center justify-center text-cream text-xs font-bold">
                              ✓
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-muted">{selectedImages.size} image{selectedImages.size > 1 ? 's' : ''} sélectionnée{selectedImages.size > 1 ? 's' : ''}</p>
                  </div>
                )}

                {/* Import CTA */}
                <div className="flex gap-3 pt-2 border-t border-line">
                  <button
                    type="button"
                    onClick={handleImport}
                    disabled={!result.title}
                    className="h-11 px-8 rounded-full bg-terra hover:bg-terra-light hover:text-ink text-cream font-display text-xs font-semibold tracking-widest uppercase transition-colors disabled:opacity-50"
                  >
                    → Créer le produit
                  </button>
                  <button
                    type="button"
                    onClick={() => { setResult(null); setUrl(''); }}
                    className="h-11 px-5 rounded-full border border-line bg-bone hover:bg-beige font-display text-xs font-semibold tracking-widest uppercase transition-colors text-muted"
                  >
                    Réinitialiser
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Sources tab ── */}
        {activeTab === 'sources' && (
          <div className="space-y-4">
            <div className="bg-cream border border-line rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display font-bold text-sm text-ink">Sources enregistrées</h2>
                <button
                  type="button"
                  onClick={() => setShowAddSource(true)}
                  className="h-9 px-4 rounded-full bg-terra text-cream font-display text-[10px] font-bold tracking-widest uppercase hover:opacity-90 transition-opacity"
                >
                  + Ajouter
                </button>
              </div>
              <p className="text-sm text-muted font-light mb-5">
                Gère les sites fournisseurs ou partenaires depuis lesquels tu importes régulièrement des produits.
              </p>

              {sources.length === 0 ? (
                <div className="py-10 text-center border-2 border-dashed border-line rounded-xl">
                  <p className="text-muted text-sm mb-3">Aucune source enregistrée.</p>
                  <button
                    type="button"
                    onClick={() => setShowAddSource(true)}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-ink text-cream font-display text-[10px] font-bold tracking-widest uppercase hover:bg-terra transition-colors"
                  >
                    + Ajouter une source
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {sources.map((source) => (
                    <div key={source.id} className="flex items-center gap-4 p-4 bg-bone rounded-lg">
                      <div className="flex-1 min-w-0">
                        <div className="font-display font-semibold text-sm text-ink">{source.name}</div>
                        <div className="text-xs text-muted font-mono truncate">{source.url}</div>
                        <div className="text-xs text-muted mt-1">
                          {source.lastRun
                            ? `Dernier import : ${new Date(source.lastRun).toLocaleDateString('fr-FR')} · ${source.productsImported} produit${source.productsImported !== 1 ? 's' : ''}`
                            : 'Jamais importé'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => { setUrl(source.url); setActiveTab('scrape'); }}
                          className="h-8 px-3 rounded-full border border-line bg-cream hover:bg-bone font-display text-[10px] font-semibold tracking-widest uppercase transition-colors"
                        >
                          Scraper →
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSource(source)}
                          disabled={deletingSource === source.id}
                          className="w-8 h-8 rounded-full border border-line bg-bone hover:bg-terra hover:text-cream hover:border-terra text-muted flex items-center justify-center transition-colors disabled:opacity-40"
                        >
                          {deletingSource === source.id ? (
                            <span className="w-3 h-3 border-2 border-current/40 border-t-current rounded-full animate-spin" />
                          ) : (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Modal ajout source ── */}
        {showAddSource && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <button
              type="button"
              aria-label="Fermer"
              onClick={() => { setShowAddSource(false); setNewSourceName(''); setNewSourceUrl(''); }}
              className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
            />
            <div className="relative bg-cream rounded-2xl shadow-2xl w-full max-w-md p-6">
              <h3 className="font-display font-bold text-lg mb-5">Nouvelle source</h3>
              <div className="space-y-4">
                <div>
                  <label className="block font-display text-[10px] tracking-widest uppercase text-muted font-semibold mb-1.5">
                    Nom *
                  </label>
                  <input
                    type="text"
                    value={newSourceName}
                    onChange={(e) => setNewSourceName(e.target.value)}
                    placeholder="ex: Zalando France"
                    autoFocus
                    className="w-full px-4 py-2.5 bg-bone border border-line rounded-xl text-sm outline-none focus:border-terra"
                  />
                </div>
                <div>
                  <label className="block font-display text-[10px] tracking-widest uppercase text-muted font-semibold mb-1.5">
                    URL du site *
                  </label>
                  <input
                    type="url"
                    value={newSourceUrl}
                    onChange={(e) => setNewSourceUrl(e.target.value)}
                    placeholder="https://www.zalando.fr"
                    className="w-full px-4 py-2.5 bg-bone border border-line rounded-xl text-sm font-mono outline-none focus:border-terra"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => { setShowAddSource(false); setNewSourceName(''); setNewSourceUrl(''); }}
                  className="flex-1 py-2.5 rounded-xl border border-line text-muted font-display text-[11px] tracking-widest uppercase font-bold hover:bg-bone transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleAddSource}
                  disabled={!newSourceName.trim() || !newSourceUrl.trim() || addingSource}
                  className="flex-1 py-2.5 rounded-xl bg-terra text-cream font-display text-[11px] tracking-widest uppercase font-bold hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {addingSource ? (
                    <><span className="w-3.5 h-3.5 border-2 border-cream/40 border-t-cream rounded-full animate-spin" /> Ajout…</>
                  ) : 'Ajouter'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
