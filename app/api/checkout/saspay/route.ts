// ─── ILU SHOP — Saspay Checkout Session ──────────────────────────────────────
// POST /api/checkout/saspay
// Crée une session de paiement Saspay Hosted Checkout et retourne l'URL de redirection.

import { NextRequest, NextResponse } from 'next/server';

interface CheckoutBody {
  orderId: string;
  totalUSD: number;
  description: string;
  successUrl: string;
  cancelUrl: string;
}

interface SaspaySession {
  id: string;
  checkout_url: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as CheckoutBody;
    const { orderId, totalUSD, description, successUrl, cancelUrl } = body;

    if (!orderId || !totalUSD || !successUrl) {
      return NextResponse.json({ error: 'Paramètres manquants.' }, { status: 400 });
    }

    const secretKey = process.env.SASPAY_SECRET_KEY;
    if (!secretKey) {
      console.error('[saspay] SASPAY_SECRET_KEY non configurée');
      return NextResponse.json(
        { error: 'Passerelle de paiement non configurée. Contactez le support.' },
        { status: 503 },
      );
    }

    const res = await fetch('https://api.saspay.me/api/v1/checkout-sessions/', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: totalUSD,
        currency: 'USD',
        country: 'XC',
        description,
        metadata: { order_id: orderId },
        success_url: successUrl,
        cancel_url: cancelUrl,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[saspay] checkout-sessions error:', res.status, errText);
      return NextResponse.json(
        { error: `Erreur Saspay (${res.status}). Réessayez.` },
        { status: res.status >= 500 ? 502 : res.status },
      );
    }

    const data = await res.json() as SaspaySession;
    return NextResponse.json({ sessionId: data.id, checkoutUrl: data.checkout_url });

  } catch (err) {
    console.error('[saspay] route error:', err);
    return NextResponse.json({ error: 'Erreur interne. Réessayez.' }, { status: 500 });
  }
}
