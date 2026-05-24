'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { isAdminError, useAdmin } from '@/components/admin/AdminProvider';
import { PERMISSION_LABEL } from '@/lib/admin/types';
import { useAuth } from '@/components/AuthProvider';
import { acceptInvitationViaGoogle } from '@/lib/firebase/admins';
import { auth } from '@/lib/firebase/client';

export default function AdminInvitationPage({ params }: { params: { token: string } }) {
  const { getInvitationByToken, revokeInvitation } = useAdmin();
  const { loginWithGoogle } = useAuth();
  const router = useRouter();

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const invitation = useMemo(() => getInvitationByToken(params.token), [getInvitationByToken, params.token]);

  const expired = invitation && new Date(invitation.expiresAt).getTime() <= Date.now();

  if (!invitation) {
    return (
      <InfoBox
        tone="error"
        title="Invitation introuvable"
        body="Ce lien d'invitation n'existe pas ou a été supprimé."
      />
    );
  }

  if (invitation.status === 'accepted' || invitation.usedAt) {
    return (
      <InfoBox
        tone="info"
        title="Invitation déjà utilisée"
        body="Cette invitation a déjà été acceptée. Vous pouvez vous connecter directement."
        linkHref="/connexion"
        linkLabel="Se connecter"
      />
    );
  }

  if (invitation.status === 'revoked') {
    return (
      <InfoBox
        tone="error"
        title="Invitation révoquée"
        body="Cette invitation a été révoquée par l'admin principal. Contactez-le pour en obtenir une nouvelle."
      />
    );
  }

  if (expired) {
    return (
      <InfoBox
        tone="error"
        title="Lien expiré"
        body="Ce lien d'invitation a expiré (durée de validité : 48h). Demandez à l'admin principal de vous envoyer une nouvelle invitation."
      />
    );
  }

  const handleGoogleActivation = async () => {
    setError(null);
    setLoading(true);
    try {
      await loginWithGoogle();

      const firebaseUser = auth.currentUser;
      if (!firebaseUser) throw new Error('Connexion Google échouée.');

      // Vérifier que l'email Google correspond à l'invitation
      if (firebaseUser.email?.toLowerCase() !== invitation.email.toLowerCase()) {
        setError(
          `Ce compte Google (${firebaseUser.email}) ne correspond pas à l'email de l'invitation (${invitation.email}). Utilisez le bon compte Google.`,
        );
        setLoading(false);
        return;
      }

      // Créer le document admin dans Firestore
      await acceptInvitationViaGoogle(
        firebaseUser.uid,
        firebaseUser.email!,
        firebaseUser.displayName ?? invitation.email,
        invitation.permissions,
        invitation.invitedBy,
      );

      // Marquer l'invitation comme acceptée dans le store local
      revokeInvitation(invitation.id); // temporaire jusqu'à migration Firestore (Groupe 3)

      setSuccess(true);
      setTimeout(() => router.push('/admin'), 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Une erreur est survenue.';
      if (isAdminError(err)) {
        setError(err.message);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const expiresIn = Math.max(
    0,
    Math.floor((new Date(invitation.expiresAt).getTime() - Date.now()) / 3600000),
  );

  if (success) {
    return (
      <InfoBox
        tone="info"
        title="Compte activé !"
        body="Votre compte admin a été activé avec succès. Redirection vers le tableau de bord…"
      />
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-bone">
      <div className="w-full max-w-lg bg-cream border border-line rounded-lg p-8 lg:p-10">
        <Link href="/" className="flex items-baseline gap-2 mb-8">
          <span className="font-display font-extrabold text-2xl tracking-[0.18em] text-terra">ILU</span>
          <span className="font-display font-extrabold text-2xl tracking-[0.18em] text-ink">ADMIN.</span>
        </Link>

        <span className="font-display text-[10px] tracking-[0.35em] uppercase text-terra font-semibold">
          ✦ Invitation reçue
        </span>
        <h1 className="mt-3 font-display font-extrabold text-3xl md:text-4xl text-ink leading-tight">
          Activez votre<br />compte admin.
        </h1>
        <p className="mt-3 text-sm text-muted font-light">
          Vous avez été invité à rejoindre l&apos;équipe ILU SHOP. Connectez-vous avec le compte Google associé à l&apos;adresse <strong className="text-ink">{invitation.email}</strong>.
        </p>

        {/* Invitation summary */}
        <div className="mt-6 bg-bone border border-line rounded-md p-5">
          <Row label="Email" value={invitation.email} />
          <Row
            label="Rôle"
            value="Admin secondaire"
            tag={<span className="bg-terra text-cream text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded">Délégué</span>}
          />
          <div className="mt-3">
            <div className="font-display text-[10px] tracking-widest uppercase text-muted font-semibold">
              Permissions accordées
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {invitation.permissions.map((p) => (
                <span key={p} className="bg-cream border border-line text-[11px] font-medium px-2.5 py-1 rounded">
                  {PERMISSION_LABEL[p]}
                </span>
              ))}
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-line text-[11px] text-muted font-light">
            ⏱ Lien valide encore {expiresIn}h • Usage unique
          </div>
        </div>

        {error && (
          <div className="mt-4 bg-terra/10 border border-terra/30 text-terra-dark text-sm rounded-md px-4 py-3">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleGoogleActivation}
          disabled={loading}
          className="mt-6 w-full h-12 rounded-full border border-line bg-cream hover:bg-beige flex items-center justify-center gap-3 text-sm font-medium transition-colors disabled:opacity-50"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-ink/30 border-t-ink rounded-full animate-spin" />
              Activation en cours…
            </span>
          ) : (
            <>
              <GoogleIcon />
              Activer avec Google
            </>
          )}
        </button>

        <p className="mt-4 text-xs text-muted text-center font-light">
          Utilisez uniquement le compte Google associé à <strong>{invitation.email}</strong>
        </p>
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function Row({ label, value, tag }: { label: string; value: string; tag?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="font-display text-[10px] tracking-widest uppercase text-muted font-semibold">{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-medium text-ink">{value}</span>
        {tag}
      </div>
    </div>
  );
}

function InfoBox({ tone, title, body, linkHref, linkLabel }: {
  tone: 'error' | 'info';
  title: string;
  body: string;
  linkHref?: string;
  linkLabel?: string;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-bone">
      <div className="w-full max-w-md bg-cream border border-line rounded-lg p-8 text-center">
        <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center text-3xl ${tone === 'error' ? 'bg-terra/15 text-terra' : 'bg-emerald-50 text-emerald-600'}`}>
          {tone === 'error' ? '⚠' : '✓'}
        </div>
        <h2 className="mt-6 font-display font-extrabold text-2xl text-ink">{title}</h2>
        <p className="mt-3 text-sm text-muted font-light">{body}</p>
        {linkHref && linkLabel && (
          <Link href={linkHref} className="inline-block mt-6 font-display text-xs tracking-widest uppercase font-semibold bg-ink hover:bg-terra text-cream px-6 py-3 rounded-full transition-colors">
            {linkLabel}
          </Link>
        )}
      </div>
    </div>
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
