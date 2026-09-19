import type { Product } from '../models/product';

export const SEED_PRODUCTS: Product[] = [
  buildSeed('hamburguesa', 'Hamburguesa', 25000, 'Comidas', '🍔', 50),
  buildSeed('hotdog', 'Hot dog', 12000, 'Comidas', '🌭', 40),
  buildSeed('pollo-frito', 'Pollo frito', 15000, 'Comidas', '🍗', 30),
  buildSeed('sandwich', 'Sándwich', 18000, 'Comidas', '🥪', 20),
  buildSeed('arroz-habichuelas', 'Arroz con habichuelas', 18000, 'Comidas', '🍚', 45),
  buildSeed('papas-fritas', 'Papas fritas', 10000, 'Comidas', '🍟', 60),
  buildSeed('refresco', 'Refresco', 10000, 'Bebidas', '🥤', 100),
  buildSeed('jugo-natural', 'Jugo natural', 12000, 'Bebidas', '🧃', 40),
  buildSeed('batido', 'Batido', 14000, 'Bebidas', '🥛', 30),
  buildSeed('cafe', 'Café', 6000, 'Bebidas', '🍵', 80),
  buildSeed('flan', 'Flan', 8000, 'Postres', '🍮', 25),
  buildSeed('helado', 'Helado', 10000, 'Postres', '🍨', 35),
];

function buildSeed(
  id: string,
  name: string,
  priceCents: number,
  category: string,
  emoji: string,
  stockQuantity: number,
): Product {
  return {
    id,
    name,
    priceCents,
    category,
    imageType: 'emoji',
    emoji,
    stockQuantity,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}