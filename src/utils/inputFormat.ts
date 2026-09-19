export function formatPhoneBlur(text: string): string {
  const digits = text.replace(/\D/g, '');
  const trimmed = text.trim();
  if (digits.length < 10) return trimmed;
  return digits.slice(0, 3) + '-' + digits.slice(3, 6) + '-' + digits.slice(6, 10);
}

export function unformatPhoneFocus(text: string): string {
  const digits = text.replace(/\D/g, '');
  if (digits.length !== 10) return text;
  return digits;
}