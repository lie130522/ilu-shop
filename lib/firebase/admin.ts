// ─── ILU SHOP — Firebase Admin SDK (SERVEUR UNIQUEMENT) ───────────────────────
// Contourne les règles Firestore : à n'utiliser que dans app/api/*.
// En production (Firebase App Hosting), l'identité du service suffit (Application Default Credentials).
// En local : `gcloud auth application-default login`, ou FIREBASE_SERVICE_ACCOUNT_KEY (JSON du compte de service).

import { initializeApp, getApps, cert, applicationDefault, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';

function adminApp(): App {
  const existing = getApps()[0];
  if (existing) return existing;
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  return initializeApp({
    credential: serviceAccount ? cert(JSON.parse(serviceAccount)) : applicationDefault(),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
}

let configured = false;

// La base du projet s'appelle « default » (sans parenthèses), comme dans lib/firebase/client.ts.
export function adminDb(): Firestore {
  const db = getFirestore(adminApp(), 'default');
  if (!configured) {
    db.settings({ ignoreUndefinedProperties: true });
    configured = true;
  }
  return db;
}

export const adminAuth = (): Auth => getAuth(adminApp());
