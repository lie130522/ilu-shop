// ─── Firebase Client SDK ──────────────────────────────────────────────────────
// Initialisation unique du SDK Firebase côté navigateur.
// Les variables NEXT_PUBLIC_* sont exposées au client (préfixe obligatoire).

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Éviter la réinitialisation lors du hot-reload Next.js
// Vérifier que la config est complète avant d'initialiser
const isConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId,
);

const app: FirebaseApp = isConfigured
  ? (getApps().length ? getApp() : initializeApp(firebaseConfig))
  : (getApps().length ? getApp() : initializeApp({ apiKey: 'not-configured', projectId: 'not-configured', appId: 'not-configured' }));

const auth: Auth = getAuth(app);
const db: Firestore = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export { app, auth, db, googleProvider, isConfigured };
