'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';

// Vérifie si un email est celui d'un admin (sans importer AdminProvider pour éviter la dépendance circulaire)
function checkIsAdmin(email: string): boolean {
  try {
    const stored = localStorage.getItem('ilu_admins');
    if (stored) {
      const admins = JSON.parse(stored) as Array<{ email: string }>;
      return admins.some((a) => a.email.toLowerCase() === email.toLowerCase());
    }
  } catch { /* ignore */ }
  // Fallback : vérifier le seed en dur
  return email.toLowerCase() === 'lievinkabamba1@gmail.com';
}

type Mode = 'login' | 'register' | 'reset';

const FIREBASE_ERRORS: Record<string, string> = {
  'auth/user-not-found': 'Aucun compte associé à cet email.',
  'auth/wrong-password': 'Mot de passe incorrect.',
  'auth/invalid-credential': 'Email ou mot de passe incorrect.',
  'auth/email-already-in-use': 'Cet email est déjà utilisé par un autre compte.',
  'auth/weak-password': 'Le mot de passe doit faire au moins 6 caractères.',
  'auth/too-many-requests': 'Trop de tentatives. Réessaie dans quelques minutes.',
  'auth/popup-closed-by-user': 'Connexion Google annulée.',
  'auth/network-request-failed': 'Erreur réseau. Vérifie ta connexion.',
};

