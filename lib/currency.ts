import type { Currency } from './types';

export const USD_TO_CDF_RATE = 2000;
export const RATE_UPDATED_AT = '24/05/2026';

export function usdToCdf(usd: number): number {
  return Math.round(usd * USD_TO_CDF_RATE);
}

export function formatUSD(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function formatCDF(amount: number): string {
  return `${amount.toLocaleString('fr-FR').replace(/ /g, ' ')} FC`;
}

export function formatPrice(usd: number, currency: Currency = 'USD'): string {
  return currency === 'USD' ? formatUSD(usd) : formatCDF(usdToCdf(usd));
}
