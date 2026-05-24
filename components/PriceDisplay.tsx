'use client';

import { useShop } from './ShopProvider';
import { formatCDF, formatUSD, usdToCdf } from '@/lib/currency';

type Size = 'sm' | 'md' | 'lg' | 'xl';

const sizeMap = {
  sm: { primary: 'text-sm', secondary: 'text-[10px]' },
  md: { primary: 'text-lg', secondary: 'text-xs' },
  lg: { primary: 'text-2xl', secondary: 'text-sm' },
  xl: { primary: 'text-4xl md:text-5xl', secondary: 'text-base' },
};

interface PriceDisplayProps {
  usd: number;
  oldUsd?: number;
  size?: Size;
  inline?: boolean;
}

export function PriceDisplay({ usd, oldUsd, size = 'md', inline = false }: PriceDisplayProps) {
  const { currency } = useShop();
  const s = sizeMap[size];

  const primary = currency === 'USD' ? formatUSD(usd) : formatCDF(usdToCdf(usd));
  const secondary = currency === 'USD' ? formatCDF(usdToCdf(usd)) : formatUSD(usd);

  if (inline) {
    return (
      <span className="inline-flex items-baseline gap-2">
        <span className={`font-display font-bold text-terra ${s.primary}`}>{primary}</span>
        <span className={`font-medium text-gold ${s.secondary}`}>/ {secondary}</span>
        {oldUsd && (
          <span className={`font-light text-muted line-through ${s.secondary}`}>
            {currency === 'USD' ? formatUSD(oldUsd) : formatCDF(usdToCdf(oldUsd))}
          </span>
        )}
      </span>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-baseline gap-3">
        <span className={`font-display font-bold text-terra leading-none ${s.primary}`}>
          {primary}
        </span>
        {oldUsd && (
          <span className={`font-light text-muted line-through ${s.secondary}`}>
            {currency === 'USD' ? formatUSD(oldUsd) : formatCDF(usdToCdf(oldUsd))}
          </span>
        )}
      </div>
      <span className={`font-medium text-gold ${s.secondary} mt-1`}>≈ {secondary}</span>
    </div>
  );
}
