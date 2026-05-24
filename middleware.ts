// ─── Middleware Next.js — Protection des routes admin ─────────────────────────
// Bloque l'accès aux routes /admin/* si le cookie de session admin est absent.
// Ce cookie (__ilu_admin) est posé par AdminProvider après vérification Firestore.
// Sécurité complémentaire : les Firestore Rules vérifient request.auth côté serveur.

import { type NextRequest, NextResponse } from 'next/server';

// Routes admin accessibles sans être connecté (page d'invitation)
const PUBLIC_ADMIN_PATHS = ['/admin/invitation'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Ne s'applique qu'aux routes /admin/*
  if (!pathname.startsWith('/admin')) return NextResponse.next();

  // Routes publiques de l'espace admin (invitations)
  if (PUBLIC_ADMIN_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Vérifier le cookie de session admin
  const adminCookie = request.cookies.get('__ilu_admin');
  if (!adminCookie || adminCookie.value !== '1') {
    const loginUrl = new URL('/connexion', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
