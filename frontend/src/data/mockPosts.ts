import { Post } from '../types/post';

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

export const MOCK_POSTS: Post[] = [
  {
    id: 'post-1',
    title: 'Minimalist brutalist pavilion in concrete & glass',
    imageUrl:
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80',
    blurhash: 'L9H20@M{00IU~qfQofWB00of_3WB',
    aspectRatio: 0.75, // 3:4 portrait
    category: 'Architecture',
    creator: {
      id: 'cr-1',
      name: 'Studio Archi',
      username: 'studioarchi',
      avatarUrl:
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
      isVerified: true,
    },
    likesCount: 1420,
    savesCount: 384,
    isSaved: false,
    tags: ['concrete', 'brutalism', 'geometry'],
    media: [
      {
        url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80',
        type: 'image',
      },
      {
        url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80',
        type: 'image',
      },
      {
        url: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=800&q=80',
        type: 'image',
      },
    ],
    sourceTags: [
      {
        id: 'st-1',
        title: 'Minimalist Teak Wood Lounge Chair',
        brand: 'Muuto Studio',
        priceInRupees: 28999,
        originalPriceInRupees: 34999,
        category: 'Furniture',
        imageUrl: 'https://images.unsplash.com/photo-1580481077195-c3a8a30f72c0?auto=format&fit=crop&w=400&q=80',
        buyUrl: 'https://muuto.com',
        inStock: true,
        rating: 4.9,
        reviewsCount: 142,
        x: 48,
        y: 62,
      },
      {
        id: 'st-2',
        title: 'Architectural Matte Black Pendant Lamp',
        brand: 'Flos Lighting',
        priceInRupees: 14500,
        originalPriceInRupees: 17999,
        category: 'Lighting',
        imageUrl: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=400&q=80',
        buyUrl: 'https://flos.com',
        inStock: true,
        rating: 4.8,
        reviewsCount: 88,
        x: 68,
        y: 28,
      },
      {
        id: 'st-3',
        title: 'Hand-Cast Microcement Planter',
        brand: 'Kolkata Clay & Stone',
        priceInRupees: 3499,
        originalPriceInRupees: 4200,
        category: 'Decor',
        imageUrl: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?auto=format&fit=crop&w=400&q=80',
        buyUrl: 'https://clayandstone.in',
        inStock: true,
        rating: 4.7,
        reviewsCount: 65,
        x: 22,
        y: 78,
      },
    ],
  },
  {
    id: 'post-2',
    title: 'Nordic ceramics & morning light',
    imageUrl:
      'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=800&q=80',
    blurhash: 'L7H2f?%M?bfR00IU00IU~qfR~qIU',
    aspectRatio: 1.0, // 1:1 square
    category: 'Design',
    creator: {
      id: 'cr-2',
      name: 'Elena Lindqvist',
      username: 'lindqvist_e',
      avatarUrl:
        'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80',
      isVerified: false,
    },
    likesCount: 890,
    savesCount: 215,
    isSaved: true,
    tags: ['ceramics', 'scandi', 'pottery'],
    media: [
      {
        url: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=800&q=80',
        type: 'image',
      },
      {
        url: 'https://images.unsplash.com/photo-1612196808214-b8e1d6145a8c?auto=format&fit=crop&w=800&q=80',
        type: 'image',
      },
    ],
    sourceTags: [
      {
        id: 'st-4',
        title: 'Handmade Stoneware Ceramic Vase',
        brand: 'Nordic Clayworks',
        priceInRupees: 4999,
        originalPriceInRupees: 5999,
        category: 'Ceramics',
        imageUrl: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=400&q=80',
        buyUrl: 'https://nordicclay.se',
        inStock: true,
        rating: 5.0,
        reviewsCount: 39,
        x: 45,
        y: 52,
      },
    ],
  },
  {
    id: 'post-3',
    title: 'Monolithic stairs cut through volcanic stone',
    imageUrl:
      'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80',
    blurhash: 'LDF6*r_4.8IU?b?bofWB00M{~qof',
    aspectRatio: 0.65, // tall portrait
    category: 'Architecture',
    creator: {
      id: 'cr-3',
      name: 'Kengo Kuro',
      username: 'kuro_space',
      avatarUrl:
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
      isVerified: true,
    },
    likesCount: 3200,
    savesCount: 910,
    isSaved: false,
    tags: ['monolith', 'interior', 'minimalism'],
    media: [
      {
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        type: 'video',
        posterUrl: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80',
      },
      {
        url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80',
        type: 'image',
      },
    ],
    sourceTags: [
      {
        id: 'st-5',
        title: 'Cast Basalt Architectural Sconces',
        brand: 'Viabizzuno',
        priceInRupees: 18900,
        originalPriceInRupees: 22000,
        category: 'Lighting',
        imageUrl: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=400&q=80',
        buyUrl: 'https://viabizzuno.com',
        inStock: true,
        rating: 4.9,
        reviewsCount: 42,
        x: 35,
        y: 40,
      },
    ],
  },
  {
    id: 'post-4',
    title: 'Warm timber tones & quiet reading nook',
    imageUrl:
      'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=800&q=80',
    blurhash: 'LEM7d+WBRjWB~qfQofof00of_3WB',
    aspectRatio: 0.8, // 4:5
    category: 'Interior',
    creator: {
      id: 'cr-4',
      name: 'Matteo Rossi',
      username: 'rossidesign',
      avatarUrl:
        'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
      isVerified: false,
    },
    likesCount: 654,
    savesCount: 142,
    isSaved: false,
    tags: ['furniture', 'woodcraft', 'reading'],
  },
  {
    id: 'post-5',
    title: 'Raw linen textiles in earthy palette',
    imageUrl:
      'https://images.unsplash.com/photo-1616046229478-9901c5536a45?auto=format&fit=crop&w=800&q=80',
    blurhash: 'L6H2;@IU?bWB~qfQofWB00of_3WB',
    aspectRatio: 0.72,
    category: 'Interior',
    creator: {
      id: 'cr-5',
      name: 'Hanna V.',
      username: 'hannatextiles',
      avatarUrl:
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
      isVerified: true,
    },
    likesCount: 1105,
    savesCount: 420,
    isSaved: false,
    tags: ['linen', 'organic', 'home'],
  },
  {
    id: 'post-6',
    title: 'Sculptural bronze chair study No. 04',
    imageUrl:
      'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=800&q=80',
    blurhash: 'L9H20@M{00IU~qfQofWB00of_3WB',
    aspectRatio: 0.85,
    category: 'Design',
    creator: {
      id: 'cr-6',
      name: 'Form & Void',
      username: 'formvoid',
      avatarUrl:
        'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=200&q=80',
      isVerified: true,
    },
    likesCount: 2310,
    savesCount: 615,
    isSaved: true,
    tags: ['chair', 'bronze', 'sculpture'],
  },
  {
    id: 'post-7',
    title: 'Geometric shadows across sandstone patio',
    imageUrl:
      'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=800&q=80',
    blurhash: 'L8H2?bIU00WB~qofofWB00of_3WB',
    aspectRatio: 0.68,
    category: 'Photography',
    creator: {
      id: 'cr-7',
      name: 'Oliver Thorne',
      username: 'oliverthorne',
      avatarUrl:
        'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=200&q=80',
      isVerified: false,
    },
    likesCount: 978,
    savesCount: 289,
    isSaved: false,
    tags: ['shadow', 'patio', 'geometry'],
  },
  {
    id: 'post-8',
    title: 'Curved plaster walls & recessed skylight',
    imageUrl:
      'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=800&q=80',
    blurhash: 'L6H2;@IU?bWB~qfQofWB00of_3WB',
    aspectRatio: 0.78,
    category: 'Architecture',
    creator: {
      id: 'cr-8',
      name: 'Nadia Sol',
      username: 'sol_spaces',
      avatarUrl:
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
      isVerified: true,
    },
    likesCount: 1840,
    savesCount: 520,
    isSaved: false,
    tags: ['plaster', 'curves', 'skylight'],
  },
  {
    id: 'post-9',
    title: 'Japanese tea room in hinoki cedar',
    imageUrl:
      'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=800&q=80',
    blurhash: 'L8H2?bIU00WB~qofofWB00of_3WB',
    aspectRatio: 1.05,
    category: 'Minimal',
    creator: {
      id: 'cr-9',
      name: 'Kenzo Tan',
      username: 'kenzotan',
      avatarUrl:
        'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&q=80',
      isVerified: true,
    },
    likesCount: 2950,
    savesCount: 812,
    isSaved: false,
    tags: ['hinoki', 'tea', 'japan'],
  },
  {
    id: 'post-10',
    title: 'Abstract marble slab with emerald veins',
    imageUrl:
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=800&q=80',
    blurhash: 'L7H2f?%M?bfR00IU00IU~qfR~qIU',
    aspectRatio: 0.7,
    category: 'Art',
    creator: {
      id: 'cr-10',
      name: 'Chloe Monet',
      username: 'chloemonet',
      avatarUrl:
        'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80',
      isVerified: false,
    },
    likesCount: 1540,
    savesCount: 395,
    isSaved: false,
    tags: ['marble', 'texture', 'emerald'],
  },
  {
    id: 'post-11',
    title: 'Mid-century lounge with terracotta fireplace',
    imageUrl:
      'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=800&q=80',
    blurhash: 'L9H20@M{00IU~qfQofWB00of_3WB',
    aspectRatio: 0.76,
    category: 'Interior',
    creator: {
      id: 'cr-11',
      name: 'Lucas Meyer',
      username: 'meyerspaces',
      avatarUrl:
        'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=200&q=80',
      isVerified: false,
    },
    likesCount: 880,
    savesCount: 245,
    isSaved: false,
    tags: ['terracotta', 'midcentury', 'warm'],
  },
  {
    id: 'post-12',
    title: 'Coastline pavilion hovering above the cliffs',
    imageUrl:
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80',
    blurhash: 'LDF6*r_4.8IU?b?bofWB00M{~qof',
    aspectRatio: 0.67,
    category: 'Architecture',
    creator: {
      id: 'cr-12',
      name: 'Studio Archi',
      username: 'studioarchi',
      avatarUrl:
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
      isVerified: true,
    },
    likesCount: 4120,
    savesCount: 1320,
    isSaved: true,
    tags: ['cliff', 'ocean', 'horizon'],
  },
  {
    id: 'post-13',
    title: 'Cantilevered glass villa surrounded by stone pines',
    imageUrl:
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80',
    blurhash: 'L9H20@M{00IU~qfQofWB00of_3WB',
    aspectRatio: 0.74,
    category: 'Architecture',
    creator: {
      id: 'cr-kuro',
      name: 'Kuro Studio',
      username: 'kuro_space',
      avatarUrl:
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
      isVerified: true,
    },
    likesCount: 3840,
    savesCount: 940,
    isSaved: false,
    tags: ['cantilever', 'glass', 'stonepines'],
  },
  {
    id: 'post-14',
    title: 'Indoor reflecting pool with fluted limestone columns',
    imageUrl:
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80',
    blurhash: 'LDF6*r_4.8IU?b?bofWB00M{~qof',
    aspectRatio: 0.82,
    category: 'Interior',
    creator: {
      id: 'cr-elena',
      name: 'Elena Rostova',
      username: 'elena_design',
      avatarUrl:
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
      isVerified: true,
    },
    likesCount: 2470,
    savesCount: 615,
    isSaved: true,
    tags: ['pool', 'limestone', 'reflecting'],
  },
  {
    id: 'post-15',
    title: 'Minimalist kitchen island in honed quartzite & dark walnut',
    imageUrl:
      'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&q=80',
    blurhash: 'L8H2?bIU00WB~qofofWB00of_3WB',
    aspectRatio: 0.95,
    category: 'Design',
    creator: {
      id: 'cr-botanica',
      name: 'Botanica Lab',
      username: 'botanica_living',
      avatarUrl:
        'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80',
      isVerified: true,
    },
    likesCount: 1980,
    savesCount: 480,
    isSaved: false,
    tags: ['quartzite', 'walnut', 'minimalist'],
  },
];

