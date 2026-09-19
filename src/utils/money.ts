const formatter = (decimals: number) =>
  new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

export type MoneyOption = {
  decimals?: boolean;
};

export function formatMoney(cents: number, option: MoneyOption = {}): string {
  const sign = cents < 0 ? '-' : '';
  const decimals = option.decimals === false ? 0 : 2;
  const formatted = formatter(decimals).format(Math.abs(cents) / 100);
  return `${sign}RD$${formatted}`;
}

export type LineItem = {
  unitPriceCents: number;
  quantity: number;
};

export function calcSubtotal(items: LineItem[]): number {
  return items.reduce((total, item) => total + item.unitPriceCents * item.quantity, 0);
}

export function calcChange(totalCents: number, receivedCents: number): number {
  return receivedCents - totalCents;
}

export function calcDifference(expectedCents: number, countedCents: number): number {
  return expectedCents - countedCents;
}

const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;

export function parseMoney(text: string): number | null {
  let normalized = text.trim().toUpperCase().replace(/\s+/g, '').replace('RD$', '');
  if (normalized.includes(',') && normalized.includes('.')) {
    normalized = normalized.replace(/,/g, '');
  } else if (normalized.includes(',') && /,\d{3}$/.test(normalized)) {
    normalized = normalized.replace(/,/g, '');
  } else {
    normalized = normalized.replace(',', '.');
  }
  if (!AMOUNT_PATTERN.test(normalized)) return null;

  const [intPart, decPart = ''] = normalized.split('.');
  return parseInt(intPart, 10) * 100 + parseInt(decPart.padEnd(2, '0'), 10);
}

export function formatMoneyBlur(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  const cents = parseMoney(trimmed);
  if (cents === null) return trimmed;
  return formatMoney(cents);
}

export function unformatMoneyFocus(text: string): string {
  if (!text.includes('RD$')) return text;
  return text.replace(/RD\$/g, '').replace(/,/g, '').replace(/\s+/g, '');
}