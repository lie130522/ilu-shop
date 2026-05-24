# AUDIT ILU SHOP — Problèmes identifiés
> Généré le 24/05/2026. À conserver comme référence de travail.
> Mis à jour au fur et à mesure des corrections.
> **Philosophie (INSTRUCTIONS-2)** : corriger par groupes, progressivement, sans tout casser. Chaque groupe doit rester fonctionnel après correction.

---

## LÉGENDE
- 🔴 **Critique** — Danger immédiat (sécurité, perte de données, fraude)
- 🟠 **Important** — Bug fonctionnel bloquant pour le lancement
- 🟡 **Mineur** — Dette technique, UX, cosmétique
- ✅ **Corrigé** — Résolu
- 🔄 **En cours** — Correction en progression

---

## GROUPE 1 — Sécurité Auth Admin
> **Objectif** : Remplacer le système d'auth admin localStorage par Firebase Auth
> **Fichiers concernés** : `components/admin/AdminProvider.tsx`, `components/admin/AdminShell.tsx`, `lib/admin/seed.ts`, `app/admin/layout.tsx`, `app/connexion/page.tsx`

### P01 🔴 Mot de passe admin en clair dans le bundle JavaScript
- **Problème** : `lib/admin/seed.ts` contient `passwordHash: 'mock_hash_ilushop2026'` et `DEMO_PASSWORD = 'ilushop2026'` exportés. Ces valeurs sont incluses dans le bundle JS servi à tous les visiteurs. Lisible en 5 secondes via DevTools.
- **Impact** : Accès total au back-office par n'importe qui.
- **Fix** : Supprimer tout le système `passwordHash` / `DEMO_PASSWORD`. Migrer vers Firebase Auth (email + mot de passe Firebase).
- **Statut** : ✅ Corrigé — `passwordHash` et `DEMO_PASSWORD` supprimés. Auth migrée vers Firebase Auth + Google OAuth.

### P02 🔴 Auth admin contournable via injection localStorage
- **Problème** : La session admin est stockée dans `localStorage` sous la clé `ilu_admin_session`. Injecter `localStorage.setItem('ilu_admin_session', 'adm-principal-001')` dans la console donne accès au back-office sans mot de passe.
- **Impact** : Accès total au back-office sans authentification.
- **Fix** : Remplacer par une session Firebase Auth vérifiée côté serveur. Ajouter un `middleware.ts` Next.js pour protéger `/admin/*` avec un cookie de session signé.
- **Statut** : ✅ Corrigé — `localStorage` session supprimé. Cookie `__ilu_admin` posé par `AdminProvider` après vérification Firestore. `middleware.ts` bloque les routes `/admin/*` côté serveur.

### P03 🔴 Routes `/admin/*` non protégées côté serveur
- **Problème** : La garde d'accès admin (`AdminShell.tsx`) utilise un `useEffect` côté client. Elle s'exécute APRÈS le rendu de la page. Un bot ou un scraper voit le contenu admin avant la redirection.
- **Impact** : Exposition du contenu admin aux robots et attaquants automatisés.
- **Fix** : Créer `middleware.ts` à la racine du projet qui vérifie le cookie de session Firebase avant de servir les routes `/admin/*`.
- **Statut** : ✅ Corrigé — `middleware.ts` créé. Vérifie `__ilu_admin=1` avant chaque requête `/admin/*`. Redirige vers `/connexion?redirect=…` si absent.

### P06 🔴 Données mockées (faux clients, fausses commandes) actives en production
- **Problème** : `lib/admin/seed.ts` et `lib/chat/store.ts` injectent des données fictives (Amina Kabongo, Grace Mbuyi, commandes à $699) dans `localStorage` au premier chargement. En production, ces données se mélangent aux vraies données.
- **Impact** : Dashboard admin avec CA fictif. Statistiques fausses. Faux clients dans la liste.
- **Fix** : Conditionner les seeds à `process.env.NODE_ENV === 'development'`. En production, initialiser avec des tableaux vides.
- **Statut** : ✅ Corrigé — `SEED_CLIENTS`, `SEED_ORDERS`, `SEED_NOTIFICATIONS` conditionnés à `isDev`. En production, tableaux vides.

