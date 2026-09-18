export type ProductImageType = 'emoji' | 'icon' | 'photo';

export type Product = {
  id: string;
  name: string;
  priceCents: number;
  category: string;
  imageType: ProductImageType;
  emoji?: string;
  icon?: string;
  imageUri?: string;
  trackStock: boolean;
  stockQuantity: number;
  active: boolean;
  createdAt: string;
};