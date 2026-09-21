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
  stockQuantity: number;
  active: boolean;
  provider?: string;
  providerPhone?: string;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string;
};