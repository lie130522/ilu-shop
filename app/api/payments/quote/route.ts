// POST /api/payments/quote — moyens SasPay disponibles pour ce panier, avec frais et totaux exacts.
// Sans connexion : indique seulement si le paiement SasPay est ouvert (pour inviter à se connecter).

import { NextResponse } from 'next/server';
import { quotesFor } from '@/lib/payments';
import { getPayinRates, saspayConfigured } from '@/lib/saspay';
import { authUser, priceCart, saspayEnabledFor, saspayPublic } from '@/lib/payments-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const user = await authUser(request);
  if (!user) return NextResponse.json({ enabled: saspayPublic(), requiresLogin: true });

  if (!(await saspayEnabledFor(user.uid))) return NextResponse.json({ enabled: false });
  if (!saspayConfigured()) return NextResponse.json({ enabled: true, configured: false });

  let body: { items?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }

  try {
    const priced = await priceCart(body.items);
    if (!priced.ok) return NextResponse.json({ error: priced.error, code: 'CART_INVALID' }, { status: 422 });
    const quotes = quotesFor(priced.amount, await getPayinRates());
    return NextResponse.json({ enabled: true, configured: true, amount: priced.amount, quotes });
  } catch (err) {
    console.error('[payments/quote] failed:', err);
    return NextResponse.json({ error: 'Paiement indisponible pour le moment.' }, { status: 503 });
  }
}
