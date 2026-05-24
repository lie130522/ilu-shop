export type AdminRole = 'admin_principal' | 'admin_secondary';

export type AdminPermission =
  | 'catalog'
  | 'orders'
  | 'editorial'
  | 'clients'
  | 'exchange_rate'
  | 'notifications';

export interface Admin {
  id: string;
  email: string;
  fullName: string;
  role: AdminRole;
  permissions: AdminPermission[];
  invitedBy?: string;
  createdAt: string;
  lastLogin?: string;
  passwordHash: string;
}

export interface Invitation {
  id: string;
  token: string;
  email: string;
  permissions: AdminPermission[];
  invitedBy: string;
  createdAt: string;
  expiresAt: string;
  usedAt?: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
}

export interface Client {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  city: string;
  createdAt: string;
  ordersCount: number;
  totalSpentUSD: number;
}

export type OrderStatus =
  | 'open'
  | 'in_progress'
  | 'order_confirmed'
  | 'shipped'
  | 'delivered'
  | 'closed';

export interface ChatMessageRecord {
  id: string;
  sender: 'client' | 'admin' | 'system';
  content: string;
  createdAt: string;
  readByAdmin?: boolean;
  readByClient?: boolean;
}

export interface OrderConversation {
  id: string;
  clientId: string;
  clientName: string;
  status: OrderStatus;
  assignedAdminId?: string;
  itemsLabel: string;
  totalUSD: number;
  paymentMethod?: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  createdAt: string;
  messages: ChatMessageRecord[];
}

export type NotificationType = 'new_message' | 'new_order' | 'new_client' | 'system';

export interface AdminNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  referenceId?: string;
  read: boolean;
  createdAt: string;
}

export const ROLE_LABEL: Record<AdminRole, string> = {
  admin_principal: 'Admin principal',
  admin_secondary: 'Admin secondaire',
};

export const PERMISSION_LABEL: Record<AdminPermission, string> = {
  catalog: 'Catalogue',
  orders: 'Commandes & Chat',
  editorial: 'Éditorial',
  clients: 'Clients',
  exchange_rate: 'Taux de change',
  notifications: 'Notifications',
};

export const STATUS_LABEL: Record<OrderStatus, string> = {
  open: 'En attente',
  in_progress: 'En cours',
  order_confirmed: 'Confirmée',
  shipped: 'Expédiée',
  delivered: 'Livrée',
  closed: 'Terminée',
};

export const STATUS_TONE: Record<OrderStatus, string> = {
  open: 'bg-terra/15 text-terra-dark border-terra/30',
  in_progress: 'bg-gold/15 text-[#7A5A15] border-gold/30',
  order_confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  shipped: 'bg-blue-50 text-blue-700 border-blue-200',
  delivered: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  closed: 'bg-beige text-muted border-line',
};
