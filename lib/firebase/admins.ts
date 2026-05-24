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
    const snap = await getDoc(doc(db, 'admins', uid));
    if (snap.exists()) return { id: uid, ...snap.data() } as Admin;
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
  const admin: Omit<Admin, 'id'> = {
    email: data.email,
    fullName: data.fullName,
    role: data.role,
    permissions: data.permissions,
    invitedBy: data.invitedBy,
    createdAt: new Date().toISOString(),
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
  // Vérifier si un document existe déjà
  const existing = await getAdminByUid(uid);
  if (existing) {
    // Mettre à jour lastLogin
    await setDoc(
      doc(db, 'admins', uid),
      { lastLogin: new Date().toISOString() },
      { merge: true },
    );
    return { ...existing, lastLogin: new Date().toISOString() };
  }

  // Seulement créer si c'est l'email de l'admin principal
  if (email.toLowerCase() !== PRINCIPAL_EMAIL.toLowerCase()) return null;

  return createAdminDoc(uid, {
    email,
    fullName: displayName || 'Lievin Kabamba',
    role: 'admin_principal',
    permissions: ['catalog', 'orders', 'editorial', 'clients', 'exchange_rate', 'notifications'],
  });
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
