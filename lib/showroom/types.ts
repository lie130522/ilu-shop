// ─── ILU SHOP — Showroom Types ────────────────────────────────────────────────

export type OutfitCategory = 'casual' | 'business' | 'soiree' | 'streetwear' | 'tech';
export type OutfitBadgeType = 'new' | 'promo';

export const OUTFIT_CATEGORY_LABEL: Record<OutfitCategory, string> = {
  casual: 'Casual',
  business: 'Business',
  soiree: 'Soirée',
  streetwear: 'Streetwear',
  tech: 'Tech outfit',
};

export const OUTFIT_ITEM_CATEGORY_EMOJI: Record<string, string> = {
  Mode: '👕',
  Chaussures: '👟',
  Bijou: '💍',
  Accessoire: '👜',
  Tech: '📱',
  Wearable: '⌚',
  Parfum: '🌸',
  Maroquinerie: '👜',
  Service: '📺',
};

export interface OutfitItem {
  id: string;
  /** ID du produit Firestore lié (facultatif) */
  productId?: string;
  /** Slug du produit — pour le lien /produit/[slug] */
  productSlug?: string;
  /** Nom affiché dans l'outfit */
  name: string;
  /** Prix en USD */
  priceUSD: number;
  /** Catégorie libre : Mode / Chaussures / Bijou / Tech … */
  category: string;
  /** Emoji fallback pour affichage */
  emoji?: string;
  /** URL image (depuis Firestore si lié, sinon vide) */
  imageUrl?: string;
}

export interface OutfitDot {
  /** Position horizontale en % sur l'image */
  x: number;
  /** Position verticale en % sur l'image */
  y: number;
  /** Index de l'item référencé (0-based dans items[]) */
  itemIndex: number;
}

export interface Outfit {
  id: string;
  name: string;
  season: string;
  cat: OutfitCategory;
  badge?: string;
  badgeType?: OutfitBadgeType;
  /** 'published' = visible côté client ; 'draft' = admin uniquement */
  status: 'published' | 'draft';
  /** URLs Firebase Storage des photos (ordre = galerie) */
  photos: string[];
  items: OutfitItem[];
  dots: OutfitDot[];
  createdAt: string;
  updatedAt: string;
}
