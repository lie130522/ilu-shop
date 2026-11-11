// ─── ILU SHOP — Paiements SasPay côté serveur (SERVEUR UNIQUEMENT) ────────────
// Règle d'or (reprise de matchmyjob) : on ne valide JAMAIS un paiement sur la parole du navigateur
// ou d'un webhook. On redemande l'état réel à SasPay (verifyPayment), puis une transaction Firestore
// passe le paiement à « payé » et crée la commande + le message du chat, une seule fois.
//
// Collection `payments/{id}` : écrite uniquement ici (règles Firestore : write false).

import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { PRODUCTS as SEED_PRODUCTS } from '@/lib/products';
import { formatUSD } from '@/lib/currency';
import { outcomeOf, type CartLineInput, type DeliveryInput, type PaymentStatus } from '@/lib/payments';
import { verifyPayment, type VerifiedPayment } from '@/lib/saspay';
import type { Product } from '@/lib/types';

export const PAYMENT_TTL_MS = 30 * 60_000;

export interface PaymentItem {
  productId: string;
  name: string;
  quantity: number;
  size?: string;
  color?: string;
  priceUSD: number;
}

export interface PaymentDoc {
  id: string;
  uid: string;
  email: string;
  /** Session du chat (localStorage « ilu_chat_session ») : rattache la conversation. */
  sessionId: string;
  items: PaymentItem[];
  itemsLabel: string;
  cartSummary: string;
  delivery: DeliveryInput;
  /** Total de la commande en USD (recalculé côté serveur). */
  amount: number;
  currency: 'USD';
  network: string;
  networkLabel: string;
  /** Frais SasPay et total annoncés avant le paiement. */
  expectedFee: number;
  expectedTotal: number;
  phoneHint: string | null;
  status: PaymentStatus;
  providerPaymentId: string | null;
  providerStatus: string | null;
  checkoutUrl: string | null;
  chargedAmount: number | null;
  feeAmount: number | null;
  netAmount: number | null;
  orderId: string | null;
  convId: string | null;
  paidAt: string | null;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

// ── Identité ──────────────────────────────────────────────────────────────────

export interface AuthedUser {
  uid: string;
  email: string;
  name: string;
}

/** Utilisateur connecté d'après le jeton Firebase (en-tête Authorization: Bearer <idToken>). */
export async function authUser(req: Request): Promise<AuthedUser | null> {
  const match = (req.headers.get('authorization') ?? '').match(/^Bearer (.+)$/);
  if (!match) return null;
  try {
    const t = await adminAuth().verifyIdToken(match[1]);
    return { uid: t.uid, email: t.email ?? '', name: typeof t.name === 'string' ? t.name : '' };
  } catch {
    return null;
  }
}

export async function isAdminUid(uid: string): Promise<boolean> {
  try {
    return (await adminDb().collection('admins').doc(uid).get()).exists;
  } catch (err) {
    console.error('[payments] isAdminUid failed:', err);
    return false;
  }
}

/** Interrupteur : SASPAY_ENABLED=true ouvre à tous ; sinon seuls les admins peuvent payer (essai réel). */
export function saspayPublic(): boolean {
  return process.env.SASPAY_ENABLED === 'true';
}

export async function saspayEnabledFor(uid: string): Promise<boolean> {
  return saspayPublic() || isAdminUid(uid);
}

// ── Prix : toujours relus dans le catalogue ───────────────────────────────────

export type PricedCart =
  | { ok: true; items: PaymentItem[]; amount: number; itemsLabel: string; cartSummary: string }
  | { ok: false; error: string };

const shortText = (v: unknown, max: number): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined;

export async function priceCart(raw: unknown): Promise<PricedCart> {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 50) {
    return { ok: false, error: 'Panier vide ou invalide.' };
  }
  const lines: CartLineInput[] = [];
  for (const l of raw as Record<string, unknown>[]) {
    const productId = shortText(l?.productId, 128);
    const quantity = Number(l?.quantity);
    if (!productId || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      return { ok: false, error: 'Panier invalide.' };
    }
    lines.push({ productId, quantity, size: shortText(l.size, 40), color: shortText(l.color, 40) });
  }

