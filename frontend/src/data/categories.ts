export const CATEGORIES = [
  'All',
  'Architecture',
  'Interior',
  'Minimal',
  'Design',
  'Editorial',
  'Art',
  'Travel',
] as const;

export type Category = (typeof CATEGORIES)[number];

