// ─── ILU SHOP — Saspay Webhook ───────────────────────────────────────────────
// POST /api/webhooks/saspay
// Reçoit les événements Saspay et met à jour le statut des commandes.
//
// Pour activer la mise à jour Firestore server-side :
//   npm install firebase-admin
//   Configurer FIREBASE_SERVICE_ACCOUNT_KEY dans .env.local
//   (ou utiliser Application Default Credentials sur Firebase App Hosting)

import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';

export const runtime = 'nodejs';

interface SaspayEvent {
  event: string;
  data: {
    id?: string;
    metadata?: { order_id?: string };
    amount?: number;
    currency?: string;
    status?: string;
  };
}

function verifySignature(secret: string, timestamp: string, rawBody: string, signature: string): boolean {
  const payload = `${timestamp}.${rawBody}`;
  const expected = createHmac('sha256', secret).update(payload).digest('hex');
  try {
    const sigBuf = Buffer.from(signature, 'hex');
    const expBuf = Buffer.from(expected, 'hex');
    return sigBuf.length === expBuf.length && timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-webhook-signature') ?? '';
    const timestamp = req.headers.get('x-webhook-timestamp') ?? '';

    const webhookSecret = process.env.SASPAY_WEBHOOK_SECRET;

    if (webhookSecret) {
      if (!signature || !timestamp) {
        return NextResponse.json({ error: 'Signature manquante.' }, { status: 400 });
      }
      if (!verifySignature(webhookSecret, timestamp, rawBody, signature)) {
        return NextResponse.json({ error: 'Signature invalide.' }, { status: 401 });
      }
    } else {
      console.warn('[saspay-webhook] SASPAY_WEBHOOK_SECRET non configurée — vérification ignorée');
    }

    const event = JSON.parse(rawBody) as SaspayEvent;
    const orderId = event.data?.metadata?.order_id;

    console.log('[saspay-webhook] event:', event.event, '| order:', orderId);

    if (event.event === 'transaction.success' && orderId) {
      // TODO: Mettre à jour le statut de la commande Firestore en 'paid'
      // Nécessite firebase-admin. Exemple :
      //
      //   import { getFirestore } from 'firebase-admin/firestore';
      //   const adminDb = getFirestore();
      //   await adminDb.collection('orders').doc(orderId).update({
      //     status: 'paid',
      //     paymentRef: event.data.id,
      //     paidAt: new Date().toISOString(),
      //   });
      //
      // En attendant, les commandes Saspay sont visibles en admin avec status 'open'.
      console.log('[saspay-webhook] paiement confirmé pour commande:', orderId, '| montant:', event.data.amount, event.data.currency);
    }

    if (event.event === 'transaction.failed' && orderId) {
      console.log('[saspay-webhook] paiement échoué pour commande:', orderId);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('[saspay-webhook] erreur:', err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}
