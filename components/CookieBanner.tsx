'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const COOKIE_KEY = 'ilu_cookie_consent';

export type ConsentLevel = 'all' | 'essential' | null;

export function getCookieConsent(): ConsentLevel {
  if (typeof window === 'undefined') return null;
  const val = localStorage.getItem(COOKIE_KEY);
  if (val === 'all' || val === 'essential') return val;
  return null;
}

export function CookieBanner() {
  const [consent, setConsent] = useState<ConsentLevel | 'pending'>('pending');
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const stored = getCookieConsent();
    setConsent(stored ?? null);
  }, []);

  const accept = (level: ConsentLevel) => {
    localStorage.setItem(COOKIE_KEY, level as string);
    setConsent(level);
    // Dispatch event so other components can react
    window.dispatchEvent(new CustomEvent('ilu:consent', { detail: { level } }));
  };

  // Don't render during SSR or if already decided
  if (consent === 'pending' || consent !== null) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[200] max-w-2xl mx-auto">
      <div className="bg-ink text-cream rounded-xl shadow-2xl p-5">
        <div className="flex items-start gap-4">
          <span className="text-2xl shrink-0">🍪</span>
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-bold text-sm text-cream">Cookies & confidentialité</h3>
            <p className="mt-1.5 text-xs text-cream/70 font-light leading-relaxed">
              ILU SHOP utilise des cookies pour améliorer ton expérience et te proposer des recommandations personnalisées.
              Tu peux accepter tous les cookies ou seulement les cookies essentiels.{' '}
              <button
                type="button"
                onClick={() => setShowDetails(!showDetails)}
                className="underline hover:text-terra transition-colors"
              >
                {showDetails ? 'Masquer les détails' : 'En savoir plus'}
              </button>
            </p>

            {showDetails && (
              <div className="mt-3 space-y-2 text-xs text-cream/60 border-t border-cream/10 pt-3">
                <div>
                  <span className="font-semibold text-cream">Essentiels</span> — Panier, session, préférences de devise. Toujours actifs.
                </div>
                <div>
                  <span className="font-semibold text-cream">Analytics & personnalisation</span> — Produits consultés, wishlist, recommandations personnalisées. Stockés dans Firebase Firestore et associés à ton compte si tu es connecté.
                </div>
                <div className="text-[10px] text-cream/40">
                  Conformément au RGPD, tu peux consulter et supprimer tes données à tout moment depuis ton espace client ou en contactant <a href="mailto:privacy@ilushop.cd" className="underline">privacy@ilushop.cd</a>.
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 justify-end">
          <button
            type="button"
            onClick={() => accept('essential')}
            className="h-9 px-5 rounded-full border border-cream/30 text-cream/80 hover:border-cream/60 font-display text-[11px] font-semibold tracking-widest uppercase transition-colors"
          >
            Essentiels seulement
          </button>
          <button
            type="button"
            onClick={() => accept('all')}
            className="h-9 px-5 rounded-full bg-terra hover:bg-terra-light hover:text-ink text-cream font-display text-[11px] font-semibold tracking-widest uppercase transition-colors"
          >
            Tout accepter
          </button>
        </div>
      </div>
    </div>
  );
}
