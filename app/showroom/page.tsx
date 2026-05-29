'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { subscribePublishedOutfits } from '@/lib/firebase/outfits';
import { useShop } from '@/components/ShopProvider';
import { PriceDisplay } from '@/components/PriceDisplay';
import type { Outfit, OutfitCategory, OutfitItem } from '@/lib/showroom/types';
import { OUTFIT_CATEGORY_LABEL, OUTFIT_ITEM_CATEGORY_EMOJI } from '@/lib/showroom/types';

// ── Constantes ────────────────────────────────────────────────────────────────

const FILTER_CATS: { val: OutfitCategory | 'all'; label: string }[] = [
  { val: 'all', label: 'Tous' },
  { val: 'casual', label: 'Casual' },
  { val: 'business', label: 'Business' },
  { val: 'soiree', label: 'Soirée' },
  { val: 'streetwear', label: 'Streetwear' },
  { val: 'tech', label: 'Tech outfit' },
];

// ── Dot marker ────────────────────────────────────────────────────────────────

function DotMarker({
  dot,
  item,
  index,
  onHighlight,
  highlighted,
}: {
  dot: { x: number; y: number; itemIndex: number };
  item: OutfitItem | undefined;
  index: number;
  onHighlight: (idx: number | null) => void;
  highlighted: boolean;
}) {
  return (
    <button
      type="button"
      onMouseEnter={() => onHighlight(dot.itemIndex)}
      onMouseLeave={() => onHighlight(null)}
      onClick={() => onHighlight(highlighted ? null : dot.itemIndex)}
      className={`absolute flex items-center justify-center w-7 h-7 rounded-full border-2 text-[10px] font-display font-bold transition-all z-10 ${
        highlighted
          ? 'bg-terra border-terra text-cream scale-110'
          : 'bg-cream/90 border-ink text-ink hover:bg-terra hover:border-terra hover:text-cream hover:scale-105'
      }`}
      style={{
        left: `calc(${dot.x}% - 14px)`,
        top: `calc(${dot.y}% - 14px)`,
      }}
    >
      {index + 1}

      {/* Tooltip */}
      {item && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none whitespace-nowrap bg-ink text-cream text-[10px] px-2.5 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
          style={{ opacity: highlighted ? 1 : 0 }}
        >
          {item.name} — ${item.priceUSD}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-ink" />
        </span>
      )}
    </button>
  );
}

// ── Outfit Card ───────────────────────────────────────────────────────────────

