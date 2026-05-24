import type {
  Admin,
  Client,
  OrderConversation,
  AdminNotification,
  Invitation,
  ChatMessageRecord,
} from './types';

const isDev = process.env.NODE_ENV === 'development';

function msg(
  id: string,
  sender: ChatMessageRecord['sender'],
  content: string,
  createdAt: string,
  readByAdmin = true,
  readByClient = true,
): ChatMessageRecord {
  return { id, sender, content, createdAt, readByAdmin, readByClient };
}

// Principal admin — identifié par Firebase Auth UID via Firestore `admins/{uid}`
export const SEED_PRINCIPAL_ADMIN: Admin = {
  id: 'adm-principal-001',
  email: 'lievinkabamba1@gmail.com',
  fullName: 'Lievin Kabamba',
  role: 'admin_principal',
  permissions: ['catalog', 'orders', 'editorial', 'clients', 'exchange_rate', 'notifications'],
  createdAt: '2026-01-15T08:00:00Z',
  lastLogin: '2026-05-24T08:30:00Z',
};

// ─── Données de démonstration — UNIQUEMENT en développement ────────────────
// En production, ces tableaux sont vides. Les vraies données viennent de Firestore.

export const SEED_CLIENTS: Client[] = isDev ? [
  {
    id: 'cli-001',
    email: 'amina.kabongo@gmail.com',
    fullName: 'Amina Kabongo',
    phone: '+243 81 234 5678',
    city: 'Kinshasa, Gombe',
    createdAt: '2026-03-12T14:22:00Z',
    ordersCount: 3,
    totalSpentUSD: 287,
  },
  {
    id: 'cli-002',
    email: 'mukendi.j@outlook.com',
    fullName: 'Junior Mukendi',
    phone: '+243 99 555 1212',
    city: 'Kinshasa, Lemba',
    createdAt: '2026-04-02T09:10:00Z',
    ordersCount: 1,
    totalSpentUSD: 89,
  },
  {
    id: 'cli-003',
    email: 'sarah.lumumba@gmail.com',
    fullName: 'Sarah Lumumba',
    phone: '+243 82 111 4499',
    city: 'Lubumbashi',
    createdAt: '2026-04-18T11:45:00Z',
    ordersCount: 5,
    totalSpentUSD: 612,
  },
  {
    id: 'cli-004',
    email: 'patrick.tshisekedi@yahoo.fr',
    fullName: 'Patrick Tshisekedi',
    city: 'Goma',
    createdAt: '2026-05-01T16:30:00Z',
    ordersCount: 2,
    totalSpentUSD: 145,
  },
  {
    id: 'cli-005',
    email: 'grace.mbuyi@gmail.com',
    fullName: 'Grace Mbuyi',
    phone: '+243 85 777 0011',
    city: 'Kinshasa, Limete',
    createdAt: '2026-05-10T19:15:00Z',
    ordersCount: 4,
    totalSpentUSD: 423,
  },
] : [];

export const SEED_ORDERS: OrderConversation[] = isDev ? [
  {
    id: 'ord-001',
    clientId: 'cli-001',
    clientName: 'Amina Kabongo',
    status: 'open',
    itemsLabel: 'Veste Cargo Beige + Sneakers Blanc',
    totalUSD: 138,
    lastMessage: 'Bonjour, est-ce que la veste est disponible en M ?',
    lastMessageAt: '2026-05-24T10:32:00Z',
    unreadCount: 2,
    createdAt: '2026-05-24T10:25:00Z',
    messages: [
      msg('m-001-1', 'system', 'Panier : Veste Cargo Beige (M) + Sneakers Blanc (41) — $138.00', '2026-05-24T10:25:00Z'),
      msg('m-001-2', 'client', 'Bonjour ! Je voudrais commander cette veste.', '2026-05-24T10:26:00Z', false, true),
      msg('m-001-3', 'client', 'Bonjour, est-ce que la veste est disponible en M ?', '2026-05-24T10:32:00Z', false, true),
    ],
  },
  {
    id: 'ord-002',
    clientId: 'cli-005',
    clientName: 'Grace Mbuyi',
    status: 'in_progress',
    assignedAdminId: 'adm-principal-001',
    itemsLabel: 'Cabas Cuir Terracotta',
    totalUSD: 145,
    paymentMethod: 'M-Pesa',
    lastMessage: 'Parfait, je vous envoie le numéro M-Pesa dans un instant.',
    lastMessageAt: '2026-05-24T09:58:00Z',
    unreadCount: 0,
    createdAt: '2026-05-24T09:42:00Z',
    messages: [
      msg('m-002-1', 'system', 'Panier : Cabas Cuir Terracotta — $145.00', '2026-05-24T09:42:00Z'),
      msg('m-002-2', 'client', 'Bonjour, je peux payer en M-Pesa ?', '2026-05-24T09:43:00Z'),
      msg('m-002-3', 'admin', 'Bonjour Grace ! Oui, M-Pesa accepté. Livraison à Limete sous 24h.', '2026-05-24T09:55:00Z'),
      msg('m-002-4', 'client', 'Parfait ça me va.', '2026-05-24T09:57:00Z'),
      msg('m-002-5', 'admin', 'Parfait, je vous envoie le numéro M-Pesa dans un instant.', '2026-05-24T09:58:00Z'),
    ],
  },
  {
    id: 'ord-003',
    clientId: 'cli-003',
    clientName: 'Sarah Lumumba',
    status: 'order_confirmed',
    assignedAdminId: 'adm-principal-001',
    itemsLabel: 'Manteau Laine Camel',
    totalUSD: 220,
    paymentMethod: 'Airtel Money',
    lastMessage: 'Paiement reçu ✓ Commande confirmée, expédition demain.',
    lastMessageAt: '2026-05-23T18:15:00Z',
    unreadCount: 0,
    createdAt: '2026-05-23T16:00:00Z',
    messages: [
      msg('m-003-1', 'system', 'Panier : Manteau Laine Camel (L) — $220.00', '2026-05-23T16:00:00Z'),
      msg('m-003-2', 'client', 'Je prends celui-ci. Airtel Money svp.', '2026-05-23T16:05:00Z'),
      msg('m-003-3', 'admin', 'Voici le numéro : +243 99 XXX XXXX. Confirmez quand vous avez payé.', '2026-05-23T16:30:00Z'),
      msg('m-003-4', 'client', 'Paiement envoyé !', '2026-05-23T18:10:00Z'),
      msg('m-003-5', 'admin', 'Paiement reçu ✓ Commande confirmée, expédition demain.', '2026-05-23T18:15:00Z'),
    ],
  },
] : [];

export const SEED_NOTIFICATIONS: AdminNotification[] = isDev ? [
  {
    id: 'notif-001',
    type: 'new_message',
    title: 'Nouveau message — Amina Kabongo',
    body: '"Bonjour, est-ce que la veste est disponible en M ?"',
    referenceId: 'ord-001',
    read: false,
    createdAt: '2026-05-24T10:32:00Z',
  },
  {
    id: 'notif-002',
    type: 'new_order',
    title: 'Nouvelle commande — Rachel Mukendi',
    body: 'Robe Fluide Terracotta • $78.00',
    referenceId: 'ord-005',
    read: false,
    createdAt: '2026-05-24T07:48:00Z',
  },
] : [];

export const SEED_INVITATIONS: Invitation[] = [];

export const ADMIN_MAX = 3;
