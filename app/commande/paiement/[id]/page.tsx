'use client';

// Écran d'attente / résultat d'un paiement SasPay. Il redemande l'état au serveur (qui le redemande
// à SasPay) toutes les 4 s, puis toutes les 15 s après 3 minutes. La commande est validée côté
// serveur dès que SasPay confirme : cet écran ne fait qu'afficher, et vide le panier une fois payé.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { useShop } from '@/components/ShopProvider';
import { auth } from '@/lib/firebase/client';
import { formatUSD } from '@/lib/currency';
import { PAYMENT_HINT_KEY } from '@/lib/payments';

interface StatusData {
  status: 'pending' | 'paid' | 'failed' | 'expired';
  amount: number;
  fee: number;
  total: number;
  operatorFee: number;
  network: string;
  networkLabel: string;
  kind: 'mobile_money' | 'card';
  phoneHint: string | null;
  charged: number | null;
  itemsLabel: string;
  orderId: string | null;
  createdAt: string;
  expiresAt: string;
  paidAt: string | null;
}

const FAST_MS = 4_000;
const SLOW_MS = 15_000;
/** Au-delà, on prévient que ça prend du temps (la validation se fera quand même toute seule). */
const SLOW_AFTER_MS = 3 * 60_000;
/** Au-delà, on arrête de demander : le webhook SasPay et le rattrapage admin prennent le relais. */
const STOP_AFTER_MS = 35 * 60_000;

export default function PaiementPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { clearCart, openChat } = useShop();

  const [data, setData] = useState<StatusData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [slow, setSlow] = useState(false);
  const [checking, setChecking] = useState(false);
  const [instructions, setInstructions] = useState<string | null>(null);
  const cleared = useRef(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(PAYMENT_HINT_KEY(id));
      if (raw) setInstructions((JSON.parse(raw) as { instructions?: string | null }).instructions ?? null);
    } catch { /* ignore */ }
  }, [id]);

  /** Une vérification ; renvoie vrai si c'est terminé (payé, échoué ou introuvable). */
  const check = useCallback(async (): Promise<boolean> => {
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return false;
      const res = await fetch(`/api/payments/${id}`, { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 404) { setNotFound(true); return true; }
      if (!res.ok) return false;
      const d = (await res.json()) as StatusData;
      setData(d);
      if (Date.now() - Date.parse(d.createdAt) > SLOW_AFTER_MS) setSlow(true);
      return d.status === 'paid' || d.status === 'failed';
    } catch {
      return false;
    }
  }, [id]);

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();
    async function loop() {
      const finished = await check();
      if (cancelled || finished) return;
      const waited = Date.now() - startedAt;
      if (waited > STOP_AFTER_MS) return;
      timer = setTimeout(loop, waited > SLOW_AFTER_MS ? SLOW_MS : FAST_MS);
    }
    loop();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [authLoading, user, check]);

  // Payé : on vide le panier une seule fois, et seulement dans le navigateur qui a lancé ce paiement.
  useEffect(() => {
    if (data?.status !== 'paid' || cleared.current) return;
    cleared.current = true;
    try {
      if (sessionStorage.getItem(PAYMENT_HINT_KEY(id)) !== null) {
        clearCart();
        sessionStorage.removeItem(PAYMENT_HINT_KEY(id));
      }
    } catch { /* ignore */ }
  }, [data?.status, id, clearCart]);

  const checkNow = async () => {
    setChecking(true);
    await check();
    setChecking(false);
  };

  const openChatHome = () => {
    openChat();
    router.push('/');
  };

  if (authLoading) return <Card icon="…" tone="wait" title="Chargement…" />;

  if (!user) {
    return (
      <Card icon="🔒" tone="wait" title="Connecte-toi pour suivre ce paiement">
        <Actions>
          <Primary href={`/connexion?redirect=/commande/paiement/${id}`}>Se connecter</Primary>
        </Actions>
      </Card>
    );
  }

  if (notFound) {
    return (
      <Card icon="✕" tone="bad" title="Paiement introuvable">
        <Body>Ce paiement n&apos;existe pas ou n&apos;est pas rattaché à ton compte.</Body>
        <Actions>
          <Primary href="/panier">Retour au panier</Primary>
        </Actions>
      </Card>
    );
  }

  if (!data) return <Card icon="…" tone="wait" title="Vérification du paiement…" spinner />;

  if (data.status === 'paid') {
    return (
      <Card icon="✓" tone="ok" title="Paiement reçu">
        <Body>
          Ta commande <strong>{data.itemsLabel}</strong> est confirmée. Notre équipe te contacte dans le chat pour la livraison.
        </Body>
        {data.charged != null && (
          <p className="mt-2 text-xs text-muted">
            Montant demandé par SasPay : {formatUSD(data.charged)}
            {data.kind === 'mobile_money' && data.operatorFee > 0 ? ` (ton opérateur a pu ajouter ≈ ${formatUSD(data.operatorFee)} de frais)` : ''}
          </p>
        )}
        {data.orderId && (
          <div className="mt-4 inline-block bg-bone rounded-md px-4 py-2 font-mono text-xs text-muted">
            Réf : {data.orderId.slice(0, 8).toUpperCase()}
          </div>
        )}
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={openChatHome}
            className="h-12 px-8 rounded-full bg-terra hover:bg-terra-light hover:text-ink text-cream font-display text-xs font-semibold tracking-[0.25em] uppercase transition-colors"
          >
            💬 Ouvrir le chat
          </button>
          <Secondary href="/compte">Mon espace →</Secondary>
        </div>
      </Card>
    );
  }

  if (data.status === 'failed') {
    return (
      <Card icon="✕" tone="bad" title="Le paiement n'a pas abouti">
        <Body>Aucun montant n&apos;a été validé et ton panier est intact. Tu peux réessayer ou choisir un autre moyen.</Body>
        <Actions>
          <Primary href="/commande">Réessayer</Primary>
          <Secondary href="/panier">Voir le panier</Secondary>
        </Actions>
      </Card>
    );
  }

  // En attente (ou expiré : un succès tardif sera quand même validé).
  const expired = data.status === 'expired';
  if (expired || slow) {
    return (
      <Card icon="⏳" tone="warn" title={expired ? 'Paiement toujours en attente' : 'Ça prend un peu de temps'}>
        <Body>
          Si tu as validé le paiement, ta commande sera confirmée automatiquement dès que SasPay nous le confirme.
          Tu peux fermer cette page : tu la retrouveras dans « Mon espace ».
        </Body>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={checkNow}
            disabled={checking}
            className="h-12 px-8 rounded-full bg-ink hover:bg-terra text-cream font-display text-xs font-semibold tracking-[0.25em] uppercase transition-colors disabled:opacity-50"
          >
            {checking ? 'Vérification…' : 'Vérifier maintenant'}
          </button>
          {expired ? <Secondary href="/commande">Réessayer</Secondary> : <Secondary href="/compte">Mon espace →</Secondary>}
        </div>
      </Card>
    );
  }

  const mobile = data.kind === 'mobile_money';
  return (
    <Card
      icon={mobile ? '📱' : '💳'}
      tone="wait"
      title={mobile ? 'Valide le paiement sur ton téléphone' : 'Paiement par carte en cours'}
      spinner
    >
      <Body>
        {mobile ? (
          <>
            Une demande de <strong>{formatUSD(data.total)}</strong> a été envoyée sur ton numéro {data.networkLabel}
            {data.phoneHint ? <> se terminant par <strong>•••{data.phoneHint}</strong></> : null}. Saisis ton code secret pour confirmer.
            {data.operatorFee > 0 && <> {data.networkLabel} peut ajouter ≈ {formatUSD(data.operatorFee)} de frais.</>}
          </>
        ) : (
          <>Termine le paiement sur la page sécurisée SasPay. Cette page se met à jour automatiquement.</>
        )}
      </Body>
      {mobile && instructions && (
        <div className="mt-4 text-left rounded-lg border border-terra/30 bg-terra/5 p-4 text-sm">
          <p className="font-display font-semibold text-ink mb-1">Consignes de l&apos;opérateur</p>
          <p className="whitespace-pre-line text-muted">{instructions}</p>
        </div>
      )}
      <p role="status" className="mt-6 text-xs text-muted">Mise à jour automatique…</p>
    </Card>
  );
}