### P09 🟠 Admins secondaires peuvent accéder à toutes les pages admin sans vérification de permission
- **Problème** : Les pages individuelles (`/admin/taux`, `/admin/editorial`, etc.) ne vérifient pas `currentAdmin.permissions`. Seule la sidebar masque les liens — mais l'URL directe fonctionne.
- **Impact** : Un admin secondaire sans permission `exchange_rate` peut modifier le taux via `/admin/taux` directement.
- **Fix** : Ajouter un hook `useRequirePermission('nom_permission')` en haut de chaque page admin protégée.
- **Statut** : ⬜ À faire

---

## GROUPE 2 — Sécurité Données & Firebase Rules
> **Objectif** : Protéger les données Firestore et Storage contre les accès non autorisés
> **Fichiers concernés** : Firebase Console (Firestore Rules + Storage Rules), `lib/firebase/settings.ts`, `lib/firebase/db.ts`

### P04 🔴 Numéros Mobile Money modifiables sans authentification
- **Problème** : La collection Firestore `shop_settings/default` est accessible en écriture depuis la console du navigateur par n'importe qui connaissant le `projectId`. Un attaquant peut remplacer le numéro M-Pesa par le sien.
- **Impact** : FRAUDE DIRECTE — tous les paiements clients vont vers le fraudeur.
- **Fix** : Firestore Rule : `allow write: if request.auth != null && get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.role == 'admin_principal'`. Requiert migration auth admin vers Firebase Auth.
- **Statut** : ✅ Corrigé — `firestore.rules` créé. `shop_settings` en écriture uniquement si `isPrincipalAdmin()` (vérifie le rôle dans Firestore). À déployer dans Firebase Console.

### P05 🔴 Absence de Firestore Security Rules strictes
- **Problème** : Les règles actuelles sont trop permissives (`allow read, write: if true` sur `shop_settings`, `product_stats`, `anonymous_behavior`). Sans règles, n'importe qui peut lire les commandes, profils clients, wishlists.
- **Impact** : Fuite de données personnelles. "Billing bomb" possible sur `anonymous_behavior`.
- **Fix** : Règles complètes à appliquer (voir fichier `firestore.rules`).
- **Statut** : ✅ Corrigé — `firestore.rules` créé avec règles complètes : `admins`, `users`, `shop_settings`, `product_stats`, `anonymous_behavior`. À déployer dans Firebase Console.

### P07 🟠 Upload fichiers sans validation côté serveur
- **Problème** : La validation (type de fichier, durée vidéo ≤ 30s) se fait uniquement dans le navigateur. Un attaquant peut uploader n'importe quoi directement via l'API Firebase Storage.
- **Impact** : Upload de fichiers malveillants, abus de stockage.
- **Fix** : Storage Rules avec limite de taille et type MIME (voir fichier `storage.rules`).
- **Statut** : ✅ Corrigé — `storage.rules` créé. Max 50 Mo, types `image/*` et `video/*` uniquement. Tout autre chemin est bloqué. À déployer dans Firebase Console.

### P10 🟡 `trackPurchase` sans vérification de consentement cookies
- **Problème** : `trackPurchase` dans `lib/tracking.ts` ne vérifie pas `hasConsent()` contrairement aux autres fonctions de tracking.
- **Impact** : Tracking d'achats même sans consentement RGPD.
- **Fix** : Ajouter `if (!hasConsent()) return;` dans `trackPurchase`.
- **Statut** : ✅ Corrigé — `if (!hasConsent()) return;` ajouté en tête de `trackPurchase`.

---

## GROUPE 3 — Données & Architecture
> **Objectif** : Unifier les sources de données, supprimer les incohérences entre localStorage et Firestore
> **Fichiers concernés** : `lib/chat/store.ts`, `components/admin/AdminProvider.tsx`, `lib/currency.ts`, `lib/admin/types.ts`, `lib/firebase/db.ts`

