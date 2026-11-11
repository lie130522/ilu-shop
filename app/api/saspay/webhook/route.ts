// POST /api/saspay/webhook — messages automatiques de SasPay (tableau de bord → Webhooks).
// Signature vérifiée sur le corps BRUT ; ensuite on ne fait pas confiance au contenu : on redemande
// l'état réel à SasPay avant de valider (syncPayment).
// Réponse 500 en cas de problème de notre côté → SasPay réessaie (+30 s, +5 min, +30 min, +2 h).

import { NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/saspay-webhook';
import { findByProviderId, syncPayment } from '@/lib/payments-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const raw = await request.text();
  const secret = process.env.SASPAY_WEBHOOK_SECRET ?? '';
  if (!secret) {
    console.error('[saspay-webhook] SASPAY_WEBHOOK_SECRET manquante');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
  }

  const valid = verifyWebhookSignature(
    raw,
    request.headers.get('x-webhook-signature'),
    request.headers.get('x-webhook-timestamp'),
    secret,
  );
  if (!valid) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });

  let event: { event?: string; data?: { id?: string } };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const type = event.event ?? request.headers.get('x-webhook-event') ?? '';
  const providerId = event.data?.id;
  if (!type.startsWith('transaction.') || !providerId) return NextResponse.json({ ok: true, ignored: true });

  try {
    const paymentId = await findByProviderId(providerId);
    if (!paymentId) return NextResponse.json({ ok: true, unknown: true });
    const synced = await syncPayment(paymentId);
    return NextResponse.json({ ok: true, status: synced?.status ?? null });
  } catch (err) {
    console.error('[saspay-webhook] failed:', err);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}
