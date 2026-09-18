export const typography = {
  sizes: {
    caption: 12,
    body: 14,
    label: 16,
    title: 18,
    h2: 22,
    h1: 28,
    display: 34,
  },
  weights: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  },
} as const;

export type Typography = typeof typography;