// POST /api/payments/start — démarre un paiement SasPay (softpay).
// Le navigateur n'envoie que le panier (sans prix), la livraison, le moyen et le numéro :
// le montant et les frais sont recalculés ici. Rien n'est validé avant la confirmation de SasPay
// (GET /api/payments/[id] ou webhook).

import { NextRequest, NextResponse } from 'next/server';
import { normalizeDrcPhone, phoneHint, quotesFor, toAmountString } from '@/lib/payments';
import { getPayinRates, saspayConfigured, softpay, type SoftpayInput, type SoftpayResult } from '@/lib/saspay';
import { adminDb } from '@/lib/firebase/admin';
import {
  authUser, priceCart, saspayEnabledFor, validDelivery,
  PAYMENT_TTL_MS, type PaymentDoc,
} from '@/lib/payments-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SESSION_RE = /^sess-[A-Za-z0-9-]{6,80}$/;

export async function POST(request: NextRequest) {
  const user = await authUser(request);
  if (!user) return NextResponse.json({ error: 'Connecte-toi pour payer.', code: 'UNAUTHORIZED' }, { status: 401 });
  if (!(await saspayEnabledFor(user.uid))) {
    return NextResponse.json({ error: 'Le paiement Mobile Money n\'est pas encore ouvert.', code: 'PAYMENTS_DISABLED' }, { status: 403 });
  }
  if (!saspayConfigured()) {
    return NextResponse.json({ error: 'SasPay n\'est pas encore configuré.', code: 'NOT_CONFIGURED' }, { status: 503 });
  }

  let body: { items?: unknown; delivery?: unknown; network?: unknown; phone?: unknown; sessionId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Requête invalide.', code: 'INVALID_BODY' }, { status: 400 });
  }

  const delivery = validDelivery(body.delivery);
  if (!delivery) return NextResponse.json({ error: 'Informations de livraison incomplètes.', code: 'INVALID_DELIVERY' }, { status: 400 });
  const sessionId = String(body.sessionId ?? '');
  if (!SESSION_RE.test(sessionId)) return NextResponse.json({ error: 'Session invalide.', code: 'INVALID_SESSION' }, { status: 400 });

  try {
    const priced = await priceCart(body.items);
    if (!priced.ok) return NextResponse.json({ error: priced.error, code: 'CART_INVALID' }, { status: 422 });

    const q = quotesFor(priced.amount, await getPayinRates()).find((x) => x.network === String(body.network ?? ''));
    if (!q) return NextResponse.json({ error: 'Ce moyen de paiement n\'est pas disponible.', code: 'METHOD_UNAVAILABLE' }, { status: 422 });

    let phone: string | null = null;
    if (q.kind === 'mobile_money') {
      phone = normalizeDrcPhone(String(body.phone ?? ''));
      if (!phone) return NextResponse.json({ error: 'Numéro Mobile Money invalide.', code: 'INVALID_PHONE' }, { status: 400 });
    }

    const db = adminDb();
    const payments = db.collection('payments');

    // Anti-doublon (double clic) : même paiement en attente depuis moins de 90 s → renvoyé tel quel.
    const recent = await payments
      .where('uid', '==', user.uid)
      .where('status', '==', 'pending')
      .where('network', '==', q.network)
      .get();
    const since = Date.now() - 90_000;
    const dup = recent.docs
      .map((d) => ({ ...(d.data() as PaymentDoc), id: d.id }))
      .find((p) => p.amount === priced.amount && p.providerPaymentId && Date.parse(p.createdAt) >= since);
    if (dup) return NextResponse.json({ paymentId: dup.id, checkoutUrl: dup.checkoutUrl, instructions: null, kind: q.kind });

    const ref = payments.doc();
    const now = new Date();
    const payment: Omit<PaymentDoc, 'id'> = {
      uid: user.uid,
      email: user.email,
      sessionId,
      items: priced.items,
      itemsLabel: priced.itemsLabel,
      cartSummary: priced.cartSummary,
      delivery,
      amount: priced.amount,
      currency: 'USD',
      network: q.network,
      networkLabel: q.label,
      expectedFee: q.fee,
      expectedTotal: q.total,
      phoneHint: phone ? phoneHint(phone) : null,
      status: 'pending',
      providerPaymentId: null,
      providerStatus: null,
      checkoutUrl: null,
      chargedAmount: null,
      feeAmount: null,
      netAmount: null,
      orderId: null,
      convId: null,
      paidAt: null,
      expiresAt: new Date(now.getTime() + PAYMENT_TTL_MS).toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    await ref.set(payment);

    const names = delivery.name.split(/\s+/).filter(Boolean);
    const origin = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const input: SoftpayInput = {
      amount: toAmountString(priced.amount),
      currency: q.currency,
      // Pays au sens SasPay : XC = RDC en dollars ; XX = carte.
      country: q.country,
      network: q.network,
      description: `ILU SHOP — ${priced.itemsLabel}`.slice(0, 120),
      customer: {
        email: user.email,
        first_name: names[0] ?? 'Client',
        last_name: names.slice(1).join(' ') || 'ILU SHOP',
        // Requis par SasPay même pour la carte (il n'est alors pas utilisé).
        phone: phone ?? '243000000000',
      },
      returnUrl: `${origin}/commande/paiement/${ref.id}`,
      metadata: { payment_id: ref.id, uid: user.uid },
      idempotencyKey: ref.id,
    };

    // Coupure réseau : un seul nouvel essai, avec la même clé anti-doublon.
    let result: SoftpayResult;
    try {
      result = await softpay(input);
    } catch (firstError) {
      console.error('[payments/start] softpay 1er essai:', firstError);
      try {
        result = await softpay(input);
      } catch (secondError) {
        result = { ok: false, id: null, status: null, checkoutUrl: null, instructions: null, errorCode: 'NETWORK_ERROR', error: String(secondError) };
      }
    }

    if (!result.ok || !result.id) {
      await ref.update({ status: 'failed', providerStatus: result.errorCode ?? 'START_FAILED', updatedAt: new Date().toISOString() });
      console.error('[payments/start] softpay échoué:', result.errorCode, result.error);
      return NextResponse.json(
        { error: 'Le paiement n\'a pas pu démarrer. Réessaie ou choisis un autre moyen.', code: result.errorCode ?? 'START_FAILED' },
        { status: 502 },
      );
    }

    await ref.update({
      providerPaymentId: result.id,
      providerStatus: result.status,
      checkoutUrl: result.checkoutUrl,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ paymentId: ref.id, checkoutUrl: result.checkoutUrl, instructions: result.instructions, kind: q.kind });
  } catch (err) {
    console.error('[payments/start] failed:', err);
    return NextResponse.json({ error: 'Paiement indisponible. Réessaie dans un instant.', code: 'PAYMENT_UNAVAILABLE' }, { status: 503 });
  }
}
