// GET /api/payments/[id] — état d'un paiement, interrogé régulièrement par l'écran d'attente.
// À chaque appel, l'état réel est redemandé à SasPay ; s'il est payé, la commande est validée (une seule fois).

import { NextResponse } from 'next/server';
import { kindOf, operatorFeeEstimate } from '@/lib/payments';
import { adminDb } from '@/lib/firebase/admin';
import { authUser, syncPayment, type PaymentDoc } from '@/lib/payments-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const user = await authUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!/^[A-Za-z0-9]{10,40}$/.test(params.id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let payment: PaymentDoc | null;
  try {
    const snap = await adminDb().collection('payments').doc(params.id).get();
    payment = snap.exists ? ({ ...(snap.data() as PaymentDoc), id: snap.id }) : null;
  } catch (err) {
    console.error('[payments/id] lecture impossible:', err);
    return NextResponse.json({ error: 'Payment status unavailable' }, { status: 503 });
  }
  if (!payment || payment.uid !== user.uid) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    payment = (await syncPayment(payment.id)) ?? payment;
  } catch (err) {
    console.error('[payments/id] sync failed:', err);
  }

  return NextResponse.json({
    status: payment.status,
    amount: payment.amount,
    fee: payment.expectedFee,
    total: payment.expectedTotal,
    operatorFee: operatorFeeEstimate(payment.network, payment.expectedTotal),
    network: payment.network,
    networkLabel: payment.networkLabel,
    kind: kindOf(payment.network),
    phoneHint: payment.phoneHint,
    charged: payment.chargedAmount,
    itemsLabel: payment.itemsLabel,
    orderId: payment.orderId,
    createdAt: payment.createdAt,
    expiresAt: payment.expiresAt,
    paidAt: payment.paidAt,
  });
}
