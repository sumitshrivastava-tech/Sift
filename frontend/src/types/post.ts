export interface Creator {
  id: string;
  name: string;
  username: string;
  avatarUrl: string;
  isVerified?: boolean;
}

export interface SourceTag {
  id: string;
  title: string;
  brand?: string;
  priceInRupees: number;
  originalPriceInRupees?: number;
  category?: string;
  imageUrl?: string;
  buyUrl?: string;
  inStock?: boolean;
  rating?: number;
  reviewsCount?: number;
  // Position coordinates normalized as percentage (0 to 100) within the image
  x: number;
  y: number;
}

export interface MediaItem {
  url: string;
  type?: 'image' | 'video';
  posterUrl?: string;
  aspectRatio?: number;
}

export interface Post {
  id: string;
  title: string;
  imageUrl: string;
  blurhash?: string;
  aspectRatio: number; // width / height, e.g. 0.75 for tall 3:4, 0.8 for 4:5, 1.0 for square, 0.65 for portrait
  creator: Creator;
  likesCount?: number;
  savesCount?: number;
  isSaved?: boolean;
  category?: string;
  tags?: string[];
  content?: string;
  // Enhanced media & shopping tags
  media?: (string | MediaItem)[];
  sourceTags?: SourceTag[];
  // Visual search matching metadata
  isVisualMatch?: boolean;
  similarityScore?: number;
  matchReason?: string;
}
