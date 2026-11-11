// ─── ILU SHOP — Vérification des webhooks SasPay (SERVEUR UNIQUEMENT) ─────────
// Signature = HMAC-SHA256 (hexadécimal) de « horodatage + '.' + corps brut », avec SASPAY_WEBHOOK_SECRET.
// Un message de plus de 5 minutes est refusé : sinon un message intercepté resterait rejouable.

import { createHmac, timingSafeEqual } from 'node:crypto';

export const WEBHOOK_MAX_AGE_SECONDS = 300;

export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
  timestamp: string | null,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): boolean {
  if (!signature || !timestamp || !secret) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowSeconds - ts) > WEBHOOK_MAX_AGE_SECONDS) return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  const a = Buffer.from(signature.trim().toLowerCase(), 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}
