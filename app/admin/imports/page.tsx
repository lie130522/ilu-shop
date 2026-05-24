'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminTopBar } from '@/components/admin/AdminTopBar';
import { useAdmin } from '@/components/admin/AdminProvider';

interface ScrapeResult {
  title: string;
  description: string;
  images: string[];
  price: string;
  currency: string;
  url: string;
  siteName: string;
}

interface ImportSource {
  id: string;
  url: string;
  name: string;
  lastRun: string;
  status: 'idle' | 'running' | 'done' | 'error';
  productsImported: number;
}

// Mock import history (localStorage in real app)
const MOCK_SOURCES: ImportSource[] = [
  { id: 's1', url: 'https://zalando.fr', name: 'Zalando FR', lastRun: '2026-05-24T09:00:00Z', status: 'done', productsImported: 12 },
  { id: 's2', url: 'https://jumia.cd', name: 'Jumia RDC', lastRun: '2026-05-23T14:30:00Z', status: 'idle', productsImported: 5 },
];

export default function ImportsPage() {
  const { currentAdmin } = useAdmin();
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScrapeResult | null>(null);
  const [selectedImages, setSelectedImages] = useState<Set<number>>(new Set());
  const [sources] = useState<ImportSource[]>(MOCK_SOURCES);
  const [activeTab, setActiveTab] = useState<'scrape' | 'sources'>('scrape');

  if (!currentAdmin) return null;

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
          {(['scrape', 'sources'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setActiveTab(t)}
              className={`px-5 py-2 rounded-md font-display text-xs font-semibold tracking-widest uppercase transition-colors ${
                activeTab === t ? 'bg-cream shadow-sm text-ink' : 'text-muted hover:text-ink'
              }`}
            >
              {t === 'scrape' ? '🔍 Scraper une URL' : '📋 Sources enregistrées'}
            </button>
          ))}
        </div>

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
              <h2 className="font-display font-bold text-sm text-ink mb-4">Sources enregistrées</h2>
              <p className="text-sm text-muted font-light mb-5">
                Gère les sites fournisseurs ou partenaires depuis lesquels tu importes régulièrement des produits.
              </p>

              <div className="space-y-3">
                {sources.map((source) => (
                  <div key={source.id} className="flex items-center gap-4 p-4 bg-bone rounded-lg">
                    <div className="flex-1 min-w-0">
                      <div className="font-display font-semibold text-sm text-ink">{source.name}</div>
                      <div className="text-xs text-muted font-mono truncate">{source.url}</div>
                      <div className="text-xs text-muted mt-1">
                        Dernier import : {new Date(source.lastRun).toLocaleDateString('fr-FR')} · {source.productsImported} produits
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[10px] font-display font-semibold tracking-widest uppercase px-2 py-1 rounded border ${
                        source.status === 'done' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        source.status === 'running' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        source.status === 'error' ? 'bg-terra/10 text-terra-dark border-terra/30' :
                        'bg-bone text-muted border-line'
                      }`}>
                        {source.status}
                      </span>
                      <button
                        type="button"
                        onClick={() => { setUrl(source.url); setActiveTab('scrape'); }}
                        className="h-8 px-3 rounded-full border border-line bg-cream hover:bg-bone font-display text-[10px] font-semibold tracking-widest uppercase transition-colors"
                      >
                        Scraper →
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="mt-4 h-10 px-6 rounded-full border border-dashed border-line text-muted hover:border-terra hover:text-terra font-display text-xs font-semibold tracking-widest uppercase transition-colors"
              >
                + Ajouter une source
              </button>
            </div>

            {/* Import history */}
            <div className="bg-cream border border-line rounded-xl p-5">
              <h3 className="font-display font-bold text-sm text-ink mb-4">Historique d&apos;imports</h3>
              <div className="space-y-2">
                {[
                  { date: '2026-05-24', source: 'Zalando FR', products: 3, status: 'done' },
                  { date: '2026-05-23', source: 'Jumia RDC', products: 2, status: 'done' },
                  { date: '2026-05-22', source: 'URL directe', products: 1, status: 'done' },
                ].map((entry, i) => (
                  <div key={i} className="flex items-center justify-between text-sm py-2 border-b border-line last:border-0">
                    <div className="flex items-center gap-3">
                      <span className="text-muted text-xs font-mono">{new Date(entry.date).toLocaleDateString('fr-FR')}</span>
                      <span className="font-medium text-ink">{entry.source}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-muted text-xs">{entry.products} produit{entry.products > 1 ? 's' : ''}</span>
                      <span className="text-[10px] font-display font-semibold uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {entry.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
