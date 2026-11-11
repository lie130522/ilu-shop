// POST /api/payments/reconcile — rattrapage des paiements en attente (client parti + webhook perdu).
// Appelé par l'écran admin « Commandes » (jeton d'un admin), ou par un planificateur avec
// Authorization: Bearer <CRON_SECRET>.

import { NextResponse } from 'next/server';
import { saspayConfigured } from '@/lib/saspay';
import { authUser, isAdminUid, reconcilePending } from '@/lib/payments-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const byCron = !!cronSecret && request.headers.get('authorization') === `Bearer ${cronSecret}`;
  if (!byCron) {
    const user = await authUser(request);
    if (!user || !(await isAdminUid(user.uid))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!saspayConfigured()) return NextResponse.json({ checked: 0, paid: 0, errors: 0, configured: false });

  try {
    return NextResponse.json(await reconcilePending());
  } catch (err) {
    console.error('[payments/reconcile] failed:', err);
    return NextResponse.json({ error: 'Reconcile failed' }, { status: 500 });
  }
}
