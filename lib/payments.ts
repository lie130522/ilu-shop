// ─── ILU SHOP — Paiement SasPay : logique pure (serveur ET écran) ─────────────
// Reprise de l'intégration éprouvée de matchmyjob (paiement réel du 2026-11-11).
// Aucun import à l'exécution : testable directement avec Node.
//
// Périmètre ILU SHOP : Mobile Money RDC en dollars (pays SasPay « XC ») + carte (pays « XX »).
// Les frais SasPay sont payés par le client (mode « ajoutés ») et affichés moyen par moyen.

export type PaymentKind = 'mobile_money' | 'card';
export type FeeMode = 'ADD_ON' | 'DEDUCTED';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'expired';

/** Tranche de tarif renvoyée par GET /pricing/my-rates/ de SasPay. */
export interface FeeTier {
  min_amount: string | null;
  max_amount: string | null;
  currency: string;
  percent: string | null;
  fixed: string | null;
  floor_amount: string | null;
  cap_amount: string | null;
  fee_charge_mode: FeeMode;
}

/** Ligne du catalogue SasPay : un réseau dans un pays, avec sa devise et ses tarifs. */
export interface RateEntry {
  network_code: string;
  currency: string;
  /** XC = RDC en dollars, XX = carte, CD = RDC en francs… */
  country_code?: string;
  country_name?: string;
  network_name?: string;
  payin: { available: boolean; otp_required?: boolean; otp_instructions?: string | null; tiers: FeeTier[] } | null;
}

/** Tarifs relevés sur le tableau de bord SasPay d'ILU SHOP le 2026-11-11 : secours si SasPay ne répond pas. */
export const FALLBACK_RATES: readonly RateEntry[] = [
  { network_code: 'vodacom_cd_usd', country_code: 'XC', currency: 'USD', network_name: 'Vodacom M-Pesa', payin: { available: true, tiers: [tier('4.2', '0', '0.03')] } },
  { network_code: 'airtel_cd_usd', country_code: 'XC', currency: 'USD', network_name: 'Airtel Money', payin: { available: true, tiers: [tier('4.7', '0', '0.03')] } },
  { network_code: 'orange_cd_usd', country_code: 'XC', currency: 'USD', network_name: 'Orange Money', payin: { available: true, tiers: [tier('4.7', '0', '0.03')] } },
  { network_code: 'card', country_code: 'XX', currency: 'USD', network_name: 'Carte bancaire', payin: { available: true, tiers: [tier('8.0', '0.5', '0.55')] } },
];

function tier(percent: string, fixed: string, floor: string): FeeTier {
  return {
    min_amount: '0.5', max_amount: '50000', currency: 'USD', percent, fixed,
    floor_amount: floor, cap_amount: null, fee_charge_mode: 'ADD_ON',
  };
}

const toCents = (v: string | number | null | undefined): number => Math.round(Number(v ?? 0) * 100);

// ── Moyens proposés ───────────────────────────────────────────────────────────

export interface PaymentMethod {
  network: string;
  kind: PaymentKind;
  /** Pays au sens SasPay, envoyé avec le paiement. */
  country: 'XC' | 'XX';
  currency: 'USD';
  label: string;
  /** Code demandé par l'opérateur AVANT l'envoi (non géré : ces réseaux sont écartés). */
  otpRequired: boolean;
}

const LABELS: Readonly<Record<string, string>> = {
  vodacom_cd_usd: 'M-Pesa',
  airtel_cd_usd: 'Airtel Money',
  orange_cd_usd: 'Orange Money',
  card: 'Carte bancaire',
};

export function kindOf(network: string): PaymentKind {
  return network === 'card' ? 'card' : 'mobile_money';
}

function usable(e: RateEntry): boolean {
  return !!e.payin?.available && (e.payin.tiers?.length ?? 0) > 0 && !e.payin.otp_required;
}

/** Moyens ILU SHOP : Mobile Money RDC en dollars + carte. Tout vient de la liste SasPay. */
export function methodsFrom(rates: readonly RateEntry[]): PaymentMethod[] {
  return rates
    .filter((e) => usable(e) && e.currency === 'USD' && (e.network_code === 'card' || e.country_code === 'XC'))
    .map((e) => ({
      network: e.network_code,
      kind: kindOf(e.network_code),
      country: e.network_code === 'card' ? 'XX' : 'XC',
      currency: 'USD',
      label: LABELS[e.network_code] ?? e.network_name ?? e.network_code,
      otpRequired: false,
    }));
}

// ── Frais ─────────────────────────────────────────────────────────────────────

export function tierFor(entry: RateEntry | undefined, amount: number): FeeTier | null {
  if (!entry?.payin?.available) return null;
  const v = toCents(amount);
  return entry.payin.tiers.find((t) =>
    (t.min_amount == null || v >= toCents(t.min_amount)) &&
    (t.max_amount == null || v <= toCents(t.max_amount)),
  ) ?? null;
}

/**
 * Frais SasPay en centimes : pourcentage + fixe, avec minimum et plafond éventuels, arrondi au
 * centime SUPÉRIEUR comme SasPay (constaté : 4,7 % de 2,00 $ = 0,094 $ → 0,10 $ prélevés).
 */
export function feeCents(amountCents: number, t: FeeTier): number {
  let fee = Math.ceil((amountCents * Number(t.percent ?? 0)) / 100 + toCents(t.fixed) - 1e-9);
  if (t.floor_amount != null) fee = Math.max(fee, toCents(t.floor_amount));
  if (t.cap_amount != null) fee = Math.min(fee, toCents(t.cap_amount));
  return Math.max(0, fee);
}

