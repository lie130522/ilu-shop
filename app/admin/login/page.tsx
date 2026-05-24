import { redirect } from 'next/navigation';

// La connexion admin est maintenant unifiée sur /connexion
// AdminProvider détecte automatiquement si l'email est admin et redirige vers /admin
export default function AdminLoginPage() {
  redirect('/connexion');
}
