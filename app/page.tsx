'use client';

import Link from 'next/link';
import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useAllProducts } from '@/lib/hooks/useAllProducts';
import { ProductCard } from '@/components/ProductCard';
import { Marquee } from '@/components/Marquee';
import { PriceDisplay } from '@/components/PriceDisplay';
import { RecommendedSection, RecentlyViewedSection } from '@/components/RecommendedSection';
import { BestSellersSection } from '@/components/BestSellersSection';
import { subscribeCarousels, type Carousel } from '@/lib/firebase/carousel';
import type { Product } from '@/lib/types';

export default function HomePage() {
  const allProducts = useAllProducts();

  // ── Multi-carousels Firestore ────────────────────────────────────────────
  const [carousels, setCarousels] = useState<Carousel[]>([]);
  useEffect(() => subscribeCarousels(setCarousels), []);

  const featured = useMemo(() => allProducts.filter((p) => p.status === 'featured'), [allProducts]);

  /**
   * Priorité :
   * 1. Carousel actif défini dans /admin/carousel (Firestore)
   * 2. Fallback → produits "À la une" si aucun carousel actif
   */
  const heroProducts = useMemo(() => {
    const active = carousels.find((c) => c.actif);
    if (active && active.productIds.length > 0) {
      return active.productIds
        .map((pid) => allProducts.find((p) => p.id === pid))
        .filter((p): p is Product => !!p && p.images.length > 0);
    }
    return featured.filter((p) => p.images[0]);
  }, [carousels, allProducts, featured]);

  const [heroIndex, setHeroIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const goTo = useCallback((idx: number) => {
    setIsTransitioning(true);
    setTimeout(() => {
      setHeroIndex(idx);
      setIsTransitioning(false);
    }, 150);
  }, []);

  const goPrev = () => goTo((heroIndex - 1 + heroProducts.length) % heroProducts.length);
  const goNext = useCallback(() => goTo((heroIndex + 1) % heroProducts.length), [heroIndex, heroProducts.length, goTo]);

  // Auto-avance toutes les 6 secondes
  useEffect(() => {
    if (heroProducts.length <= 1) return;
    const t = setInterval(goNext, 6000);
    return () => clearInterval(t);
  }, [heroProducts.length, goNext]);

  const currentHero = heroProducts[heroIndex] ?? null;

  // Comptes par catégorie calculés dynamiquement
  const catCounts = useMemo(() => ({
    mode:        allProducts.filter((p) => p.category === 'mode').length,
    technologie: allProducts.filter((p) => p.category === 'technologie').length,
    hybrides:    allProducts.filter((p) => p.category === 'hybrides').length,
    services:    allProducts.filter((p) => p.category === 'services').length,
  }), [allProducts]);

  // Image représentative par catégorie (premier produit avec image)
  const catImages = useMemo(() => ({
    mode:        allProducts.find((p) => p.category === 'mode')?.images[0] ?? '',
    technologie: allProducts.find((p) => p.category === 'technologie')?.images[0] ?? '',
    hybrides:    allProducts.find((p) => p.category === 'hybrides')?.images[0] ?? '',
    services:    allProducts.find((p) => p.category === 'services')?.images[0] ?? '',
  }), [allProducts]);

  return (
    <>
      {/* ━━━━━━━━━━━━━ HERO IMMERSIF ━━━━━━━━━━━━━ */}
      <HeroCarousel
        heroProducts={heroProducts}
        heroIndex={heroIndex}
        isTransitioning={isTransitioning}
        goTo={goTo}
        goPrev={goPrev}
        goNext={goNext}
        allProductsCount={allProducts.length}
      />

      {/* ━━━━━━━━━━━━━ MARQUEE ━━━━━━━━━━━━━ */}
      <Marquee
        items={['Catch the Style', 'ILU Shop', 'New Season 2026', 'Mode & Tech', 'Livraison RDC']}
        className="mt-2"
      />

      {/* ━━━━━━━━━━━━━ CATEGORIES ━━━━━━━━━━━━━ */}
      <section className="py-24 bg-bone">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
            <div>
              <span className="font-display text-[10px] tracking-[0.35em] uppercase text-terra font-semibold">
                — Explorer
              </span>
              <h2 className="mt-3 font-display font-bold text-4xl md:text-5xl text-ink">
                Catégories tendance
              </h2>
            </div>
            <Link
              href="/catalogue"
              className="font-display text-xs font-semibold tracking-[0.25em] uppercase text-ink hover:text-terra transition-colors flex items-center gap-2 group"
            >
              Tout voir
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </Link>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            <CategoryCard href="/catalogue?cat=mode"        label="Mode"             caption="Vêtements, chaussures, bijoux, parfums"    count={catCounts.mode}        image={catImages.mode}        tone="terra" large />
            <CategoryCard href="/catalogue?cat=technologie" label="Technologie"      caption="Smartphones, laptops, accessoires tech"    count={catCounts.technologie} image={catImages.technologie} tone="ink" />
            <CategoryCard href="/catalogue?cat=hybrides"    label="Wearables"        caption="Montres connectées, bracelets fitness"     count={catCounts.hybrides}    image={catImages.hybrides}    tone="beige" />
            <CategoryCard href="/catalogue?cat=services"    label="Services digitaux" caption="Netflix, Spotify, forfaits data RDC"      count={catCounts.services}    image={catImages.services}    tone="gold" />
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━ À LA UNE ━━━━━━━━━━━━━ */}
      <section id="featured" className="py-24 bg-cream">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
            <div>
              <span className="font-display text-[10px] tracking-[0.35em] uppercase text-terra font-semibold">
                ★ Sélection éditoriale
              </span>
              <h2 className="mt-3 font-display font-bold text-4xl md:text-5xl text-ink">
                À la une<span className="text-terra">.</span>
              </h2>
              <p className="mt-3 text-sm font-light text-muted max-w-md">
                Pièces choisies à la main par l&apos;équipe ILU SHOP — produits détourés, prêts à porter.
              </p>
            </div>
            <Link
              href="/catalogue"
              className="font-display text-xs font-semibold tracking-[0.25em] uppercase text-ink hover:text-terra transition-colors flex items-center gap-2 group"
            >
              Tout voir
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </Link>
          </div>

          {featured.length === 0 ? (
            <div className="py-16 text-center text-muted font-display text-sm">
              Aucun produit à la une pour l&apos;instant.
            </div>
          ) : (
            <div className={`grid grid-cols-2 gap-x-5 gap-y-12 ${featured.length >= 4 ? 'lg:grid-cols-4' : featured.length === 3 ? 'lg:grid-cols-3' : featured.length === 2 ? 'lg:grid-cols-2' : 'lg:grid-cols-1 max-w-xs mx-auto'}`}>
              {featured.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ━━━━━━━━━━━━━ SERVICES DIGITAUX ━━━━━━━━━━━━━ */}
      <section className="py-24 bg-bone overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">

            {/* ── Colonne gauche ── */}
            <div>
              <span className="font-display text-[10px] tracking-[0.35em] uppercase text-terra font-semibold">
                — Services digitaux
              </span>
              <h2 className="mt-4 font-display font-extrabold text-ink leading-[0.92] text-[clamp(36px,5vw,64px)]">
                Pas de carte<br />bancaire ?
              </h2>
              <h2 className="font-display font-extrabold text-terra leading-[0.92] text-[clamp(36px,5vw,64px)]">
                Pas de problème.
              </h2>
              <p className="mt-6 text-sm font-light text-ink-light max-w-md leading-relaxed">
                Netflix, Spotify, Adobe, Microsoft 365 — obtenez vos abonnements en quelques
                minutes, payés en Mobile Money ou cash. Livraison instantanée.
              </p>

              {/* Pills des plateformes */}
              <div className="flex flex-wrap gap-2 mt-6">
                {['Netflix', 'Spotify', 'YouTube Premium', 'Canva Pro', 'Microsoft 365', 'Adobe CC', 'Xbox Game Pass'].map((s) => (
                  <span
                    key={s}
                    className="text-xs font-medium px-4 py-1.5 rounded-full border border-line bg-cream text-ink"
                  >
                    {s}
                  </span>
                ))}
              </div>

              <Link
                href="/catalogue?cat=services"
                className="inline-flex items-center gap-3 mt-10 bg-ink text-cream font-display text-[11px] font-bold tracking-[0.25em] uppercase px-8 py-4 rounded-full hover:bg-terra transition-colors duration-300"
              >
                Voir tous les abonnements →
              </Link>
            </div>

            {/* ── Colonne droite — opérateurs data ── */}
            <div>
              <p className="font-display text-[10px] tracking-[0.35em] uppercase text-muted font-semibold mb-5">
                Recharger sa data
              </p>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { name: 'Vodacom',  abbr: 'VOD', color: 'bg-[#E2001A]', volumes: ['1 Go', '3 Go', '5 Go', '10 Go', '20 Go'] },
                  { name: 'Airtel',   abbr: 'AIR', color: 'bg-[#E2001A]', volumes: ['1 Go', '3 Go', '5 Go', '10 Go', '20 Go'] },
                  { name: 'Africell', abbr: 'AFC', color: 'bg-[#003087]', volumes: ['1 Go', '3 Go', '5 Go', '10 Go'] },
                  { name: 'Orange',   abbr: 'ORA', color: 'bg-[#FF6600]', volumes: ['1 Go', '3 Go', '5 Go', '10 Go'] },
                ].map((op) => (
                  <div
                    key={op.name}
                    className="bg-cream border border-line rounded-xl p-4 hover:border-terra/40 hover:shadow-sm transition-all"
                  >
                    {/* Logo + nom */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-lg ${op.color} flex items-center justify-center shrink-0`}>
                        <span className="text-white font-display font-extrabold text-[10px] tracking-wider">
                          {op.abbr}
                        </span>
                      </div>
                      <span className="font-display font-bold text-sm text-ink">{op.name}</span>
                    </div>

                    {/* Volumes */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {op.volumes.map((v) => (
                        <span
                          key={v}
                          className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-bone border border-line text-muted"
                        >
                          {v}
                        </span>
                      ))}
                    </div>

                    {/* CTA */}
                    <Link
                      href="/catalogue?cat=services"
                      className="font-display text-[10px] font-bold tracking-widest uppercase text-terra hover:text-terra-dark transition-colors"
                    >
                      Recharger →
                    </Link>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━ EDITORIAL BANNER ━━━━━━━━━━━━━ */}
      <section className="bg-ink text-cream py-24 md:py-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="font-display text-[10px] tracking-[0.35em] uppercase text-gold font-semibold">
              ◯ Manifesto
            </span>
            <h3 className="mt-4 font-display font-extrabold text-5xl md:text-7xl leading-[0.95]">
              Chaque pièce<br />
              <span className="text-terra-light">a une histoire.</span>
            </h3>
            <p className="mt-8 text-cream/70 font-light max-w-md leading-relaxed">
              ILU SHOP, c&apos;est l&apos;idée que vos vêtements et vos outils tech doivent vous ressembler.
              Une sélection humaine, un chat humain, une livraison humaine.
            </p>
            <Link
              href="/a-propos"
              className="inline-flex items-center gap-3 mt-10 font-display text-xs font-semibold tracking-[0.25em] uppercase text-cream border-b border-cream pb-1 hover:text-terra-light hover:border-terra-light transition-colors"
            >
              Notre démarche →
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FeatureCard icon="◯" title="Bi-Devise" desc="Prix affichés en USD et CDF, taux mis à jour quotidiennement par notre équipe." />
            <FeatureCard icon="✦" title="Chat Commande" desc="Pas de tunnel de paiement froid. On discute, on s'entend, on livre." />
            <FeatureCard icon="□" title="Livraison RDC" desc="Kinshasa sous 24h. Reste du pays : nous convenons des modalités ensemble." />
            <FeatureCard icon="△" title="Mobile Money" desc="M-Pesa, Airtel Money, Orange Money, virement, cash — vous choisissez." />
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━ MARQUEE 2 ━━━━━━━━━━━━━ */}
      <Marquee
        items={['Best Sellers', 'Stock Limité', '— Édition 2026 —', 'ILU SHOP', 'Prêt à porter']}
        invert
      />

      {/* ━━━━━━━━━━━━━ BEST SELLERS ━━━━━━━━━━━━━ */}
      <BestSellersSection />

      {/* ━━━━━━━━━━━━━ HERO PRODUIT SECONDAIRE ━━━━━━━━━━━━━ */}
      {(featured[1] ?? allProducts[1]) && (
        <SecondaryHero product={featured[1] ?? allProducts[1]} />
      )}

      {/* ━━━━━━━━━━━━━ RECOMMANDATIONS PERSONNALISÉES ━━━━━━━━━━━━━ */}
      <RecentlyViewedSection />
      <RecommendedSection />
    </>
  );
}

// ── Gradients automatiques par catégorie ─────────────────────────────────────
const CATEGORY_GRADIENTS: Record<string, { from: string; to: string; overlay: string }> = {
  mode:        { from: '#2C1A0E', to: '#8B4A2A', overlay: 'rgba(44,26,14,0.72)' },
  technologie: { from: '#0F1520', to: '#243040', overlay: 'rgba(10,16,24,0.80)' },
  hybrides:    { from: '#1A1A2E', to: '#2E2640', overlay: 'rgba(20,18,30,0.75)' },
  services:    { from: '#0F0A14', to: '#250F0F', overlay: 'rgba(15,10,20,0.82)' },
  default:     { from: '#1A1410', to: '#3D2A18', overlay: 'rgba(26,20,16,0.72)' },
};

function getEyebrow(product: Product): string {
  const map: Record<string, string> = {
    mode: 'Mode · Style',
    technologie: 'High-Tech',
    hybrides: 'Wearables',
    services: 'Services digitaux',
  };
  if (product.badge === 'new') return `${map[product.category] ?? 'Sélection'} · New Arrival`;
  if (product.status === 'featured') return `${map[product.category] ?? 'Sélection'} · À la une`;
  return map[product.category] ?? 'Sélection';
}

/**
 * Découpe le nom produit en 3 lignes max pour le titre hero.
 * La 3e ligne est colorée en terra.
 */
function splitHeroTitle(name: string): [string, string, string] {
  const words = name.toUpperCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return ['', '', ''];
  if (words.length === 1) return [words[0], '', ''];
  if (words.length === 2) return [words[0], '', words[1]];
  if (words.length === 3) return [words[0], words[1], words[2]];
  // 4+ mots → 3 groupes proportionnels
  const cut1 = Math.ceil(words.length / 3);
  const cut2 = Math.ceil((words.length * 2) / 3);
  return [
    words.slice(0, cut1).join(' '),
    words.slice(cut1, cut2).join(' '),
    words.slice(cut2).join(' '),
  ];
}

// ── Hero Carousel — Grid 2 colonnes strict (texte gauche / image droite) ──────
function HeroCarousel({
  heroProducts,
  heroIndex,
  isTransitioning,
  goTo,
  goPrev,
  goNext,
  allProductsCount,
}: {
  heroProducts: Product[];
  heroIndex: number;
  isTransitioning: boolean;
  goTo: (i: number) => void;
  goPrev: () => void;
  goNext: () => void;
  allProductsCount: number;
}) {
  const current = heroProducts[heroIndex] ?? null;
  const [l1, l2, l3] = current ? splitHeroTitle(current.name) : ['', '', ''];

  // ── Swipe tactile mobile ──────────────────────────────────────────────────
  const touchStartX = useRef<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 50) {
      if (dx < 0) goNext();
      else goPrev();
    }
    touchStartX.current = null;
  };

  // Barre de progression
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    setProgress(0);
    const start = Date.now();
    const duration = 6000;
    const raf = requestAnimationFrame(function tick() {
      const elapsed = Date.now() - start;
      setProgress(Math.min((elapsed / duration) * 100, 100));
      if (elapsed < duration) requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, [heroIndex]);

  if (heroProducts.length === 0) {
    return (
      <section
        className="relative w-full h-screen min-h-[620px] overflow-hidden flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #1A1410 0%, #3D2A18 100%)' }}
      >
        <div className="text-center text-cream/40">
          <div className="font-display text-7xl mb-4">✦</div>
          <div className="font-display text-sm tracking-[0.4em] uppercase">ILU SHOP</div>
        </div>
      </section>
    );
  }

  return (
    <section
      className="relative w-full h-screen min-h-[620px] overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >

      {/* ── z-index 1 : Fonds de slides (gradient ou photo lifestyle) ── */}
      {heroProducts.map((product, i) => {
        const grad = CATEGORY_GRADIENTS[product.category] ?? CATEGORY_GRADIENTS.default;
        const isActive = i === heroIndex;
        return (
          <div
            key={product.id}
            className="absolute inset-0 transition-opacity duration-700"
            style={{ opacity: isActive ? 1 : 0, zIndex: 1, pointerEvents: 'none' }}
          >
            {product.heroBgImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.heroBgImage}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
                style={{
                  transform: isActive ? 'scale(1.04)' : 'scale(1)',
                  transition: 'transform 8s ease',
                }}
              />
            ) : (
              <div
                className="absolute inset-0"
                style={{ background: `linear-gradient(135deg, ${grad.from} 0%, ${grad.to} 100%)` }}
              />
            )}
          </div>
        );
      })}

      {/* ── z-index 2 : Overlay dégradé gauche → transparent ── */}
      {(() => {
        const grad = CATEGORY_GRADIENTS[current?.category ?? ''] ?? CATEGORY_GRADIENTS.default;
        return (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              zIndex: 2,
              background: `linear-gradient(to right, ${grad.overlay} 0%, ${grad.overlay.replace(/[\d.]+\)$/, '0.20)')} 52%, transparent 100%)`,
            }}
          />
        );
      })()}

      {/* ── z-index 3-4 : Grid responsive — 1 col mobile / 2 col desktop ── */}
      <div
        className="absolute inset-0 grid grid-cols-1 [grid-template-rows:48%_52%] md:grid-cols-[55%_45%] md:[grid-template-rows:none]"
        style={{ zIndex: 3 }}
      >
        {/* ── ZONE GAUCHE — texte (order-2 mobile = en bas) ── */}
        <div
          className="order-2 md:order-1 flex flex-col justify-end pb-8 md:pb-20 px-5 md:pl-14 md:pr-6"
          style={{
            zIndex: 4,
            opacity: isTransitioning ? 0 : 1,
            transition: 'opacity 0.25s ease',
          }}
        >
          {/* Eyebrow */}
          <div className="flex items-center gap-2 mb-3 md:mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-terra shrink-0" />
            <span className="font-display text-[10px] md:text-[11px] font-medium tracking-[0.14em] uppercase text-cream/70">
              {current ? getEyebrow(current) : ''}
            </span>
          </div>

          {/* Titre — max 3 lignes, dernière en terra */}
          <h1
            className="font-display font-extrabold text-cream uppercase mb-3 md:mb-5"
            style={{ fontSize: 'clamp(30px, 7.5vw, 76px)', lineHeight: '0.92', letterSpacing: '-2px' }}
          >
            {l1 && <span className="block">{l1}</span>}
            {l2 && <span className="block">{l2}</span>}
            {l3 && <span className="block text-terra">{l3}</span>}
          </h1>

          {/* Badge prix */}
          {current && (
            <div
              className="inline-flex items-baseline gap-2 mb-3 md:mb-4 px-3 md:px-4 py-1.5 md:py-2 rounded-xl border border-cream/20 self-start"
              style={{ background: 'rgba(242,237,228,0.10)', backdropFilter: 'blur(8px)' }}
            >
              <span className="font-display font-extrabold text-cream text-lg md:text-[22px]">${current.priceUSD}</span>
              <span className="text-cream/55 text-xs md:text-sm">/ {(current.priceUSD * 2000).toLocaleString()} FC</span>
              {current.oldPriceUSD && (
                <span className="text-cream/40 text-xs md:text-sm line-through">${current.oldPriceUSD}</span>
              )}
            </div>
          )}

          {/* Description courte — masquée sur très petit écran */}
          {current?.shortDescription && (
            <p className="hidden sm:block text-cream/65 text-xs md:text-sm leading-relaxed max-w-xs mb-4 md:mb-5">
              {current.shortDescription}
            </p>
          )}

          {/* Stats — masquées sur mobile pour gagner de l'espace */}
          <div className="hidden md:flex items-center gap-5 mb-7">
            <div>
              <div className="font-display text-[13px] font-bold text-cream leading-none">
                {allProductsCount > 0 ? `${allProductsCount}+` : '—'}
              </div>
              <div className="font-display text-[9px] tracking-widest uppercase text-cream/45 mt-1">Pièces</div>
            </div>
            <div className="w-px h-6 bg-cream/15" />
            <div>
              <div className="font-display text-[13px] font-bold text-cream leading-none">24h</div>
              <div className="font-display text-[9px] tracking-widest uppercase text-cream/45 mt-1">Livraison</div>
            </div>
            <div className="w-px h-6 bg-cream/15" />
            <div>
              <div className="font-display text-[13px] font-bold text-cream leading-none">USD/FC</div>
              <div className="font-display text-[9px] tracking-widest uppercase text-cream/45 mt-1">Bi-devise</div>
            </div>
          </div>

          {/* CTA */}
          <Link
            href={current ? `/produit/${current.slug}` : '/catalogue'}
            className="self-start inline-flex items-center gap-2 bg-cream text-ink font-display text-[10px] md:text-[11px] font-bold tracking-[0.2em] uppercase px-5 md:px-7 py-3 md:py-3.5 rounded-full hover:bg-terra hover:text-cream transition-colors duration-200"
          >
            Voir le produit →
          </Link>
        </div>

        {/* ── ZONE DROITE — image (order-1 mobile = en haut) ── */}
        <div className="order-1 md:order-2 relative overflow-hidden" style={{ zIndex: 3 }}>
          {current?.images[0] && (
            <Link
              href={`/produit/${current.slug}`}
              className="absolute inset-0 flex items-end justify-center group"
            >
              {/*
               * Wrapper de zoom mobile :
               * — Mobile  : scale(1.3) depuis le bas → le produit remonte et remplit la zone
               * — Desktop : scale(1) → comportement d'origine
               * Le débordement est coupé par overflow-hidden du parent (zone droite).
               */}
              <div className="scale-[1.3] md:scale-100 origin-bottom w-full h-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={current.images[0]}
                  alt={current.name}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    objectPosition: 'center bottom',
                    filter: 'drop-shadow(-12px 0 30px rgba(26,20,16,0.45))',
                    transform: isTransitioning ? 'translateX(20px) scale(0.97)' : 'translateX(0) scale(1)',
                    opacity: isTransitioning ? 0 : 1,
                    transition: 'transform 0.6s cubic-bezier(0.22,1,0.36,1), opacity 0.4s ease',
                  }}
                />
              </div>
              {/* Badge hover — desktop seulement */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap hidden md:block">
                <span className="bg-cream/95 backdrop-blur-sm border border-line rounded-full px-5 py-2 font-display text-[10px] tracking-widest uppercase font-bold text-ink shadow-lg">
                  Voir le produit →
                </span>
              </div>
            </Link>
          )}
        </div>
      </div>

      {/* ── z-index 5 : Compteur — haut-droite, jamais sur le titre ── */}
      {heroProducts.length > 1 && (
        <div
          className="absolute hidden lg:block font-display font-bold text-[12px] text-cream/50 tracking-wider"
          style={{ top: 80, right: 40, zIndex: 5 }}
        >
          {String(heroIndex + 1).padStart(2, '0')} / {String(heroProducts.length).padStart(2, '0')}
        </div>
      )}

      {/* ── z-index 5 : Flèches navigation ── */}
      {heroProducts.length > 1 && (
        <>
          <button
            type="button"
            onClick={goPrev}
            aria-label="Précédent"
            className="hidden md:flex absolute top-1/2 -translate-y-1/2 left-5 w-11 h-11 rounded-full items-center justify-center text-cream transition-all hover:bg-terra"
            style={{ zIndex: 5, background: 'rgba(242,237,228,0.10)', border: '1px solid rgba(242,237,228,0.20)', backdropFilter: 'blur(8px)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <button
            type="button"
            onClick={goNext}
            aria-label="Suivant"
            className="hidden md:flex absolute top-1/2 -translate-y-1/2 right-5 w-11 h-11 rounded-full items-center justify-center text-cream transition-all hover:bg-terra"
            style={{ zIndex: 5, background: 'rgba(242,237,228,0.10)', border: '1px solid rgba(242,237,228,0.20)', backdropFilter: 'blur(8px)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
          </button>
        </>
      )}

      {/* ── z-index 6 : Dots de pagination ── */}
      {heroProducts.length > 1 && (
        <div className="absolute bottom-7 left-1/2 -translate-x-1/2 flex items-center gap-2" style={{ zIndex: 6 }}>
          {heroProducts.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Slide ${i + 1}`}
              className="transition-all duration-300"
              style={{
                width: i === heroIndex ? 24 : 6,
                height: 6,
                borderRadius: i === heroIndex ? 4 : '50%',
                background: i === heroIndex ? 'rgba(242,237,228,0.9)' : 'rgba(242,237,228,0.35)',
              }}
            />
          ))}
        </div>
      )}

      {/* ── Barre de progression ── */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[2px]"
        style={{ zIndex: 6, background: 'rgba(255,255,255,0.10)' }}
      >
        <div className="h-full bg-terra" style={{ width: `${progress}%`, transition: 'width 0.1s linear' }} />
      </div>

    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="font-display text-3xl font-extrabold text-ink leading-none">{value}</div>
      <div className="mt-2 font-display text-[10px] tracking-widest uppercase text-muted">{label}</div>
    </div>
  );
}

