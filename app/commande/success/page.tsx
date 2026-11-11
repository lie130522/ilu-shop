'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function SuccessContent() {
  const params = useSearchParams();
  const orderId = params.get('order_id');

  return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center text-5xl mx-auto select-none">
        ✓
      </div>

      <h1 className="mt-6 font-display font-extrabold text-3xl text-ink">
        Paiement reçu<span className="text-terra">.</span>
      </h1>

      <p className="mt-3 text-muted font-light max-w-sm mx-auto leading-relaxed">
        Votre paiement a bien été traité via Saspay. Notre équipe va préparer votre commande et vous contacter pour la livraison.
      </p>

      {orderId && (
        <div className="mt-5 inline-block bg-bone rounded-md px-5 py-2.5 font-mono text-xs text-muted tracking-wide">
          Référence commande : <span className="font-semibold text-ink">{orderId.slice(0, 8).toUpperCase()}</span>
        </div>
      )}

      <div className="mt-6 max-w-xs mx-auto rounded-lg border border-terra/30 bg-terra/5 p-4 text-left">
        <p className="font-display font-semibold text-sm text-ink mb-1">📦 Prochaine étape</p>
        <p className="text-sm text-muted font-light leading-relaxed">
          Notre équipe vous contactera dans les prochaines heures pour confirmer votre livraison à Kinshasa.
        </p>
      </div>

      <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          href="/"
          className="h-12 px-8 rounded-full bg-terra hover:bg-terra-light hover:text-ink text-cream font-display text-xs font-semibold tracking-[0.25em] uppercase transition-colors flex items-center justify-center"
        >
          Retour à la boutique
        </Link>
        <Link
          href="/compte"
          className="h-12 px-8 rounded-full border border-line bg-cream hover:bg-bone font-display text-xs font-semibold tracking-widest uppercase transition-colors flex items-center justify-center"
        >
          Mon espace →
        </Link>
      </div>

      <p className="mt-10 text-xs text-muted">
        Un problème ?{' '}
        <Link href="/" className="underline hover:text-terra transition-colors">
          Contactez-nous via le chat
        </Link>
      </p>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-bone mx-auto animate-pulse" />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
