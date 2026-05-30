export type Currency = 'USD' | 'CDF';

export type Category = 'mode' | 'technologie' | 'hybrides' | 'services';

export type ProductStatus = 'active' | 'inactive' | 'featured';

export interface Product {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  priceUSD: number;
  oldPriceUSD?: number;
  category: Category;
  subcategory: string;
  tags: string[];
  status: ProductStatus;
  stock: number;
  rating?: number;
  reviewCount?: number;
  sizes?: string[];
  colors?: { name: string; hex: string; note?: string }[];
  images: string[];
  badge?: 'new' | 'sale' | 'hot' | 'featured';
  /** URLs Storage des images associées à chaque couleur (hex → URL) */
  colorImageUrls?: Record<string, string>;
  /** Spécifications produit (affichées sur la fiche, non sélectionnables par le client) */
  brand?: string;
  material?: string;
  ram?: string[];
  connectivity?: string[];
  /** Infos additionnelles */
  genre?: 'femme' | 'homme' | 'mixte' | 'enfant';
  modele?: string;
  platform?: string;
  deliveryMode?: 'activation_code' | 'configured_account' | 'direct_recharge';
  rdcAvailability?: 'confirmed' | 'to_verify' | 'limited';
  descriptionTone?: 'editorial' | 'commercial' | 'luxe' | 'jeune';
  /** URL de l'image de fond du hero carousel (photo lifestyle pleine page) */
  heroBgImage?: string;
}

export interface CartItem {
  productId: string;
  size?: string;
  color?: string;
  quantity: number;
  priceUSD?: number; // snapshotté au moment de la commande (P16)
}

export interface ChatMessage {
  id: string;
  sender: 'client' | 'admin' | 'system';
  content: string;
  time: string;
}
