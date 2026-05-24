'use client';

import { useShop } from './ShopProvider';

export function CurrencyToggle() {
  const { currency, setCurrency } = useShop();
  return (
    <div className="inline-flex items-center rounded-full border border-line bg-cream p-0.5 text-[11px] font-display font-semibold tracking-widest">
      <button
        type="button"
        onClick={() => setCurrency('USD')}
        className={`px-3 py-1 rounded-full transition-colors duration-200 ${
          currency === 'USD' ? 'bg-ink text-cream' : 'text-muted hover:text-ink'
        }`}
        aria-pressed={currency === 'USD'}
      >
        USD
      </button>
      <button
        type="button"
        onClick={() => setCurrency('CDF')}
        className={`px-3 py-1 rounded-full transition-colors duration-200 ${
          currency === 'CDF' ? 'bg-ink text-cream' : 'text-muted hover:text-ink'
        }`}
        aria-pressed={currency === 'CDF'}
      >
        CDF
      </button>
    </div>
  );
}
