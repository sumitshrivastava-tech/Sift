# Sift Frontend (React Native + Expo)

A high-performance Pinterest/Dribbble-style masonry grid mobile interface built with **Expo SDK 58**, **TypeScript**, **NativeWind (Tailwind CSS)**, and **@shopify/flash-list**.

---

## 🚀 Key Features & Highlights

- **Dual-Column Masonry Grid**: Implemented using `@shopify/flash-list` with `masonry={true}`, `numColumns={2}`, and `optimizeItemArrangement={true}` to balance column heights dynamically.
- **60FPS Scroll Performance Architecture**:
  - **Deterministic Geometry**: Image heights are pre-calculated using the card width and intrinsic aspect ratios (`cardWidth / post.aspectRatio`), eliminating layout recalculations and scroll jumps.
  - **Hardware Accelerated Image Pipeline**: Leverages `expo-image` with `memory-disk` cache policy, fast native decoding (Glide on Android / SDWebImage on iOS), and blurhash placeholders for flicker-free rendering.
  - **Component Isolation**: `PostCard` is memoized via `React.memo` with a custom equality function preventing re-renders of off-screen or unaffected items.
  - **Stable List References**: Callbacks (`renderItem`, `keyExtractor`, `getItemType`) are memoized via `useCallback`.
- **Pure White Aesthetic**: Full `#FFFFFF` background throughout the entire app shell, safe areas, headers, cards, and list container with dark content status bar.
- **Micro-Interactions & Haptics**:
  - 'Save' icon with tactile feedback using `expo-haptics` and spring micro-bounce animation.
  - Minimalist floating notification toast on save/unsave actions.
  - Pull-to-refresh with dark contrast spinner.
  - Category pill filter with interactive active/inactive states.

---

## 📁 Project Structure

```
frontend/
├── App.tsx                     # App entry point with SafeAreaProvider & dark StatusBar
├── global.css                  # Tailwind directives
├── tailwind.config.js          # NativeWind configuration
├── metro.config.js             # Metro bundler config with withNativeWind
├── babel.config.js             # Babel preset for Expo & NativeWind
├── src/
│   ├── types/
│   │   └── post.ts             # TypeScript interfaces for Post, Creator, etc.
│   ├── data/
│   │   └── mockPosts.ts        # Curated mock dataset with diverse aspect ratios & blurhashes
│   ├── components/
│   │   ├── PostCard.tsx        # Masonry card: rounded image, overlapping bold title, creator & save row
│   │   ├── Header.tsx          # Minimalist brand header ("sift.") with search & actions
│   │   ├── CategoryFilter.tsx  # Horizontal category filter pills
│   │   └── Toast.tsx           # Subtle floating feedback toast
│   └── screens/
│       └── HomeScreen.tsx      # Dual-column Masonry FlashList feed screen
```

---

## 🛠️ Quick Start

Inside the `/frontend` directory:

```bash
# Start Metro bundler / Expo dev server
npm start

# Run on iOS simulator (macOS required)
npm run ios

# Run on Android emulator / device
npm run android

# Run on Web
npm run web
```

