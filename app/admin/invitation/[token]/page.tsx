'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { isAdminError, useAdmin } from '@/components/admin/AdminProvider';
import { PERMISSION_LABEL } from '@/lib/admin/types';

export default function AdminInvitationPage({ params }: { params: { token: string } }) {
  const { getInvitationByToken, acceptInvitation } = useAdmin();
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
        linkHref="/admin/login"
        linkLabel="Aller à la connexion"
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Le mot de passe doit faire au moins 8 caractères.');
      return;
    }
    if (password !== confirm) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    if (fullName.trim().length < 2) {
      setError('Veuillez renseigner votre nom complet.');
      return;
    }

    setLoading(true);
    const result = acceptInvitation(params.token, fullName.trim(), password);
    setLoading(false);

    if (isAdminError(result)) {
      setError(result.message);
      return;
    }

    router.push('/admin/login?activated=1');
  };

  const expiresIn = Math.max(
    0,
    Math.floor((new Date(invitation.expiresAt).getTime() - Date.now()) / 3600000),
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-bone">
      <div className="w-full max-w-lg bg-cream border border-line rounded-lg p-8 lg:p-10">
        <Link href="/" className="flex items-baseline gap-2 mb-8">
          <span className="font-display font-extrabold text-2xl tracking-[0.18em] text-terra">
            ILU
          </span>
          <span className="font-display font-extrabold text-2xl tracking-[0.18em] text-ink">
            ADMIN.
          </span>
        </Link>

        <span className="font-display text-[10px] tracking-[0.35em] uppercase text-terra font-semibold">
          ✦ Invitation reçue
        </span>
        <h1 className="mt-3 font-display font-extrabold text-3xl md:text-4xl text-ink leading-tight">
          Activez votre<br />compte admin.
        </h1>
        <p className="mt-3 text-sm text-muted font-light">
          Vous avez été invité par l'admin principal à rejoindre l'équipe ILU SHOP.
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
                <span
                  key={p}
                  className="bg-cream border border-line text-[11px] font-medium px-2.5 py-1 rounded"
                >
                  {PERMISSION_LABEL[p]}
                </span>
              ))}
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-line text-[11px] text-muted font-light">
            ⏱ Lien valide encore {expiresIn}h • Usage unique
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Field label="Votre nom complet">
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="w-full bg-cream border border-line rounded-md px-4 py-3 text-sm outline-none focus:border-terra transition-colors"
              placeholder="Prénom Nom"
            />
          </Field>

          <Field label="Mot de passe (min. 8 caractères)">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full bg-cream border border-line rounded-md px-4 py-3 text-sm outline-none focus:border-terra transition-colors"
              placeholder="••••••••"
            />
          </Field>

          <Field label="Confirmer le mot de passe">
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
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
            className="w-full h-12 rounded-full bg-terra hover:bg-terra-dark text-cream font-display text-xs font-semibold tracking-[0.25em] uppercase transition-colors disabled:opacity-50"
          >
            {loading ? 'Activation…' : 'Activer mon compte'}
          </button>
        </form>
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

function Row({
  label,
  value,
  tag,
}: {
  label: string;
  value: string;
  tag?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="font-display text-[10px] tracking-widest uppercase text-muted font-semibold">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <span className="font-medium text-ink">{value}</span>
        {tag}
      </div>
    </div>
  );
}

function InfoBox({
  tone,
  title,
  body,
  linkHref,
  linkLabel,
}: {
  tone: 'error' | 'info';
  title: string;
  body: string;
  linkHref?: string;
  linkLabel?: string;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-bone">
      <div className="w-full max-w-md bg-cream border border-line rounded-lg p-8 text-center">
        <div
          className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center text-3xl ${
            tone === 'error' ? 'bg-terra/15 text-terra' : 'bg-bone text-muted'
          }`}
        >
          {tone === 'error' ? '⚠' : 'ⓘ'}
        </div>
        <h2 className="mt-6 font-display font-extrabold text-2xl text-ink">{title}</h2>
        <p className="mt-3 text-sm text-muted font-light">{body}</p>
        {linkHref && linkLabel && (
          <Link
            href={linkHref}
            className="inline-block mt-6 font-display text-xs tracking-widest uppercase font-semibold bg-ink hover:bg-terra text-cream px-6 py-3 rounded-full transition-colors"
          >
            {linkLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
