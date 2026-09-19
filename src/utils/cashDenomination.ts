export const BILL_DENOMINATIONS = [2000, 1000, 500, 200, 100];
export const COIN_DENOMINATIONS = [50, 25, 10, 5, 1];
export const ALL_DENOMINATIONS = [...BILL_DENOMINATIONS, ...COIN_DENOMINATIONS];

export type DenominationCounts = Record<string, string>;

export function countTotalCents(counts: DenominationCounts): number {
  let total = 0;
  for (const denomination of ALL_DENOMINATIONS) {
    const quantity = parseInt(counts[String(denomination)] ?? '', 10);
    if (Number.isInteger(quantity) && quantity > 0) {
      total += quantity * denomination * 100;
    }
  }
  return total;
}

export function hasAnyCount(counts: DenominationCounts): boolean {
  return ALL_DENOMINATIONS.some((denomination) => {
    const quantity = parseInt(counts[String(denomination)] ?? '', 10);
    return Number.isInteger(quantity) && quantity > 0;
  });
}

export function sanitizeDenominationInput(text: string): string {
  return text.replace(/\D/g, '').slice(0, 6);
}