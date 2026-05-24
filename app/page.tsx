import Link from 'next/link';
import { PRODUCTS, getFeaturedProducts, CATEGORIES } from '@/lib/products';
import { ProductCard } from '@/components/ProductCard';
import { Marquee } from '@/components/Marquee';
import { PriceDisplay } from '@/components/PriceDisplay';
import { RecommendedSection, RecentlyViewedSection } from '@/components/RecommendedSection';
import { BestSellersSection } from '@/components/BestSellersSection';

export default function HomePage() {
  const featured = getFeaturedProducts();
  const heroProduct = featured[0] ?? PRODUCTS[0];
  const newArrivals = PRODUCTS.filter((p) => p.badge === 'new').slice(0, 3);

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
                <Stat value="450+" label="Pièces sélection." />
                <div className="w-px h-12 bg-line" />
                <Stat value="24h" label="Livraison Kinshasa" />
                <div className="w-px h-12 bg-line" />
                <Stat value="USD / FC" label="Bi-devise" />
              </div>
            </div>

            {/* Right visual */}
            <div className="lg:col-span-7 relative h-[500px] lg:h-[680px] flex items-center justify-center">
              {/* Circular terracotta background */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-[420px] h-[420px] lg:w-[560px] lg:h-[560px] rounded-full bg-radial-terra opacity-95" />
              </div>

              {/* Floating accent labels */}
              <div className="absolute top-6 right-4 lg:right-12 text-right">
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

              {/* Hero product image — floats over the circle */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={heroProduct.images[0]}
                alt={heroProduct.name}
                className="relative z-10 max-h-[560px] lg:max-h-[680px] w-auto object-contain drop-shadow-2xl animate-float"
              />

              {/* New Arrival floating cards */}
              <div className="absolute top-1/3 -left-2 lg:left-10 z-20 bg-cream border border-line rounded-md shadow-xl p-3 flex items-center gap-3 max-w-[200px] animate-fadeUp">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={newArrivals[0]?.images[0]}
                  alt=""
                  className="w-14 h-14 object-cover rounded-sm"
                />
                <div>
                  <div className="font-display text-[9px] tracking-widest uppercase text-terra font-semibold">
                    New Arrival
                  </div>
                  <div className="font-display text-xs font-semibold leading-tight">
                    {newArrivals[0]?.name}
                  </div>
                </div>
              </div>

              <div className="absolute bottom-12 right-0 lg:right-6 z-20 bg-cream border border-line rounded-md shadow-xl p-3 flex items-center gap-3 max-w-[200px] animate-fadeUp" style={{ animationDelay: '200ms' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={newArrivals[1]?.images[0]}
                  alt=""
                  className="w-14 h-14 object-cover rounded-sm"
                />
                <div>
                  <div className="font-display text-[9px] tracking-widest uppercase text-terra font-semibold">
                    Featured
                  </div>
                  <div className="font-display text-xs font-semibold leading-tight">
                    {newArrivals[1]?.name}
                  </div>
                </div>
              </div>
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
            <CategoryCard
              href="/catalogue?cat=mode"
              label="Mode"
              caption="Vêtements, vestes, sacs, accessoires"
              count={CATEGORIES[0].count}
              image={PRODUCTS.find((p) => p.category === 'mode')?.images[0] ?? ''}
              tone="terra"
              large
            />
            <CategoryCard
              href="/catalogue?cat=telephones"
              label="Téléphones"
              caption="Smartphones et accessoires"
              count={CATEGORIES[1].count}
              image={PRODUCTS.find((p) => p.category === 'telephones')?.images[0] ?? ''}
              tone="ink"
            />
            <CategoryCard
              href="/catalogue?cat=ordinateurs"
              label="Ordinateurs"
              caption="Laptops, ultrabooks, bureautique"
              count={CATEGORIES[2].count}
              image={PRODUCTS.find((p) => p.category === 'ordinateurs')?.images[0] ?? ''}
              tone="beige"
            />
            <CategoryCard
              href="/catalogue?cat=tablettes"
              label="Tablettes"
              caption="iPad et tablettes pro"
              count={CATEGORIES[3].count}
              image={PRODUCTS.find((p) => p.category === 'tablettes')?.images[0] ?? ''}
              tone="gold"
            />
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
                Pièces choisies à la main par l'équipe ILU SHOP — produits détourés, prêts à
                porter.
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

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-12">
            {featured.slice(0, 4).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
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
              ILU SHOP, c'est l'idée que vos vêtements et vos outils tech doivent vous ressembler.
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
            <FeatureCard
              icon="◯"
              title="Bi-Devise"
              desc="Prix affichés en USD et CDF, taux mis à jour quotidiennement par notre équipe."
            />
            <FeatureCard
              icon="✦"
              title="Chat Commande"
              desc="Pas de tunnel de paiement froid. On discute, on s'entend, on livre."
            />
            <FeatureCard
              icon="□"
              title="Livraison RDC"
              desc="Kinshasa sous 24h. Reste du pays : nous convenons des modalités ensemble."
            />
            <FeatureCard
              icon="△"
              title="Mobile Money"
              desc="M-Pesa, Airtel Money, Orange Money, virement, cash — vous choisissez."
            />
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

      {/* ━━━━━━━━━━━━━ HERO PRODUIT SECONDAIRE (LOCO style) ━━━━━━━━━━━━━ */}
      <SecondaryHero product={featured[1] ?? PRODUCTS[1]} />

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
      <div className="mt-2 font-display text-[10px] tracking-widest uppercase text-muted">
        {label}
      </div>
    </div>
  );
}

function CategoryCard({
  href,
  label,
  caption,
  count,
  image,
  tone,
  large = false,
}: {
  href: string;
  label: string;
  caption: string;
  count: number;
  image: string;
  tone: 'terra' | 'ink' | 'beige' | 'gold';
  large?: boolean;
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
      className={`group ${t.bg} ${t.text} rounded-md p-6 flex flex-col justify-between overflow-hidden relative transition-transform hover:-translate-y-1 duration-500 ease-smooth ${
        large ? 'lg:col-span-1 lg:row-span-1 min-h-[280px]' : 'min-h-[280px]'
      }`}
    >
      <div className="relative z-10">
        <div className={`font-display text-[10px] tracking-[0.3em] uppercase font-semibold ${t.accent}`}>
          {count} produits
        </div>
        <div className="font-display text-3xl font-extrabold mt-2">{label}</div>
        <div className={`text-xs font-light mt-1 ${t.accent}`}>{caption}</div>
      </div>

      <div className="relative z-10 flex items-center justify-between">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt=""
          className="w-32 h-32 object-cover rounded transition-transform duration-700 group-hover:scale-110"
        />
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

function SecondaryHero({ product }: { product: typeof PRODUCTS[number] }) {
  return (
    <section className="py-32 bg-cream relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="relative h-[400px] lg:h-[560px] flex items-center justify-center">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-[380px] h-[380px] lg:w-[500px] lg:h-[500px] rounded-full bg-beige" />
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={product.images[0]}
              alt={product.name}
              className="relative z-10 max-h-[400px] lg:max-h-[560px] w-auto object-contain animate-float"
            />
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