function OutfitCard({ outfit }: { outfit: Outfit }) {
  const { addToCart, openChatWithProduct, exchangeRate } = useShop();
  const [highlightedItem, setHighlightedItem] = useState<number | null>(null);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [addedAll, setAddedAll] = useState(false);

  const total = outfit.items.reduce((s, it) => s + it.priceUSD, 0);
  const totalFC = Math.round(total * exchangeRate).toLocaleString('fr-FR');

  const handleOrderOutfit = () => {
    // Ajouter les articles liés au panier
    outfit.items.forEach((it) => {
      if (it.productId) {
        addToCart({ productId: it.productId, quantity: 1 });
      }
    });
    // Ouvrir le chat avec le contexte de l'outfit
    openChatWithProduct({
      productName: `Outfit "${outfit.name}" (${outfit.items.length} articles)`,
      productSlug: '',
      priceUSD: total,
      qty: 1,
    });
  };

  const handleAddItem = (item: OutfitItem) => {
    if (!item.productId) return;
    addToCart({ productId: item.productId, quantity: 1 });
    setAddedAll(false);
  };

  const handleAddAll = () => {
    outfit.items.forEach((it) => {
      if (it.productId) addToCart({ productId: it.productId, quantity: 1 });
    });
    setAddedAll(true);
    setTimeout(() => setAddedAll(false), 2000);
  };

  return (
    <div className="bg-cream border border-line rounded-2xl overflow-hidden flex flex-col hover:shadow-md transition-shadow">
      {/* Photo + dot markers */}
      <div className="relative overflow-hidden bg-bone" style={{ aspectRatio: '3/4' }}>
        {outfit.photos[photoIdx] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={outfit.photos[photoIdx]}
            alt={outfit.name}
            className="w-full h-full object-cover transition-transform duration-500 hover:scale-[1.02]"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-7xl opacity-15">
            👗
          </div>
        )}

        {/* Badge */}
        {outfit.badge && (
          <span className={`absolute top-3 left-3 text-[9px] font-display font-bold tracking-widest uppercase px-2.5 py-1 rounded-md z-10 ${
            outfit.badgeType === 'promo'
              ? 'bg-terra text-cream'
              : 'bg-ink text-cream'
          }`}>
            {outfit.badge}
          </span>
        )}

        {/* Galerie miniatures (si plusieurs photos) */}
        {outfit.photos.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
            {outfit.photos.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setPhotoIdx(i)}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  i === photoIdx ? 'bg-cream scale-125' : 'bg-cream/50 hover:bg-cream/80'
                }`}
              />
            ))}
          </div>
        )}

        {/* Dot markers */}
        {photoIdx === 0 && outfit.dots.map((dot, i) => (
          <DotMarker
            key={i}
            dot={dot}
            item={outfit.items[dot.itemIndex]}
            index={i}
            onHighlight={setHighlightedItem}
            highlighted={highlightedItem === dot.itemIndex}
          />
        ))}
      </div>

      {/* Infos outfit */}
      <div className="p-4 flex flex-col flex-1">
        <div className="font-display font-extrabold text-base text-ink leading-tight">{outfit.name}</div>
        <div className="font-display text-[10px] tracking-[0.15em] uppercase text-muted mt-0.5 mb-4">
          {outfit.season} · {OUTFIT_CATEGORY_LABEL[outfit.cat]}
        </div>

        {/* Items list */}
        <div className="flex-1 space-y-0 border-t border-line">
          {outfit.items.map((item, idx) => (
            <div
              key={item.id}
              className={`flex items-center gap-3 py-2.5 border-b border-line/60 transition-colors ${
                highlightedItem === idx ? 'bg-terra/5 -mx-1 px-1 rounded' : ''
              }`}
            >
              {/* Numéro */}
              <div className="w-5 h-5 rounded-full bg-terra text-cream text-[9px] font-display font-bold flex items-center justify-center shrink-0">
                {idx + 1}
              </div>

              {/* Emoji ou image */}
              <div className="shrink-0">
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.imageUrl} alt="" className="w-8 h-8 rounded-md object-cover border border-line" />
                ) : (
                  <span className="text-base">
                    {OUTFIT_ITEM_CATEGORY_EMOJI[item.category] ?? '📦'}
                  </span>
                )}
              </div>

              {/* Nom + catégorie */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  {item.productSlug ? (
                    <Link
                      href={`/produit/${item.productSlug}`}
                      className="font-medium text-sm text-ink hover:text-terra transition-colors truncate"
                    >
                      {item.name}
                    </Link>
                  ) : (
                    <span className="font-medium text-sm text-ink truncate">{item.name}</span>
                  )}
                  {!item.productId && (
                    <span className="shrink-0 text-[8px] bg-terra/10 text-terra border border-terra/20 px-1.5 py-0.5 rounded font-display font-bold tracking-widest uppercase">
                      Pré-commande
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-muted">{item.category}</span>
              </div>

              {/* Prix */}
              <div className="font-display font-bold text-sm text-terra shrink-0">
                ${item.priceUSD}
              </div>

              {/* Bouton + panier (si lié à un produit) */}
              {item.productId && (
                <button
                  type="button"
                  onClick={() => handleAddItem(item)}
                  className="w-7 h-7 rounded-lg border border-line bg-bone hover:bg-terra hover:border-terra hover:text-cream text-ink flex items-center justify-center text-sm transition-all shrink-0"
                  title={`Ajouter ${item.name} au panier`}
                >
                  +
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Total + CTA */}
        <div className="mt-4 pt-4 border-t-2 border-line">
          <div className="flex items-end justify-between mb-3">
            <div>
              <div className="font-display text-[10px] tracking-widest uppercase text-muted font-semibold">
                Total look
              </div>
              <div className="text-[11px] text-muted">{totalFC} FC</div>
            </div>
            <div className="font-display font-extrabold text-xl text-ink">${total}</div>
          </div>

          <button
            type="button"
            onClick={handleAddAll}
            className="w-full py-2.5 mb-2 rounded-xl border-2 border-ink text-ink font-display text-[11px] font-semibold tracking-widest uppercase hover:bg-ink hover:text-cream transition-colors"
          >
            {addedAll ? '✓ Ajouté au panier' : '+ Ajouter l\'outfit au panier'}
          </button>

          <button
            type="button"
            onClick={handleOrderOutfit}
            className="w-full py-3 rounded-xl bg-terra hover:bg-terra-dark text-cream font-display text-[11px] font-bold tracking-widest uppercase transition-colors flex items-center justify-center gap-2"
          >
            💬 Commander via le chat
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function ShowroomPage() {
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [filter, setFilter] = useState<OutfitCategory | 'all'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribePublishedOutfits((data) => {
      setOutfits(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  const filtered = filter === 'all' ? outfits : outfits.filter((o) => o.cat === filter);

  return (
    <>
      {/* Hero */}
      <div className="max-w-7xl mx-auto px-6 lg:px-10 pt-12 pb-6 flex items-end justify-between">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-px bg-terra" />
            <span className="font-display text-[11px] tracking-[0.15em] uppercase text-terra font-semibold">
              Sélection éditoriale
            </span>
          </div>
          <h1 className="font-display font-extrabold text-5xl md:text-6xl text-ink tracking-[-2px] leading-[0.9]">
            SHOW<br />
            <em className="text-terra not-italic">ROOM.</em>
          </h1>
        </div>
        <div className="text-right hidden md:block">
          <div className="font-display font-extrabold text-4xl text-ink">
            {outfits.length}
          </div>
          <div className="text-sm text-muted">looks disponibles</div>
          <div className="text-xs text-muted/60 mt-0.5">Kinshasa · 2026</div>
        </div>
      </div>

      {/* Filtres */}
      <div className="max-w-7xl mx-auto px-6 lg:px-10 pb-8">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {FILTER_CATS.map(({ val, label }) => (
            <button
              key={val}
              type="button"
              onClick={() => setFilter(val)}
              className={`shrink-0 font-display text-[11px] tracking-widest uppercase font-semibold px-4 py-2 rounded-full border transition-colors ${
                filter === val
                  ? 'bg-ink text-cream border-ink'
                  : 'bg-cream border-line text-muted hover:border-ink hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid masonry */}
      <div className="max-w-7xl mx-auto px-6 lg:px-10 pb-20">
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl bg-bone animate-pulse" style={{ aspectRatio: '3/4' }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center">
            <div className="text-5xl mb-4 opacity-20">👗</div>
            <p className="text-muted text-sm">
              {outfits.length === 0
                ? 'Le showroom arrive bientôt. Revenez dans quelques jours !'
                : 'Aucun outfit dans cette catégorie.'}
            </p>
          </div>
        ) : (
          /* CSS columns masonry (comme le HTML original) */
          <div
            className="gap-5"
            style={{
              columns: 'calc(33.333% - 14px) 3',
              columnGap: '20px',
            }}
          >
            {filtered.map((outfit) => (
              <div key={outfit.id} style={{ breakInside: 'avoid', marginBottom: '20px' }}>
                <OutfitCard outfit={outfit} />
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
