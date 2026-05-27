// ─── Admin Firestore helpers ───────────────────────────────────────────────────
// Collection: admins/{firebaseUid}
// Document ID = Firebase Auth UID du compte Google de l'admin.
// C'est la source de vérité pour savoir qui est admin et quel rôle il a.

import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  collection,
  getDocs,
} from 'firebase/firestore';
import { db } from './client';
import type { Admin, AdminPermission, AdminRole } from '@/lib/admin/types';

// ── Lecture ────────────────────────────────────────────────────────────────────

export async function getAdminByUid(uid: string): Promise<Admin | null> {
  try {
    // Timeout 8s — évite que getDoc reste bloqué indéfiniment si Firestore est lent
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000));
    const result = await Promise.race([
      getDoc(doc(db, 'admins', uid)),
      timeout,
    ]);
    if (!result || !('exists' in result)) return null; // timeout atteint
    if (result.exists()) return { id: uid, ...result.data() } as Admin;
    return null;
  } catch {
    return null;
  }
}

export function subscribeAdminByUid(
  uid: string,
  cb: (admin: Admin | null) => void,
): () => void {
  try {
    return onSnapshot(
      doc(db, 'admins', uid),
      (snap) => {
        if (snap.exists()) cb({ id: uid, ...snap.data() } as Admin);
        else cb(null);
      },
      () => cb(null),
    );
  } catch {
    cb(null);
    return () => {};
  }
}

export async function getAllAdmins(): Promise<Admin[]> {
  try {
    const snap = await getDocs(collection(db, 'admins'));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Admin));
  } catch {
    return [];
  }
}

// ── Écriture ───────────────────────────────────────────────────────────────────

export async function createAdminDoc(
  uid: string,
  data: {
    email: string;
    fullName: string;
    role: AdminRole;
    permissions: AdminPermission[];
    invitedBy?: string;
  },
): Promise<Admin> {
  // Firestore rejette les valeurs `undefined` → on construit l'objet sans les champs optionnels manquants
  const admin: Omit<Admin, 'id'> = {
    email: data.email,
    fullName: data.fullName,
    role: data.role,
    permissions: data.permissions,
    createdAt: new Date().toISOString(),
    ...(data.invitedBy !== undefined && { invitedBy: data.invitedBy }),
  };
  await setDoc(doc(db, 'admins', uid), {
    ...admin,
    createdAt: serverTimestamp(),
  });
  return { id: uid, ...admin };
}

// ── Bootstrap du premier admin principal ──────────────────────────────────────
// Appelé une seule fois lors de la première connexion Google de l'admin principal.
// Si aucun document n'existe pour ce UID, et que l'email correspond à l'admin
// principal configuré, le document est créé automatiquement.

const PRINCIPAL_EMAIL =
  process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? 'lievinkabamba1@gmail.com';

export async function bootstrapAdminIfNeeded(
  uid: string,
  email: string,
  displayName: string,
): Promise<Admin | null> {
  // Vérifier si un document admin existe déjà pour ce UID
  const existing = await getAdminByUid(uid);
  if (existing) {
    // Mettre à jour lastLogin (non bloquant — échec silencieux)
    setDoc(
      doc(db, 'admins', uid),
      { lastLogin: new Date().toISOString() },
      { merge: true },
    ).catch(() => {});
    return { ...existing, lastLogin: new Date().toISOString() };
  }

  // Pas encore dans Firestore → vérifier si c'est l'admin principal attendu
  if (email.toLowerCase() !== PRINCIPAL_EMAIL.toLowerCase()) return null;

  // Créer le document admin principal (première connexion)
  try {
    return await createAdminDoc(uid, {
      email,
      fullName: displayName || 'Lievin Kabamba',
      role: 'admin_principal',
      permissions: ['catalog', 'orders', 'editorial', 'clients', 'exchange_rate', 'notifications'],
    });
  } catch (err: unknown) {
    // Firestore permission-denied → les règles ne sont probablement pas déployées.
    // On lance une erreur lisible pour que la page login puisse l'afficher.
    const code = (err as { code?: string })?.code ?? 'unknown';
    throw new Error(`FIRESTORE_CREATE_FAILED:${code}`);
  }
}

// ── Acceptation d'une invitation ───────────────────────────────────────────────
// Appelé quand un admin secondaire se connecte avec Google pour la 1re fois.
// Vérifie que l'email Google correspond à une invitation en attente.

export async function acceptInvitationViaGoogle(
  uid: string,
  email: string,
  displayName: string,
  invitationPermissions: AdminPermission[],
  invitedBy: string,
): Promise<Admin> {
  return createAdminDoc(uid, {
    email,
    fullName: displayName,
    role: 'admin_secondary',
    permissions: invitationPermissions,
    invitedBy,
  });
}
