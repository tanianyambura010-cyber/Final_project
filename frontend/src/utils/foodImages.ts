export const HOME_HERO_IMAGE =
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80';

const DEFAULT_FOOD_IMAGE =
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=900&q=80';

const CATEGORY_IMAGE_MATCHES = [
  {
    match: 'breakfast',
    url: 'https://images.unsplash.com/photo-1493770348161-369560ae357d?auto=format&fit=crop&w=900&q=80',
  },
  {
    match: 'coffee',
    url: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80',
  },
  {
    match: 'drink',
    url: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=900&q=80',
  },
  {
    match: 'snack',
    url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=900&q=80',
  },
  {
    match: 'meal',
    url: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=900&q=80',
  },
];

export function foodImageFor(category: string, imageUrl?: string | null) {
  if (imageUrl) {
    return imageUrl;
  }

  const normalizedCategory = category.toLowerCase();
  return (
    CATEGORY_IMAGE_MATCHES.find((candidate) => normalizedCategory.includes(candidate.match))?.url ??
    DEFAULT_FOOD_IMAGE
  );
}
