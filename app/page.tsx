'use client';

import Link from 'next/link';
import { useMemo, useState, useEffect, useCallback } from 'react';
import { useAllProducts } from '@/lib/hooks/useAllProducts';
import { ProductCard } from '@/components/ProductCard';
import { Marquee } from '@/components/Marquee';
import { PriceDisplay } from '@/components/PriceDisplay';
import { RecommendedSection, RecentlyViewedSection } from '@/components/RecommendedSection';
import { BestSellersSection } from '@/components/BestSellersSection';
import type { Product } from '@/lib/types';

export default function HomePage() {
  const allProducts = useAllProducts();

  const featured = useMemo(() => allProducts.filter((p) => p.status === 'featured'), [allProducts]);
  const newArrivals = useMemo(() => allProducts.filter((p) => p.badge === 'new').slice(0, 3), [allProducts]);

  // Produits du carousel — featured en premier, puis les autres (max 6 slides)
  const heroProducts = useMemo(() => {
    const rest = allProducts.filter((p) => p.status !== 'featured' && p.images[0]);
    return [...featured, ...rest].filter((p) => p.images[0]).slice(0, 6);
  }, [allProducts, featured]);

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

  // Auto-avance toutes les 4 secondes
  useEffect(() => {
    if (heroProducts.length <= 1) return;
    const t = setInterval(goNext, 4000);
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
      {/* ━━━━━━━━━━━━━ HERO ━━━━━━━━━━━━━ */}
      <section className="relative overflow-hidden bg-cream pt-10 lg:pt-16 pb-0">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="grid lg:grid-cols-12 gap-8 items-center min-h-[80vh]">
            {/* Left content */}
            <div className="lg:col-span-5 z-10 relative">
              <span className="font-display text-[11px] font-semibold tracking-[0.4em] text-terra uppercase">
                ◯ Next Arrival — Saison 2026
              </span>
              <h1 className="mt-6 font-display font-extrabold text-ink leading-[0.88] tracking-tight text-[clamp(56px,9vw,128px)]">
                YOUR
                <br />
                STYLE,
                <br />
                YOUR
                <br />
                <span className="text-terra">STORY.</span>
              </h1>
              <p className="mt-8 text-base font-light text-ink-light max-w-md leading-relaxed">
                Mode & High-Tech, sélection éditoriale. Des pièces choisies, des prix en USD et FC,
                une équipe qui vous parle vraiment.
              </p>
              <div className="mt-10 flex flex-wrap items-center gap-4">
                <Link
                  href="/catalogue"
                  className="group inline-flex items-center gap-3 bg-ink hover:bg-terra text-cream font-display text-xs font-semibold tracking-[0.25em] uppercase px-8 py-4 rounded-full transition-colors duration-300"
                >
                  Découvrir la collection
                  <span className="transition-transform group-hover:translate-x-1">→</span>
                </Link>
                <Link
                  href="#featured"
                  className="font-display text-xs font-semibold tracking-[0.25em] uppercase text-ink hover:text-terra transition-colors border-b border-ink hover:border-terra pb-1"
                >
                  Voir À la une
                </Link>
              </div>

              {/* Stats */}
              <div className="mt-16 flex items-center gap-10">
                <Stat value={`${allProducts.length > 0 ? allProducts.length + '+' : '—'}`} label="Pièces sélection." />
                <div className="w-px h-12 bg-line" />
                <Stat value="24h" label="Livraison Kinshasa" />
                <div className="w-px h-12 bg-line" />
                <Stat value="USD / FC" label="Bi-devise" />
              </div>
            </div>

            {/* Right visual — Carousel */}
            <div className="lg:col-span-7 relative h-[500px] lg:h-[680px] flex items-center justify-center">
              {/* Circular terracotta background */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-[420px] h-[420px] lg:w-[560px] lg:h-[560px] rounded-full bg-radial-terra opacity-95" />
              </div>

              {/* Floating accent labels */}
              <div className="absolute top-6 right-4 lg:right-12 text-right z-10">
                <div className="font-display text-[10px] tracking-[0.3em] uppercase text-muted">
                  Next SS Preview
                </div>
                <div className="font-display text-sm font-semibold text-ink">Pièces signature</div>
                <div className="w-12 h-px bg-line mx-auto my-3 ml-auto" />
                <div className="font-display text-[10px] tracking-[0.3em] uppercase text-muted">
                  Trending
                </div>
                <div className="font-display text-sm font-semibold text-ink">Mode & Tech</div>
              </div>

              {/* Image carousel — cliquable */}
              {currentHero?.images[0] ? (
                <Link
                  href={`/produit/${currentHero.slug}`}
                  className="relative z-10 flex items-center justify-center group"
                  style={{ transition: 'opacity 0.15s ease', opacity: isTransitioning ? 0 : 1 }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    key={heroIndex}
                    src={currentHero.images[0]}
                    alt={currentHero.name}
                    className="max-h-[480px] lg:max-h-[620px] w-auto object-contain drop-shadow-2xl animate-float"
                  />
                  {/* Overlay hover */}
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pb-2">
                    <span className="bg-cream/95 backdrop-blur-sm border border-line rounded-full px-5 py-2 font-display text-[10px] tracking-widest uppercase font-bold text-ink shadow-lg flex items-center gap-2">
                      Voir le produit →
                    </span>
                  </div>
                </Link>
              ) : (
                <div className="relative z-10 flex flex-col items-center gap-3 text-cream/60">
                  <span className="font-display text-6xl">✦</span>
                  <span className="font-display text-sm tracking-widest uppercase">ILU SHOP</span>
                </div>
              )}

              {/* Badge produit actuel */}
              {currentHero && (
                <div
                  className="absolute bottom-16 left-4 lg:left-10 z-20 bg-cream border border-line rounded-xl shadow-lg px-4 py-3 flex items-center gap-3 max-w-[220px]"
                  style={{ transition: 'opacity 0.15s ease', opacity: isTransitioning ? 0 : 1 }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={currentHero.images[0]} alt="" className="w-12 h-12 object-cover rounded-lg shrink-0 border border-line" />
                  <div className="min-w-0">
                    <div className="font-display text-[9px] tracking-widest uppercase text-terra font-semibold">
                      {currentHero.badge === 'new' ? 'New Arrival' : currentHero.status === 'featured' ? 'À la une' : 'Sélection'}
                    </div>
                    <div className="font-display text-xs font-semibold leading-tight text-ink truncate">{currentHero.name}</div>
                    <div className="font-display text-[11px] font-bold text-terra mt-0.5">${currentHero.priceUSD}</div>
                  </div>
                </div>
              )}

              {/* Floating new arrival (2e produit) */}
              {newArrivals[1] && newArrivals[1].id !== currentHero?.id && (
                <div className="absolute bottom-12 right-0 lg:right-6 z-20 bg-cream border border-line rounded-md shadow-xl p-3 flex items-center gap-3 max-w-[200px] animate-fadeUp" style={{ animationDelay: '200ms' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={newArrivals[1].images[0]} alt="" className="w-14 h-14 object-cover rounded-sm" />
                  <div>
                    <div className="font-display text-[9px] tracking-widest uppercase text-terra font-semibold">Featured</div>
                    <div className="font-display text-xs font-semibold leading-tight">{newArrivals[1].name}</div>
                  </div>
                </div>
              )}

              {/* Flèches navigation */}
              {heroProducts.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={goPrev}
                    aria-label="Précédent"
                    className="absolute left-0 lg:-left-4 z-30 w-10 h-10 rounded-full bg-cream border border-line shadow-md flex items-center justify-center text-ink hover:bg-terra hover:text-cream hover:border-terra transition-all"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={goNext}
                    aria-label="Suivant"
                    className="absolute right-0 lg:-right-4 z-30 w-10 h-10 rounded-full bg-cream border border-line shadow-md flex items-center justify-center text-ink hover:bg-terra hover:text-cream hover:border-terra transition-all"
                  >
                    →
                  </button>
                </>
              )}

              {/* Dots */}
              {heroProducts.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2">
                  {heroProducts.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => goTo(i)}
                      aria-label={`Slide ${i + 1}`}
                      className={`transition-all duration-300 rounded-full ${
                        i === heroIndex
                          ? 'w-6 h-2 bg-terra'
                          : 'w-2 h-2 bg-ink/25 hover:bg-ink/50'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

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
