export type Currency = 'USD' | 'CDF';

export type Category = 'mode' | 'telephones' | 'ordinateurs' | 'tablettes';

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
  colors?: { name: string; hex: string }[];
  images: string[];
  badge?: 'new' | 'sale' | 'hot' | 'featured';
}

export interface CartItem {
  productId: string;
  size?: string;
  color?: string;
  quantity: number;
}

export interface ChatMessage {
  id: string;
  sender: 'client' | 'admin' | 'system';
  content: string;
  time: string;
}
