'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { isAdminError, useAdmin, DEMO_PASSWORD } from '@/components/admin/AdminProvider';

export default function AdminLoginPage() {
  const { login, currentAdmin } = useAdmin();
  const router = useRouter();
  const [email, setEmail] = useState('admin@ilushop.cd');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (currentAdmin) {
    router.replace('/admin');
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = login(email, password);
    setLoading(false);
    if (isAdminError(result)) {
      setError(result.message);
      return;
    }
    router.push('/admin');
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Brand panel */}
      <div className="hidden lg:flex bg-ink text-cream p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-radial-terra opacity-30 blur-2xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-terra-light/20 blur-3xl" />

        <Link href="/" className="relative z-10 flex items-baseline gap-2">
          <span className="font-display font-extrabold text-2xl tracking-[0.18em] text-terra">
            ILU
          </span>
          <span className="font-display font-extrabold text-2xl tracking-[0.18em] text-cream">
            ADMIN.
          </span>
        </Link>

        <div className="relative z-10">
          <span className="font-display text-[10px] tracking-[0.35em] uppercase text-terra-light font-semibold">
            ◯ Espace administration
          </span>
          <h2 className="mt-4 font-display font-extrabold text-5xl xl:text-6xl leading-[0.95] text-cream">
            Pilotez<br />
            ILU SHOP.
          </h2>
          <p className="mt-6 text-cream/60 font-light max-w-md leading-relaxed">
            Catalogue, commandes, chat clients, éditorial, taux de change. Tout depuis un seul
            tableau de bord.
          </p>

          <div className="mt-10 grid grid-cols-3 gap-6 max-w-md">
            <Stat value="3" label="Admins max" />
            <Stat value="WhatsApp" label="Style notifs" />
            <Stat value="USD/CDF" label="Bi-devise" />
          </div>
        </div>

        <div className="relative z-10 text-xs text-cream/40 font-light">
          © 2026 ILU SHOP — Kinshasa, RDC
        </div>
      </div>

      {/* Login form */}
      <div className="flex items-center justify-center p-6 lg:p-12 bg-bone">
        <div className="w-full max-w-md">
          <Link
            href="/"
            className="lg:hidden flex items-baseline gap-2 mb-12 justify-center"
          >
            <span className="font-display font-extrabold text-2xl tracking-[0.18em] text-terra">
              ILU
            </span>
            <span className="font-display font-extrabold text-2xl tracking-[0.18em] text-ink">
              ADMIN.
            </span>
          </Link>

          <span className="font-display text-[10px] tracking-[0.35em] uppercase text-terra font-semibold">
            ◯ Connexion
          </span>
          <h1 className="mt-3 font-display font-extrabold text-4xl text-ink leading-tight">
            Bon retour.
          </h1>
          <p className="mt-2 text-sm text-muted font-light">
            Authentifiez-vous pour accéder au tableau de bord.
          </p>

          {/* Demo credentials notice */}
          <div className="mt-6 bg-cream border border-terra/30 rounded-md p-4 text-xs">
            <div className="font-display text-[10px] tracking-widest uppercase text-terra font-semibold mb-1">
              Mode démo
            </div>
            <div className="text-ink-light font-light">
              Email :{' '}
              <code className="bg-bone px-1.5 py-0.5 rounded text-ink font-mono text-[11px]">
                admin@ilushop.cd
              </code>
              <br />
              Mot de passe :{' '}
              <code className="bg-bone px-1.5 py-0.5 rounded text-ink font-mono text-[11px]">
                {DEMO_PASSWORD}
              </code>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <Field label="Email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-cream border border-line rounded-md px-4 py-3 text-sm outline-none focus:border-terra transition-colors"
                placeholder="vous@email.com"
              />
            </Field>

            <Field label="Mot de passe">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-cream border border-line rounded-md px-4 py-3 text-sm outline-none focus:border-terra transition-colors"
                placeholder="••••••••"
              />
            </Field>

            {error && (
              <div className="bg-terra/10 border border-terra/30 text-terra-dark text-sm rounded-md px-4 py-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-full bg-ink hover:bg-terra text-cream font-display text-xs font-semibold tracking-[0.25em] uppercase transition-colors disabled:opacity-50"
            >
              {loading ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>

          <p className="mt-8 text-xs text-muted font-light text-center">
            ← <Link href="/" className="underline hover:text-terra">Retour à la boutique</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

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

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="font-display text-xl font-extrabold text-cream leading-none">{value}</div>
      <div className="mt-1.5 font-display text-[9px] tracking-widest uppercase text-cream/40">
        {label}
      </div>
    </div>
  );
}
