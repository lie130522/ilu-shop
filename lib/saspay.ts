// ─── ILU SHOP — Client de l'API SasPay (https://docs.saspay.me) ───────────────
// SERVEUR UNIQUEMENT : utilise SASPAY_SECRET_KEY (portée « Encaissement » : aucun retrait possible).
// Réponses SasPay : enveloppe { success, data, code } ; montants en chaînes décimales (« 2.00 »).
// Reprise de lib/saspay.ts de matchmyjob.

import { FALLBACK_RATES, type RateEntry } from '@/lib/payments';

const apiBase = () => process.env.SASPAY_API_BASE || 'https://api.saspay.me/api/v1';

/** Vrai si une vraie clé SasPay est configurée (sk_live_… ou sk_test_…). */
export function saspayConfigured(): boolean {
  return /^sk_(live|test)_/.test(process.env.SASPAY_SECRET_KEY ?? '');
}

function secretKey(): string {
  const key = process.env.SASPAY_SECRET_KEY;
  if (!key || !saspayConfigured()) throw new Error('SASPAY_SECRET_KEY manquante');
  return key;
}

interface Envelope<T> {
  success?: boolean;
  data?: T;
  code?: number | string;
  message?: string;
  error?: { code?: string; message?: string };
}

interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  errorCode: string | null;
  error: string | null;
}

async function request<T>(
  path: string,
  init: { method?: 'GET' | 'POST'; body?: unknown; idempotencyKey?: string } = {},
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { Authorization: `Bearer ${secretKey()}`, Accept: 'application/json' };
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  if (init.idempotencyKey) headers['Idempotency-Key'] = init.idempotencyKey;
  const res = await fetch(apiBase() + path, {
    method: init.method ?? 'GET',
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  });
  const json = (await res.json().catch(() => null)) as (Envelope<T> & Record<string, unknown>) | null;
  const env: Envelope<T> = json ?? {};
  const data = json && 'data' in json ? (env.data ?? null) : ((json as unknown as T) ?? null);
  const rawCode = env.error?.code ?? (typeof env.code === 'string' ? env.code : null);
  return {
    ok: res.ok,
    status: res.status,
    data,
    errorCode: res.ok ? null : rawCode,
    error: res.ok ? null : (env.error?.message ?? env.message ?? `HTTP ${res.status}`),
  };
}

// ── Tarifs (gardés 1 h en mémoire ; tarifs de secours si SasPay ne répond pas) ─

let ratesCache: { at: number; rates: readonly RateEntry[] } | null = null;

export async function getPayinRates(): Promise<readonly RateEntry[]> {
  if (ratesCache && Date.now() - ratesCache.at < 3_600_000) return ratesCache.rates;
  try {
    const r = await request<RateEntry[]>('/pricing/my-rates/');
    const list = Array.isArray(r.data) ? r.data : null;
    if (r.ok && list && list.length > 0) {
      ratesCache = { at: Date.now(), rates: list };
      return list;
    }
    console.error('[saspay] my-rates indisponible:', r.status, r.errorCode, r.error);
  } catch (err) {
    console.error('[saspay] my-rates failed:', err);
  }
  return FALLBACK_RATES;
}

// ── Paiement direct (« softpay ») : demande sur le téléphone, ou page de paiement à ouvrir ─

export interface SoftpayInput {
  amount: string;
  currency: string;
  country: string;
  network: string;
  description: string;
  customer: { email: string; first_name: string; last_name: string; phone: string };
  returnUrl: string;
  metadata: Record<string, string>;
  /** Même clé à chaque nouvel essai de la même demande : SasPay ne la poussera qu'une fois. */
  idempotencyKey: string;
}

export interface SoftpayResult {
  ok: boolean;
  id: string | null;
  status: string | null;
  /** Non vide → il FAUT envoyer le client sur cette page (carte, parfois Orange Money). */
  checkoutUrl: string | null;
  instructions: string | null;
  errorCode: string | null;
  error: string | null;
}

export async function softpay(input: SoftpayInput): Promise<SoftpayResult> {
  const r = await request<{ id?: string; status?: string; checkout_url?: string; instructions?: string }>(
    '/payments/softpay/',
    {
      method: 'POST',
      idempotencyKey: input.idempotencyKey,
      body: {
        amount: input.amount,
        currency: input.currency,
        country: input.country,
        network: input.network,
        description: input.description,
        customer: input.customer,
        metadata: input.metadata,
        return_url: input.returnUrl,
      },
    },
  );
  return {
    ok: r.ok && !!r.data?.id,
    id: r.data?.id ?? null,
    status: r.data?.status ?? null,
    checkoutUrl: r.data?.checkout_url || null,
    instructions: r.data?.instructions || null,
    errorCode: r.errorCode,
    error: r.error,
  };
}

// ── Vérification : SasPay revérifie l'état réel auprès de l'opérateur avant de répondre ─

export interface VerifiedPayment {
  status: string;
  charged: number | null;
  fee: number | null;
  net: number | null;
  currency: string | null;
}

const num = (v: string | number | null | undefined): number | null =>
  v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v);

export async function verifyPayment(providerId: string): Promise<VerifiedPayment | null> {
  const r = await request<{
    status?: string;
    debited_amount?: string;
    client_fee?: string;
    net_amount?: string;
    currency?: string;
  }>(`/payments/${encodeURIComponent(providerId)}/verify/`);
  if (!r.ok || !r.data?.status) return null;
  return {
    status: r.data.status,
    charged: num(r.data.debited_amount),
    fee: num(r.data.client_fee),
    net: num(r.data.net_amount),
    currency: r.data.currency ?? null,
  };
}