/**
 * Frais que l'OPÉRATEUR prélève en plus sur le compte du client, hors SasPay : estimation (« ≈ »).
 * Constat matchmyjob : SasPay a demandé 2,10 $, Orange Money a débité 2,20 $ (≈ même % que SasPay).
 */
export const OPERATOR_FEE_ESTIMATE_PERCENT: Readonly<Record<string, number>> = {
  vodacom_cd_usd: 4.2,
  airtel_cd_usd: 4.7,
  orange_cd_usd: 4.7,
};

export function operatorFeeEstimate(network: string, sentAmount: number, sasPercent?: number): number {
  if (kindOf(network) !== 'mobile_money') return 0;
  const pct = OPERATOR_FEE_ESTIMATE_PERCENT[network] ?? sasPercent ?? 0;
  if (!pct) return 0;
  return Math.ceil((toCents(sentAmount) * pct) / 100 - 1e-9) / 100;
}

export interface Quote {
  network: string;
  kind: PaymentKind;
  label: string;
  country: 'XC' | 'XX';
  currency: 'USD';
  available: boolean;
  /** Montant de la commande. */
  amount: number;
  /** Frais SasPay : exacts. */
  fee: number;
  /** Montant demandé par SasPay (commande + frais) : c'est ce qu'affiche le téléphone. */
  total: number;
  /** Ce qu'ILU SHOP reçoit. */
  net: number;
  feeMode: FeeMode;
  /** Frais propres de l'opérateur : estimation (0 pour la carte). */
  operatorFee: number;
  /** Ce que le client verra probablement débité au total. */
  estimatedTotal: number;
}

export function quote(amount: number, method: PaymentMethod, rates: readonly RateEntry[]): Quote {
  const entry = rates.find((r) => r.network_code === method.network && r.currency === method.currency);
  const t = tierFor(entry, amount);
  const amountCents = toCents(amount);
  const base = {
    network: method.network, kind: method.kind, label: method.label,
    country: method.country, currency: method.currency, amount,
  };
  if (!t) {
    return { ...base, available: false, fee: 0, total: amount, net: amount, feeMode: 'ADD_ON', operatorFee: 0, estimatedTotal: amount };
  }
  const fee = feeCents(amountCents, t);
  const addOn = t.fee_charge_mode !== 'DEDUCTED';
  const totalCents = addOn ? amountCents + fee : amountCents;
  const operatorFee = operatorFeeEstimate(method.network, totalCents / 100, Number(t.percent ?? 0));
  return {
    ...base,
    available: true,
    fee: fee / 100,
    total: totalCents / 100,
    net: (addOn ? amountCents : amountCents - fee) / 100,
    feeMode: addOn ? 'ADD_ON' : 'DEDUCTED',
    operatorFee,
    estimatedTotal: (totalCents + toCents(operatorFee)) / 100,
  };
}

/** Devis disponibles, du moins cher au plus cher pour le client (frais d'opérateur compris). */
export function quotesFor(amount: number, rates: readonly RateEntry[]): Quote[] {
  return methodsFrom(rates)
    .map((m) => quote(amount, m, rates))
    .filter((q) => q.available)
    .sort((a, b) => a.estimatedTotal - b.estimatedTotal);
}

// ── Numéros RDC ───────────────────────────────────────────────────────────────

/** Numéro RDC au format SasPay (243 + 9 chiffres commençant par 8 ou 9), ou null. */
export function normalizeDrcPhone(input: string): string | null {
  let d = input.trim().replace(/[\s.\-()]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  else if (d.startsWith('00')) d = d.slice(2);
  if (!/^\d+$/.test(d)) return null;
  let national = d;
  if (d.startsWith('243') && d.length === 12) national = d.slice(3);
  else if (d.startsWith('0') && d.length === 10) national = d.slice(1);
  if (national.length !== 9 || !/^[89]/.test(national)) return null;
  return `243${national}`;
}

/** Les 3 derniers chiffres seulement (on ne garde pas le numéro complet). */
export function phoneHint(phone: string): string {
  return phone.slice(-3);
}

// ── Divers ────────────────────────────────────────────────────────────────────

export function outcomeOf(providerStatus: string | null | undefined): 'paid' | 'failed' | 'pending' {
  const s = (providerStatus ?? '').toUpperCase();
  if (s === 'SUCCESS' || s === 'SUCCEEDED' || s === 'PAID' || s === 'COMPLETED') return 'paid';
  if (s === 'FAILED' || s === 'CANCELLED' || s === 'CANCELED' || s === 'EXPIRED' || s === 'REJECTED') return 'failed';
  return 'pending';
}

/** Clé de session : consignes de l'opérateur pour l'écran d'attente ; sa présence autorise à vider le panier. */
export const PAYMENT_HINT_KEY = (paymentId: string) => `ilu_pay_${paymentId}`;

/** Montant au format SasPay : chaîne à 2 décimales, jamais un flottant. */
export function toAmountString(amount: number): string {
  return (toCents(amount) / 100).toFixed(2);
}

/** Lignes de panier envoyées par le navigateur (le prix n'en fait jamais partie). */
export interface CartLineInput {
  productId: string;
  quantity: number;
  size?: string;
  color?: string;
}

/** Infos de livraison saisies à l'étape 2 du tunnel. */
export interface DeliveryInput {
  name: string;
  phone: string;
  address: string;
  city: string;
  neighborhood: string;
}