  const db = adminDb();
  const ids = Array.from(new Set(lines.map((l) => l.productId)));
  const snaps = await db.getAll(...ids.map((id) => db.collection('products').doc(id)));
  const byId = new Map<string, Product>();
  snaps.forEach((s) => { if (s.exists) byId.set(s.id, { ...(s.data() as Product), id: s.id }); });
  for (const p of SEED_PRODUCTS) if (!byId.has(p.id)) byId.set(p.id, p);

  const items: PaymentItem[] = [];
  let cents = 0;
  for (const l of lines) {
    const p = byId.get(l.productId);
    const price = Number(p?.priceUSD);
    if (!p || p.status === 'inactive' || !Number.isFinite(price) || price <= 0) {
      return { ok: false, error: 'Un article de ton panier n\'est plus disponible.' };
    }
    cents += Math.round(price * 100) * l.quantity;
    items.push({ productId: p.id, name: p.name, quantity: l.quantity, size: l.size, color: l.color, priceUSD: price });
  }

  const amount = cents / 100;
  const itemsLabel = items.slice(0, 2).map((i) => i.name).join(' + ') + (items.length > 2 ? ` +${items.length - 2}` : '');
  const cartSummary = items
    .map((i) => {
      const variant = [i.size, i.color].filter(Boolean).join(' / ');
      return `• ${i.name}${variant ? ` (${variant})` : ''} × ${i.quantity}`;
    })
    .join('\n') + `\nTotal : ${formatUSD(amount)}`;

  return { ok: true, items, amount, itemsLabel, cartSummary };
}

export function validDelivery(raw: unknown): DeliveryInput | null {
  const d = (raw ?? {}) as Record<string, unknown>;
  const name = shortText(d.name, 120);
  const phone = shortText(d.phone, 40);
  const address = shortText(d.address, 200);
  const city = shortText(d.city, 80);
  if (!name || !phone || !address || !city) return null;
  return { name, phone, address, city, neighborhood: shortText(d.neighborhood, 80) ?? '' };
}

// ── Synchronisation avec SasPay ───────────────────────────────────────────────

const paymentRef = (id: string) => adminDb().collection('payments').doc(id);

async function readPayment(id: string): Promise<PaymentDoc | null> {
  const snap = await paymentRef(id).get();
  return snap.exists ? ({ ...(snap.data() as PaymentDoc), id: snap.id }) : null;
}

/** Passe un paiement « en attente » à un autre statut, seulement s'il l'est encore. */
async function markIf(id: string, from: PaymentStatus[], to: PaymentStatus, providerStatus: string) {
  const ref = paymentRef(id);
  await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const status = snap.data()?.status as PaymentStatus | undefined;
    if (!status || !from.includes(status)) return;
    tx.update(ref, { status: to, providerStatus, updatedAt: new Date().toISOString() });
  });
}

/** Redemande l'état réel à SasPay et met le registre à jour (valide la commande si payé). */
export async function syncPayment(id: string): Promise<PaymentDoc | null> {
  const payment = await readPayment(id);
  if (!payment || payment.status === 'paid' || !payment.providerPaymentId) return payment;

  const verified = await verifyPayment(payment.providerPaymentId);
  if (verified) {
    const outcome = outcomeOf(verified.status);
    if (outcome === 'paid') {
      await finalizePayment(id, verified);
    } else if (outcome === 'failed') {
      await markIf(id, ['pending'], 'failed', verified.status);
    } else if (payment.status === 'pending' && Date.parse(payment.expiresAt) < Date.now()) {
      // Toujours en attente après 30 min : expiré (un succès tardif sera quand même validé).
      await markIf(id, ['pending'], 'expired', verified.status);
    }
  }
  return readPayment(id);
}

/**
 * Validation unique : paiement → « payé », commande créée dans users/{uid}/orders/{paymentId},
 * conversation mise à jour (ou créée) avec le récapitulatif. Tout ou rien, une seule fois,
 * même si l'écran du client et le webhook arrivent en même temps.
 */
