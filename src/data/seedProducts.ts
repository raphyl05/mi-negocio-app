import type { Product } from '../models/product';

export const SEED_PRODUCTS: Product[] = [
  buildSeed('hamburguesa', 'Hamburguesa', 25000, 'Comidas', '🍔', true, 50),
  buildSeed('hotdog', 'Hot dog', 12000, 'Comidas', '🌭', false, 0),
  buildSeed('pollo-frito', 'Pollo frito', 15000, 'Comidas', '🍗', false, 0),
  buildSeed('sandwich', 'Sándwich', 18000, 'Comidas', '🥪', true, 20),
  buildSeed('arroz-habichuelas', 'Arroz con habichuelas', 18000, 'Comidas', '🍚', false, 0),
  buildSeed('papas-fritas', 'Papas fritas', 10000, 'Comidas', '🍟', false, 0),
  buildSeed('refresco', 'Refresco', 10000, 'Bebidas', '🥤', true, 100),
  buildSeed('jugo-natural', 'Jugo natural', 12000, 'Bebidas', '🧃', false, 0),
  buildSeed('batido', 'Batido', 14000, 'Bebidas', '🥛', false, 0),
  buildSeed('cafe', 'Café', 6000, 'Bebidas', '🍵', false, 0),
  buildSeed('flan', 'Flan', 8000, 'Postres', '🍮', false, 0),
  buildSeed('helado', 'Helado', 10000, 'Postres', '🍨', true, 30),
];

function buildSeed(
  id: string,
  name: string,
  priceCents: number,
  category: string,
  emoji: string,
  trackStock: boolean,
  stockQuantity: number,
): Product {
  return {
    id,
    name,
    priceCents,
    category,
    imageType: 'emoji',
    emoji,
    trackStock,
    stockQuantity,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}