export default function ConnexionPage() {
  const { login, register, loginWithGoogle, resetPassword } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const reset = () => { setError(null); setSuccess(null); };

  const switchMode = (m: Mode) => { reset(); setMode(m); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    reset();
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
        router.push(checkIsAdmin(email) ? '/admin' : '/compte');
      } else if (mode === 'register') {
        if (password !== confirmPassword) {
          setError('Les mots de passe ne correspondent pas.');
          return;
        }
        await register(email, password, displayName || undefined);
        setSuccess('Compte créé ! Vérifie ton email pour confirmer ton adresse.');
        switchMode('login');
      } else {
        await resetPassword(email);
        setSuccess('Email de récupération envoyé ! Vérifie ta boîte mail.');
      }
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? '';
      setError(FIREBASE_ERRORS[code] ?? 'Une erreur est survenue. Réessaie.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    reset();
    setLoading(true);
    try {
      await loginWithGoogle();
      // Après Google OAuth, l'email est dispo dans auth.currentUser
      const { auth: fbAuth } = await import('@/lib/firebase/client');
      const firebaseEmail = fbAuth.currentUser?.email ?? '';
      router.push(checkIsAdmin(firebaseEmail) ? '/admin' : '/compte');
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? '';
      setError(FIREBASE_ERRORS[code] ?? 'Erreur lors de la connexion Google.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* ── Panneau marque ── */}
      <div className="hidden lg:flex bg-ink text-cream p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-terra/30 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full bg-gold/10 blur-3xl pointer-events-none" />

        <Link href="/" className="relative z-10 flex items-baseline gap-2">
          <span className="font-display font-extrabold text-2xl tracking-[0.18em] text-terra">ILU</span>
          <span className="font-display font-extrabold text-2xl tracking-[0.18em] text-cream">SHOP.</span>
        </Link>

        <div className="relative z-10">
          <span className="font-display text-[10px] tracking-[0.35em] uppercase text-terra font-semibold">
            ◯ Espace client
          </span>
          <h2 className="mt-4 font-display font-extrabold text-5xl xl:text-6xl leading-[0.95] text-cream">
            Ton style,<br />ton espace.
          </h2>
          <p className="mt-6 text-cream/60 font-light max-w-md leading-relaxed">
            Suis tes commandes, gère ta wishlist et découvre des recommandations
            personnalisées basées sur tes goûts.
          </p>
          <div className="mt-10 grid grid-cols-3 gap-6 max-w-sm">
            {[
              { v: 'Commandes', l: 'Suivi en temps réel' },
              { v: 'Wishlist', l: 'Sauvegarde tes coups de cœur' },
              { v: 'Recommandations', l: 'Sélection personnalisée' },
            ].map(({ v, l }) => (
              <div key={v}>
                <div className="font-display text-sm font-extrabold text-cream leading-tight">{v}</div>
                <div className="mt-1 font-display text-[9px] tracking-widest uppercase text-cream/40">{l}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-xs text-cream/40 font-light">
          © 2026 ILU SHOP — Kinshasa, RDC
        </div>
      </div>

      {/* ── Panneau formulaire ── */}
      <div className="flex items-center justify-center p-6 lg:p-12 bg-bone min-h-screen">
        <div className="w-full max-w-md">
          {/* Logo mobile */}
          <Link href="/" className="lg:hidden flex items-baseline gap-2 mb-12 justify-center">
            <span className="font-display font-extrabold text-2xl tracking-[0.18em] text-terra">ILU</span>
            <span className="font-display font-extrabold text-2xl tracking-[0.18em] text-ink">SHOP.</span>
          </Link>

          <span className="font-display text-[10px] tracking-[0.35em] uppercase text-terra font-semibold">
            ◯ {mode === 'login' ? 'Connexion' : mode === 'register' ? 'Inscription' : 'Récupération'}
          </span>
          <h1 className="mt-3 font-display font-extrabold text-4xl text-ink leading-tight">
            {mode === 'login' ? 'Bon retour.' : mode === 'register' ? 'Créer un compte.' : 'Mot de passe oublié.'}
          </h1>
          <p className="mt-2 text-sm text-muted font-light">
            {mode === 'login'
              ? 'Connecte-toi pour accéder à ton espace.'
              : mode === 'register'
                ? 'Rejoins ILU SHOP et profite de recommandations personnalisées.'
                : 'Saisis ton email pour recevoir un lien de récupération.'}
          </p>

          {/* Google OAuth */}
          {mode !== 'reset' && (
            <button
              type="button"
              onClick={handleGoogle}
              disabled={loading}
              className="mt-8 w-full h-12 rounded-full border border-line bg-cream hover:bg-beige flex items-center justify-center gap-3 text-sm font-medium transition-colors disabled:opacity-50"
            >
              <GoogleIcon />
              Continuer avec Google
            </button>
          )}

          {mode !== 'reset' && (
            <div className="my-6 flex items-center gap-3">
              <div className="flex-1 h-px bg-line" />
              <span className="text-xs text-muted">ou</span>
              <div className="flex-1 h-px bg-line" />
            </div>
          )}

          {/* Formulaire */}
          <form onSubmit={handleSubmit} className="space-y-4 mt-6">
            {mode === 'register' && (
              <Field label="Prénom & Nom">
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-cream border border-line rounded-md px-4 py-3 text-sm outline-none focus:border-terra transition-colors"
                  placeholder="ex: Jean Kabila"
                />
              </Field>
            )}

            <Field label="Email *">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-cream border border-line rounded-md px-4 py-3 text-sm outline-none focus:border-terra transition-colors"
                placeholder="vous@email.com"
              />
            </Field>

            {mode !== 'reset' && (
              <Field label="Mot de passe *">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full bg-cream border border-line rounded-md px-4 py-3 text-sm outline-none focus:border-terra transition-colors"
                  placeholder="••••••••"
                />
              </Field>
            )}

            {mode === 'register' && (
              <Field label="Confirmer le mot de passe *">
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full bg-cream border border-line rounded-md px-4 py-3 text-sm outline-none focus:border-terra transition-colors"
                  placeholder="••••••••"
                />
              </Field>
            )}

            {error && (
              <div className="bg-terra/10 border border-terra/30 text-terra-dark text-sm rounded-md px-4 py-3">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-md px-4 py-3">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-full bg-ink hover:bg-terra text-cream font-display text-xs font-semibold tracking-[0.25em] uppercase transition-colors disabled:opacity-50 mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-cream/40 border-t-cream rounded-full animate-spin" />
                  Chargement…
                </span>
              ) : mode === 'login'
                ? 'Se connecter'
                : mode === 'register'
                  ? 'Créer mon compte'
                  : 'Envoyer le lien'}
            </button>
          </form>

          {/* Liens de navigation entre modes */}
          <div className="mt-6 space-y-2 text-center text-sm text-muted">
            {mode === 'login' && (
              <>
                <button
                  type="button"
                  onClick={() => switchMode('reset')}
                  className="block w-full hover:text-terra transition-colors"
                >
                  Mot de passe oublié ?
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('register')}
                  className="block w-full hover:text-ink transition-colors"
                >
                  Pas encore de compte ?{' '}
                  <span className="font-semibold text-ink underline">S'inscrire</span>
                </button>
              </>
            )}
            {mode === 'register' && (
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="hover:text-terra transition-colors"
              >
                Déjà un compte ?{' '}
                <span className="font-semibold text-ink underline">Se connecter</span>
              </button>
            )}
            {mode === 'reset' && (
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="hover:text-terra transition-colors"
              >
                ← Retour à la connexion
              </button>
            )}
          </div>

          <p className="mt-10 text-xs text-muted text-center">
            ←{' '}
            <Link href="/" className="underline hover:text-terra transition-colors">
              Retour à la boutique
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="font-display text-[11px] tracking-widest uppercase font-semibold text-ink mb-2 block">
        {label}
      </span>
      {children}
    </label>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" />
      <path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
    </svg>
  );
}