export async function finalizePayment(id: string, verified: VerifiedPayment): Promise<boolean> {
  const db = adminDb();
  const ref = paymentRef(id);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return false;
    const p = { ...(snap.data() as PaymentDoc), id };
    if (p.status === 'paid') return false;

    const convSnap = await tx.get(db.collection('conversations').where('clientId', '==', p.sessionId));
    const openConv = convSnap.docs.find((d) => d.data().status !== 'closed');
    const convRef = openConv ? openConv.ref : db.collection('conversations').doc();
    const orderRef = db.collection('users').doc(p.uid).collection('orders').doc(id);

    const now = new Date().toISOString();
    const charged = verified.charged ?? p.expectedTotal;
    const method = `${p.networkLabel} (SasPay)`;
    const d = p.delivery;
    const payMsg = {
      id: `msg-${Date.now()}-pay`,
      sender: 'system',
      content:
        `✅ Paiement reçu et vérifié auprès de SasPay\n` +
        `Montant : ${formatUSD(charged)} via ${p.networkLabel} (commande ${formatUSD(p.amount)})\n` +
        `Réf. commande : ${id.slice(0, 8).toUpperCase()}\n\n` +
        `${p.cartSummary}\n\n` +
        `📍 Livraison : ${d.name} · ${d.phone}\n${d.address}${d.neighborhood ? `, ${d.neighborhood}` : ''}, ${d.city}`,
      createdAt: now,
    };

    tx.update(ref, {
      status: 'paid',
      paidAt: now,
      providerStatus: verified.status,
      chargedAmount: verified.charged,
      feeAmount: verified.fee,
      netAmount: verified.net,
      orderId: id,
      convId: convRef.id,
      updatedAt: now,
    });

    tx.set(orderRef, {
      items: p.items.map(({ productId, quantity, size, color, priceUSD }) => ({ productId, quantity, size, color, priceUSD })),
      itemsLabel: p.itemsLabel,
      totalUSD: p.amount,
      deliveryInfo: d,
      paymentMethod: method,
      status: 'order_confirmed',
      paymentId: id,
      paymentStatus: 'paid',
      chatConvId: convRef.id,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const convFields = {
      status: 'order_confirmed',
      itemsLabel: p.itemsLabel,
      cartSummary: p.cartSummary,
      totalUSD: p.amount,
      paymentMethod: method,
      paymentId: id,
      lastMessage: '✅ Paiement SasPay reçu',
      lastMessageAt: now,
    };
    if (openConv) {
      tx.update(convRef, { ...convFields, messages: FieldValue.arrayUnion(payMsg), unreadCount: FieldValue.increment(1) });
    } else {
      tx.set(convRef, {
        ...convFields,
        clientId: p.sessionId,
        uid: p.uid,
        clientName: d.name,
        unreadCount: 1,
        createdAt: now,
        messages: [payMsg],
      });
    }
    return true;
  });
}

/** Paiement par identifiant SasPay (utilisé par le webhook). */
export async function findByProviderId(providerId: string): Promise<string | null> {
  const q = await adminDb().collection('payments').where('providerPaymentId', '==', providerId).limit(1).get();
  return q.empty ? null : q.docs[0].id;
}

/**
 * Filet de sécurité : redemande l'état des paiements en attente / expirés des 3 derniers jours
 * (client parti trop tôt ET webhook perdu). Appelé à l'ouverture de l'écran admin « Commandes ».
 */
export async function reconcilePending(): Promise<{ checked: number; paid: number; errors: number }> {
  const out = { checked: 0, paid: 0, errors: 0 };
  const since = new Date(Date.now() - 3 * 24 * 60 * 60_000).toISOString();
  const snap = await adminDb().collection('payments').where('createdAt', '>=', since).get();
  for (const doc of snap.docs) {
    const p = doc.data() as PaymentDoc;
    if (!p.providerPaymentId || (p.status !== 'pending' && p.status !== 'expired')) continue;
    out.checked++;
    try {
      const synced = await syncPayment(doc.id);
      if (synced?.status === 'paid') out.paid++;
    } catch (err) {
      out.errors++;
      console.error('[payments] reconcile failed:', doc.id, err);
    }
  }
  return out;
}
