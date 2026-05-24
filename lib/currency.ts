import type { Currency } from './types';

// Taux de secours — utilisé si Firestore n'est pas encore chargé.
// La source de vérité est Firestore shop_settings/default.exchangeRate (P11).
export const USD_TO_CDF_RATE = 2000;

// Taux dynamique : accepte un taux optionnel, utilise le fallback sinon.
export function usdToCdf(usd: number, rate: number = USD_TO_CDF_RATE): number {
  return Math.round(usd * rate);
}

export function formatUSD(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function formatCDF(amount: number): string {
  return `${amount.toLocaleString('fr-FR').replace(/ /g, ' ')} FC`;
}

export function formatPrice(usd: number, currency: Currency = 'USD', rate: number = USD_TO_CDF_RATE): string {
  return currency === 'USD' ? formatUSD(usd) : formatCDF(usdToCdf(usd, rate));
}
