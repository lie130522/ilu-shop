'use client';

// Page de connexion admin — pont entre Firebase Auth et AdminProvider.
// Accessible sans cookie (__ilu_admin). Gère elle-même le bootstrap admin
// pour éviter que le bouton reste bloqué si AdminProvider ne change pas d'état.

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { bootstrapAdminIfNeeded } from '@/lib/firebase/admins';
import { useAdmin } from '@/components/admin/AdminProvider';

function setAdminCookie() {
  document.cookie = '__ilu_admin=1; path=/; SameSite=Strict; max-age=86400';
}

export default function AdminLoginPage() {
  const { ready, currentAdmin } = useAdmin();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') ?? '/admin';

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // Empêche de traiter une redirection deux fois
  const redirecting = useRef(false);

  // Si AdminProvider confirme déjà l'admin (ex : retour en arrière) → redirige
  useEffect(() => {
    if (ready && currentAdmin && !redirecting.current) {
      redirecting.current = true;
      router.replace(redirectTo === '/admin/login' ? '/admin' : redirectTo);
    }
  }, [ready, currentAdmin, redirectTo, router]);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');

    try {
      const provider = new GoogleAuthProvider();
      // Force la re-sélection du compte pour éviter les silences sur un compte déjà connecté
      provider.setCustomParameters({ prompt: 'select_account' });
      const credential = await signInWithPopup(auth, provider);

      const { uid, email, displayName } = credential.user;

      // Vérifie/crée le document admin directement — n'attend pas AdminProvider
      const admin = await bootstrapAdminIfNeeded(
        uid,
        email ?? '',
        displayName ?? '',
      );

      if (admin) {
        // Pose le cookie maintenant pour que le middleware laisse passer la redirection
        setAdminCookie();
        redirecting.current = true;
        router.replace(redirectTo === '/admin/login' ? '/admin' : redirectTo);
        // Ne pas appeler setLoading(false) — on quitte la page
      } else {
        setError(
          'Accès refusé. Ce compte Google n\'est pas enregistré comme administrateur ILU SHOP.',
        );
        setLoading(false);
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? '';
      // L'utilisateur a fermé la fenêtre popup — pas d'erreur visible
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setLoading(false);
        return;
      }
      console.error('[AdminLogin] signInWithPopup error:', err);
      setError('Connexion échouée. Vérifiez votre compte Google et réessayez.');
      setLoading(false);
    }
  };

  // Chargement initial d'AdminProvider ou redirection en cours
  if (!ready || (ready && currentAdmin)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bone">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-terra/30 border-t-terra rounded-full animate-spin" />
          <span className="font-display text-[11px] tracking-[0.3em] uppercase text-muted">
            {currentAdmin ? 'Redirection…' : 'Vérification…'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bone px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-2">
            <span className="font-display font-extrabold text-2xl tracking-[0.18em] text-terra">ILU</span>
            <span className="font-display font-extrabold text-2xl tracking-[0.18em] text-ink">SHOP.</span>
          </div>
          <p className="mt-3 font-display text-[10px] tracking-[0.3em] uppercase text-muted">
            Espace Administration
          </p>
        </div>

        <div className="bg-cream border border-line rounded-xl p-8 shadow-sm">
          <h1 className="font-display font-bold text-xl text-ink mb-2">Connexion admin</h1>
          <p className="text-sm text-muted font-light mb-8 leading-relaxed">
            Connectez-vous avec votre compte Google associé à l&apos;équipe ILU SHOP.
          </p>

          {error && (
            <div className="mb-5 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-ink hover:bg-terra text-cream font-display text-xs font-semibold tracking-widest uppercase px-6 py-3.5 rounded-full transition-colors disabled:opacity-50"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-cream/30 border-t-cream rounded-full animate-spin" />
            ) : (
              <GoogleIcon />
            )}
            {loading ? 'Connexion…' : 'Continuer avec Google'}
          </button>
        </div>

        <p className="mt-6 text-center text-[11px] text-muted font-light">
          Accès réservé à l&apos;équipe ILU SHOP
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}