const TONES = {
  ok: 'bg-emerald-100 text-emerald-700',
  bad: 'bg-terra/10 text-terra-dark',
  warn: 'bg-gold/15 text-[#7A5A15]',
  wait: 'bg-bone text-ink',
} as const;

function Card({ icon, tone, title, spinner, children }: {
  icon: string;
  tone: keyof typeof TONES;
  title: string;
  spinner?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="max-w-xl mx-auto px-4 py-16 text-center" aria-live="polite">
      <div className={`relative w-20 h-20 rounded-full flex items-center justify-center text-4xl mx-auto ${TONES[tone]}`}>
        {spinner && <span className="absolute inset-0 rounded-full border-2 border-terra/20 border-t-terra animate-spin" />}
        <span>{icon}</span>
      </div>
      <h1 className="mt-6 font-display font-extrabold text-3xl text-ink">
        {title}<span className="text-terra">.</span>
      </h1>
      {children}
    </div>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-muted font-light max-w-md mx-auto leading-relaxed">{children}</p>;
}

function Actions({ children }: { children: React.ReactNode }) {
  return <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">{children}</div>;
}

function Primary({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="h-12 px-8 rounded-full bg-terra hover:bg-terra-light hover:text-ink text-cream font-display text-xs font-semibold tracking-[0.25em] uppercase transition-colors flex items-center justify-center"
    >
      {children}
    </Link>
  );
}

function Secondary({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="h-12 px-8 rounded-full border border-line bg-cream hover:bg-bone font-display text-xs font-semibold tracking-widest uppercase transition-colors flex items-center justify-center"
    >
      {children}
    </Link>
  );
}
