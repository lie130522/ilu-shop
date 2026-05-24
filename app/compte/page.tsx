'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';

export default function ComptePage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/connexion');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-terra/30 border-t-terra rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  const initial = (user.displayName || user.email || 'U')[0].toUpperCase();

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <span className="font-display text-[10px] tracking-[0.35em] uppercase text-terra font-semibold">
            ◯ Mon espace
          </span>
          <h1 className="mt-2 font-display font-extrabold text-4xl text-ink">
            Bonjour{user.displayName ? `, ${user.displayName.split(' ')[0]}` : ''}.
          </h1>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="font-display text-[11px] tracking-widest uppercase font-semibold text-muted hover:text-terra transition-colors"
        >
          Se déconnecter
        </button>
      </div>

      {/* Profil card */}
      <div className="bg-cream border border-line rounded-xl p-6 mb-6 flex items-center gap-5">
        <div className="w-14 h-14 rounded-full bg-terra text-cream flex items-center justify-center font-display font-extrabold text-xl shrink-0">
          {user.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.photoURL} alt="" className="w-14 h-14 rounded-full object-cover" />
          ) : initial}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display font-semibold text-ink truncate">
            {user.displayName || 'Client ILU SHOP'}
          </p>
          <p className="text-sm text-muted truncate">{user.email}</p>
          {!user.emailVerified && (
            <span className="inline-block mt-1 text-[10px] font-display tracking-widest uppercase font-semibold px-2 py-0.5 rounded bg-gold/20 text-gold-dark border border-gold/30">
              Email non vérifié
            </span>
          )}
        </div>
      </div>

      {/* Modules */}
      <div className="grid sm:grid-cols-2 gap-4">
        <ModuleCard
          icon="📦"
          title="Mes commandes"
          description="Suivi de vos commandes en cours et historique complet."
          href="#"
          badge="Bientôt disponible"
        />
        <ModuleCard
          icon="♡"
          title="Ma wishlist"
          description="Retrouvez les produits que vous avez sauvegardés."
          href="#"
          badge="Bientôt disponible"
        />
        <ModuleCard
          icon="👤"
          title="Mon profil"
          description="Gérez vos informations personnelles et vos adresses."
          href="#"
          badge="Bientôt disponible"
        />
        <ModuleCard
          icon="🔔"
          title="Notifications"
          description="Paramètres des alertes promotions et suivi commandes."
          href="#"
          badge="Bientôt disponible"
        />
      </div>

      <p className="mt-10 text-center text-xs text-muted">
        ←{' '}
        <Link href="/" className="underline hover:text-terra transition-colors">
          Retour à la boutique
        </Link>
      </p>
    </div>
  );
}

function ModuleCard({
  icon,
  title,
  description,
  href,
  badge,
}: {
  icon: string;
  title: string;
  description: string;
  href: string;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className="group bg-cream border border-line rounded-xl p-5 hover:border-terra/40 transition-colors block"
    >
      <div className="text-2xl mb-3">{icon}</div>
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display font-semibold text-sm text-ink group-hover:text-terra transition-colors">
          {title}
        </h3>
        {badge && (
          <span className="shrink-0 text-[9px] font-display tracking-widest uppercase font-semibold px-1.5 py-0.5 rounded bg-bone text-muted border border-line">
            {badge}
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-muted leading-relaxed">{description}</p>
    </Link>
  );
}