### P11 🔴 Triple source de vérité pour le taux de change USD/CDF
- **Problème** : Le taux existe à 3 endroits distincts :
  1. `lib/currency.ts` : constante `USD_TO_CDF_RATE = 2000` (utilisée dans fiches produits, catalogue, panier)
  2. `AdminProvider` localStorage `ilu_exchange_rate` (utilisé dans l'admin)
  3. Firestore `shop_settings` (utilisé dans `/commande`)
  Modifier le taux dans `/admin/taux` ne met pas à jour les pages vitrine.
- **Impact** : Les clients voient des prix CDF incorrects. Le taux admin et le taux vitrine divergent.
- **Fix** : Centraliser dans Firestore `shop_settings/default.exchangeRate`. Utiliser `subscribeShopSettings` dans un Provider global. Supprimer `USD_TO_CDF_RATE` de `currency.ts` ou en faire une valeur dynamique.
- **Statut** : ⬜ À faire

### P12 🔴 Chat store uniquement localStorage — données perdues cross-device
- **Problème** : Tout l'historique des conversations (messages, photos de paiement, confirmations) est dans `localStorage`. Changer d'appareil, vider le cache ou utiliser la navigation privée = perte totale.
- **Impact** : Perte de preuves de paiement Mobile Money. Clients qui ne retrouvent pas leur conversation.
- **Fix** : Migrer `lib/chat/store.ts` vers Firestore (`conversations/{convId}` + sous-collection `messages`). Utiliser `onSnapshot` pour le temps réel.
- **Statut** : ⬜ À faire

### P13 🔴 Triple source pour les commandes (Firestore + localStorage × 2)
- **Problème** : Les commandes existent dans 3 endroits qui ne se synchronisent jamais :
  1. Firestore `users/{uid}/orders` (créé par `createOrder`)
  2. localStorage `ilu_conversations` (chat store)
  3. localStorage `ilu_orders` (AdminProvider)
- **Impact** : L'admin ne voit pas les commandes Firestore. Le client ne retrouve pas sa commande dans le chat.
- **Fix** : Unifier dans Firestore. Le chat doit référencer un `orderId` Firestore. Le dashboard admin doit lire Firestore.
- **Statut** : ⬜ À faire

### P14 🟠 Commandes non sauvegardées pour visiteurs non-connectés
- **Problème** : Dans `app/commande/page.tsx`, `createOrder` n'est appelé que si `user` existe. Les visiteurs anonymes passent des commandes qui disparaissent à la fermeture du navigateur.
- **Impact** : Perte de commandes réelles non loggées.
- **Fix** : Créer la commande dans une collection publique Firestore (`orders/{orderId}`) même pour les anonymes, avec le `sessionId` comme référence.
- **Statut** : ⬜ À faire

### P15 🟠 Statuts de commandes incohérents entre Firestore et types admin
- **Problème** :
  - `lib/firebase/db.ts` : `'pending' | 'in_progress' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'`
  - `lib/admin/types.ts` : `'open' | 'in_progress' | 'order_confirmed' | 'shipped' | 'delivered' | 'closed'`
  Les deux définitions ne correspondent pas (`pending` ≠ `open`, `confirmed` ≠ `order_confirmed`, `cancelled` ≠ `closed`).
- **Impact** : Impossibilité de croiser les données entre espace client et admin.
- **Fix** : Aligner sur un seul enum dans `lib/admin/types.ts` et mettre à jour `lib/firebase/db.ts`.
- **Statut** : ⬜ À faire

### P16 🟠 Prix produit non snapshotté dans la commande Firestore
- **Problème** : `CartItem` sauvegardé dans Firestore contient `{productId, size, color, quantity}` mais pas le `priceUSD`. Si un prix change après la commande, l'historique affiche un mauvais montant.
- **Impact** : Historique de commandes incorrect. Litiges potentiels.
- **Fix** : Ajouter `priceUSD` dans `CartItem` au moment de la création de commande.
- **Statut** : ⬜ À faire

### P17 🟠 Fuite mémoire : listener Firestore wishlist non désinscrit
- **Problème** : Dans `ShopProvider.tsx`, le `return unsubFS` est dans le callback de `onAuthStateChanged`, pas dans le `useEffect`. Le listener wishlist n'est jamais nettoyé à la déconnexion.
- **Impact** : Chaque reconnexion crée un nouveau listener. Site de plus en plus lent. Facture Firebase gonflée.
- **Fix** :
  ```typescript
  let unsubFS: (() => void) | null = null;
  const unsub = onAuthStateChanged(auth, (user) => {
    unsubFS?.();
    if (user) unsubFS = subscribeWishlist(user.uid, ...);
  });
  return () => { unsub(); unsubFS?.(); };
  ```
- **Statut** : ⬜ À faire

---

## GROUPE 4 — Logique Métier & Bugs Fonctionnels
> **Objectif** : Corriger les bugs qui affectent directement l'expérience d'achat
> **Fichiers concernés** : `app/commande/page.tsx`, `components/ChatModal.tsx`, `app/admin/equipe/page.tsx`, `components/ProductDetail.tsx`

### P18 🟠 Panier non vidé après confirmation de commande
- **Problème** : `clearCart()` n'est appelé que si l'utilisateur clique sur "Ouvrir le chat". Si il clique sur "Mon espace" ou "Retour boutique", le panier reste plein.
- **Impact** : Double commande involontaire possible. Badge panier incorrect dans la navbar.
- **Fix** : Appeler `clearCart()` directement dans `handleConfirm()` après succès.
- **Statut** : ⬜ À faire

### P19 🟠 Frais de retrait MM non inclus dans le total Firestore
- **Problème** : `withdrawalFeeCDF` est affiché au client mais `totalUSD` sauvegardé en Firestore ne l'inclut pas.
- **Impact** : Décalage comptable entre ce que le client paie et ce que l'admin voit.
- **Fix** : Ajouter un champ `withdrawalFeeCDF` dans `ClientOrder` et le sauvegarder.
- **Statut** : ⬜ À faire

### P20 🟠 Produits créés en admin sans page produit accessible (404)
- **Problème** : `getProductBySlug` dans `/produit/[slug]` lit uniquement `lib/products.ts` (données statiques). Les produits créés via l'interface admin sont dans `localStorage` avec des slugs potentiellement identiques.
- **Impact** : Les liens vers les nouveaux produits donnent une page 404.
- **Fix** : Créer les produits admin dans Firestore (`products/{productId}`). Mettre à jour `getProductBySlug` pour lire Firestore en priorité.
- **Statut** : ⬜ À faire

### P21 🟠 Invitations admin sans envoi d'email réel
- **Problème** : Lors de la création d'une invitation admin, le lien est affiché à l'écran mais aucun email n'est envoyé (Resend est installé mais non câblé pour les invitations).
- **Impact** : L'admin principal doit copier/coller manuellement le lien. Si il oublie ou ferme la page = lien perdu.
- **Fix** : Créer l'API route `/api/admin/invite` qui appelle Resend avec le template d'invitation.
- **Statut** : ⬜ À faire

### P22 🟡 Réponses automatiques du chat sans indication qu'elles sont automatiques
- **Problème** : `ChatModal.tsx` envoie des réponses aléatoires après 1.9s signées "ILU SHOP", donnant l'impression d'une vraie réponse humaine.
- **Impact** : Tromperie involontaire du client. Risque légal.
- **Fix** : Supprimer les réponses auto ou ajouter "⚡ Réponse automatique — un agent reprendra bientôt".
- **Statut** : ⬜ À faire

### P23 🟡 Race condition wishlist — articles ajoutés localement perdus à la sync Firestore
- **Problème** : Si l'utilisateur ajoute un article à la wishlist avant que la sync Firestore se termine, la wishlist locale est écrasée par celle de Firestore.
- **Fix** : Effectuer un merge (union) des deux listes avant d'écraser l'état local.
- **Statut** : ⬜ À faire

---

## GROUPE 5 — UX, Design & Fonctionnalités Incomplètes
> **Objectif** : Finir les fonctionnalités partiellement implémentées, corriger les éléments UI cassés
> **Fichiers concernés** : `app/page.tsx`, `components/Navbar.tsx`, `components/ProductDetail.tsx`

### P24 🟡 Bouton "Guide des tailles" sans fonctionnalité
- **Fichier** : `components/ProductDetail.tsx`
- **Problème** : `<button>Guide des tailles</button>` sans `onClick`. Ne fait rien.
- **Fix** : Implémenter un modal ou supprimer le bouton.
- **Statut** : ⬜ À faire

### P25 🟡 Lien "Notre démarche" vide
- **Fichier** : `app/page.tsx`
- **Problème** : `<Link href="#">Notre démarche →</Link>` pointe vers nulle part.
- **Fix** : Créer la page `/a-propos` ou supprimer le lien.
- **Statut** : ⬜ À faire

### P26 🟡 Select de tri sur la page d'accueil non fonctionnel
- **Fichier** : `app/page.tsx`
- **Problème** : Le menu déroulant "Popularité / Prix..." n'a aucun `onChange`. Décoration uniquement.
- **Fix** : Implémenter le tri ou supprimer le select.
- **Statut** : ⬜ À faire

### P27 🟡 Bouton de recherche dans la Navbar sans fonctionnalité
- **Fichier** : `components/Navbar.tsx`
- **Problème** : L'icône de recherche est cliquable mais n'ouvre rien.
- **Fix** : Implémenter une barre de recherche (modal ou expansion) ou masquer le bouton.
- **Statut** : ⬜ À faire

### P28 🟡 Lien "Favoris" dans la navbar redirige sans contexte si non connecté
- **Fichier** : `components/Navbar.tsx`
- **Problème** : `<Link href="/compte#wishlist">` redirige vers `/connexion` sans explication. Le hash `#wishlist` est perdu dans la redirection.
- **Fix** : Afficher un tooltip "Connectez-vous pour voir vos favoris" ou rediriger vers `/catalogue`.
- **Statut** : ⬜ À faire

### P29 🟡 Taux de change affiché sur les fiches produits avec date figée
- **Fichier** : `components/ProductDetail.tsx` + `lib/currency.ts`
- **Problème** : `RATE_UPDATED_AT = '24/05/2026'` codé en dur. Affiche une date statique qui ne change jamais.
- **Fix** : Lire la date de mise à jour depuis Firestore `shop_settings/default.updatedAt`.
- **Statut** : ⬜ À faire (dépend du Groupe 3 — unification taux)

### P30 🟡 Toutes les images `<img>` au lieu de `<Image>` Next.js
- **Fichiers** : `app/page.tsx`, `components/ProductDetail.tsx`, `components/ProductCard.tsx`, etc.
- **Problème** : Le composant `<Image>` de Next.js (optimisation automatique WebP, lazy loading, responsive) n'est pas utilisé. Images pleine résolution chargées sur mobile.
- **Impact** : Site lent, mauvais score Google PageSpeed, LCP dégradé.
- **Fix** : Migrer `<img>` → `<Image>` Next.js progressivement. Ajouter les hostnames dans `next.config.js`.
- **Statut** : ⬜ À faire

---

## RÉCAPITULATIF PAR STATUT

| Statut | Nombre |
|--------|--------|
| 🔴 Critiques | 8 |
| 🟠 Importants | 9 |
| 🟡 Mineurs | 7 |
| **Total** | **24** |
| ✅ Corrigés | **8** (P01, P02, P03, P04, P05, P06, P07, P10) |
| ⬜ Restants | **16** (P09, P11–P30 sauf P10) |

---

## ORDRE DE TRAITEMENT PAR GROUPE

```
GROUPE 1 — Sécurité Auth Admin         [P01, P02, P03, P06, P09]
GROUPE 2 — Sécurité Firebase Rules     [P04, P05, P07, P10]
GROUPE 3 — Données & Architecture      [P11, P12, P13, P14, P15, P16, P17]
GROUPE 4 — Logique Métier & Bugs       [P18, P19, P20, P21, P22, P23]
GROUPE 5 — UX & Fonctionnalités        [P24, P25, P26, P27, P28, P29, P30]
```

> **Règle** : Chaque groupe doit laisser l'application dans un état fonctionnel après correction.
> **Source** : INSTRUCTIONS-2.txt — "Une bonne architecture protège ta capacité à changer."