function CategoryCard({
  href, label, caption, count, image, tone, large = false,
}: {
  href: string; label: string; caption: string; count: number;
  image: string; tone: 'terra' | 'ink' | 'beige' | 'gold'; large?: boolean;
}) {
  const toneMap = {
    terra: { bg: 'bg-terra', text: 'text-cream', accent: 'text-cream/70' },
    ink: { bg: 'bg-ink', text: 'text-cream', accent: 'text-cream/70' },
    beige: { bg: 'bg-beige', text: 'text-ink', accent: 'text-muted' },
    gold: { bg: 'bg-gold', text: 'text-ink', accent: 'text-ink/70' },
  };
  const t = toneMap[tone];

  return (
    <Link
      href={href}
      className={`group ${t.bg} ${t.text} rounded-md p-6 flex flex-col justify-between overflow-hidden relative transition-transform hover:-translate-y-1 duration-500 ease-smooth ${large ? 'lg:col-span-1 lg:row-span-1 min-h-[280px]' : 'min-h-[280px]'}`}
    >
      <div className="relative z-10">
        <div className={`font-display text-[10px] tracking-[0.3em] uppercase font-semibold ${t.accent}`}>
          {count > 0 ? `${count} produits` : 'Explorer'}
        </div>
        <div className="font-display text-3xl font-extrabold mt-2">{label}</div>
        <div className={`text-xs font-light mt-1 ${t.accent}`}>{caption}</div>
      </div>

      <div className="relative z-10 flex items-center justify-between">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="w-32 h-32 object-cover rounded transition-transform duration-700 group-hover:scale-110" />
        ) : (
          <div className="w-32 h-32 rounded opacity-20 bg-current" />
        )}
        <span className="font-display text-xs font-semibold tracking-widest uppercase opacity-80 group-hover:opacity-100 transition-opacity">
          Explorer →
        </span>
      </div>
    </Link>
  );
}

function FeatureCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="border border-cream/15 rounded-md p-6 hover:bg-cream/5 transition-colors">
      <div className="text-3xl text-terra-light">{icon}</div>
      <h4 className="mt-4 font-display font-bold text-lg">{title}</h4>
      <p className="mt-2 text-sm text-cream/60 font-light leading-relaxed">{desc}</p>
    </div>
  );
}

function SecondaryHero({ product }: { product: Product }) {
  return (
    <section className="py-32 bg-cream relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="relative h-[400px] lg:h-[560px] flex items-center justify-center">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-[380px] h-[380px] lg:w-[500px] lg:h-[500px] rounded-full bg-beige" />
            </div>
            {product.images[0] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.images[0]}
                alt={product.name}
                className="relative z-10 max-h-[400px] lg:max-h-[560px] w-auto object-contain animate-float"
              />
            )}
          </div>

          <div>
            <span className="font-display text-[10px] tracking-[0.35em] uppercase text-terra font-semibold">
              ★ Pièce de la semaine
            </span>
            <h3 className="mt-4 font-display font-extrabold text-5xl md:text-7xl leading-[0.95] text-ink">
              FEEL<br />
              THE <span className="text-terra">VIBES.</span>
            </h3>
            <p className="mt-6 text-base font-light text-ink-light max-w-md">{product.description}</p>
            <div className="mt-8">
              <PriceDisplay usd={product.priceUSD} oldUsd={product.oldPriceUSD} size="lg" />
            </div>
            <Link
              href={`/produit/${product.slug}`}
              className="inline-flex items-center gap-3 mt-10 bg-ink hover:bg-terra text-cream font-display text-xs font-semibold tracking-[0.25em] uppercase px-8 py-4 rounded-full transition-colors duration-300 group"
            >
              Découvrir
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
