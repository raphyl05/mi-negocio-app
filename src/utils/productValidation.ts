import { parseMoney } from './money';

export type ProductFormInput = {
  name: string;
  priceText: string;
  category: string;
  trackStock: boolean;
  stockText: string;
};

export type ProductFormErrors = {
  name?: string;
  price?: string;
  category?: string;
  stock?: string;
};

export function validateProduct(input: ProductFormInput): ProductFormErrors {
  const errors: ProductFormErrors = {};

  if (!input.name.trim()) {
    errors.name = 'El nombre es obligatorio';
  }

  const priceCents = parseMoney(input.priceText);
  if (priceCents === null || priceCents <= 0) {
    errors.price = 'Ingresa un precio válido mayor a 0';
  }

  if (!input.category.trim()) {
    errors.category = 'La categoría es obligatoria';
  }

  if (input.trackStock) {
    const cleaned = input.stockText.trim();
    if (cleaned === '' || !/^\d+$/.test(cleaned)) {
      errors.stock = 'La cantidad debe ser un número entero mayor o igual a 0';
    }
  }

  return errors;
}