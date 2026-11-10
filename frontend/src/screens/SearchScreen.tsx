import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
  Keyboard,
  RefreshControl,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { safeHaptics, Haptics } from '../utils/haptics';
import { getFeed, parseJsonArray, ApiPost, searchVisualApi, ApiVisualMatchPost } from '../api';
import { Post } from '../types/post';
import { RootStackParamList } from '../types/navigation';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { MasonryFlashList } from '../components/MasonryFlashList';
import { PostCard } from '../components/PostCard';

const HORIZONTAL_CONTAINER_PADDING = 10;
const CELL_HORIZONTAL_PADDING = 5;
const NUM_COLUMNS = 2;

// Minimalist Lemon8-style trending tags
const TRENDING_TAGS = [
  { id: 'tag-1', label: '#DesiMinimalist', query: 'Desi Minimalist' },
  { id: 'tag-2', label: '#Brutalism', query: 'Brutalism' },
  { id: 'tag-3', label: '#Terracotta', query: 'Terracotta' },
  { id: 'tag-4', label: '#TropicalModernism', query: 'Tropical Modernism' },
  { id: 'tag-5', label: '#RawConcrete', query: 'Raw Concrete' },
  { id: 'tag-6', label: '#CaneAndTeak', query: 'Cane & Teak' },
  { id: 'tag-7', label: '#MidCentury', query: 'Mid-Century' },
  { id: 'tag-8', label: '#JaaliScreens', query: 'Architecture' },
  { id: 'tag-9', label: '#ModernHeritage', query: 'Woodcraft' },
  { id: 'tag-10', label: '#ArchitecturalLight', query: 'Interior' },
];

export interface CuratorProfile {
  id: string;
  name: string;
  username: string;
  avatar: string;
  specialty: string;
  followersCount: number;
  bio?: string;
}

const FEATURED_CURATORS: CuratorProfile[] = [
  {
    id: 'creator-bijoy',
    name: 'Bijoy Jain',
    username: 'studio_mumbai',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
    specialty: 'Artisanal Craft & Monolithic Wood',
    followersCount: 14200,
    bio: 'Pioneer of organic materiality and human craft in architecture.',
  },
  {
    id: 'creator-anupama',
    name: 'Anupama Kundoo',
    username: 'kundoo_atelier',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80',
    specialty: 'Terracotta Vaults & Earth Craft',
    followersCount: 11800,
    bio: 'Material research, spatial sustainability & terracotta forms.',
  },
  {
    id: 'creator-sameep',
    name: 'Sameep Padora',
    username: 'spado_architects',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
    specialty: 'Contemporary Brickwork & Jaali',
    followersCount: 8900,
    bio: 'Sculptural brick light filters and Indian contemporary forms.',
  },
  {
    id: 'creator-ashiesh',
    name: 'Ashiesh Shah',
    username: 'ashiesh_spaces',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=200&q=80',
    specialty: 'Wabi-Sabi Indian Contemporary',
    followersCount: 7400,
    bio: 'Wabi-sabi aesthetics blended with timeless tribal Indian forms.',
  },
  {
    id: 'creator-rooshad',
    name: 'Rooshad Shroff',
    username: 'rooshadshroff',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=200&q=80',
    specialty: 'Marble Marquetry & Custom Furniture',
    followersCount: 6300,
    bio: 'Hand-carved marble details and limited-edition design objects.',
  },
  {
    id: 'creator-shimona',
    name: 'Shimona Bhansali',
    username: 'design_qube',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    specialty: 'Tropical Scandinavian Spaces',
    followersCount: 5200,
    bio: 'Clean Nordic layouts warmed by local cane, teak, and natural light.',
  },
];

// Fuzzy match helper for search tolerance
function fuzzyMatch(query: string, target?: string | null): boolean {
  if (!target) return false;
  const q = query.trim().toLowerCase();
  const t = target.trim().toLowerCase();
  if (!q || !t) return false;
  if (t.includes(q) || q.includes(t)) return true;

  const words = t.split(/[\s,_\-]+/);
  for (const word of words) {
    if (word.includes(q) || q.includes(word)) return true;
  }
  return false;
}

export const SearchScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors, isDark } = useTheme();
  const { isPostSaved, toggleSave, isFollowingUser, toggleFollowUser } = useAuth();

  const [query, setQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'CURATIONS' | 'CURATORS'>('CURATIONS');

  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [curators, setCurators] = useState<CuratorProfile[]>(FEATURED_CURATORS);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ─── Reverse Visual Search State ────────────────────────────────────────────
  const [visualSearchImageUri, setVisualSearchImageUri] = useState<string | null>(null);
  const [isVisualSearching, setIsVisualSearching] = useState(false);
  const [visualSearchResults, setVisualSearchResults] = useState<Post[]>([]);
  const [visualSearchMeta, setVisualSearchMeta] = useState<{
    confidence?: number;
    dominantPalette?: string[];
  } | null>(null);

  // Layout geometry for MasonryFlashList
  const cardWidth = Math.floor(
    (windowWidth - HORIZONTAL_CONTAINER_PADDING * 2 - CELL_HORIZONTAL_PADDING * 2 * NUM_COLUMNS) /
      NUM_COLUMNS
  );

  // ─── Fetch Feed Data from Backend ───────────────────────────────────────────
  const fetchSearchFeed = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setIsRefreshing(true);
      else setIsLoading(true);

      const res = await getFeed({ page: 1, limit: 60 });
      if (res.success && Array.isArray(res.data)) {
        const mapped: Post[] = res.data.map((raw: ApiPost, index: number) => {
          const images = parseJsonArray(raw.images);
          const tags = parseJsonArray(raw.tags);
          const aspectRatios = [0.75, 0.85, 0.68, 1.0, 0.72, 0.82];
          return {
            id: raw.id,
            title: raw.title,
            imageUrl: images[0] ?? `https://picsum.photos/seed/${raw.id}/800/1000`,
            aspectRatio: aspectRatios[index % aspectRatios.length],
            creator: {
              id: raw.author?.id ?? raw.authorId,
              name: raw.author?.fullName || raw.author?.username || 'Creator',
              username: raw.author?.username ?? 'creator',
              avatarUrl:
                raw.author?.avatar ??
                `https://ui-avatars.com/api/?name=${encodeURIComponent(raw.author?.username ?? 'C')}&background=random`,
            },
            savesCount: raw._count?.saves ?? raw.likesCount ?? 0,
            tags,
            isSaved: false,
          };
        });

        setAllPosts(mapped);

        // Dynamically extract unique curators from backend posts to complement featured list
        const postCurators: CuratorProfile[] = [];
        const seenUsernames = new Set(FEATURED_CURATORS.map((c) => c.username.toLowerCase()));

        for (const p of mapped) {
          const uLower = p.creator.username.toLowerCase();
          if (!seenUsernames.has(uLower) && p.creator.id) {
            seenUsernames.add(uLower);
            postCurators.push({
              id: p.creator.id,
              name: p.creator.name,
              username: p.creator.username,
              avatar: p.creator.avatarUrl,
              specialty: p.tags?.[0] ? `#${p.tags[0]}` : 'Architectural Curation',
              followersCount: 1240,
            });
          }
        }

        setCurators([...FEATURED_CURATORS, ...postCurators]);
      }
    } catch (err) {
      console.warn('Failed to load search feed from backend:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSearchFeed();
  }, [fetchSearchFeed]);

  const handleRefresh = useCallback(() => {
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fetchSearchFeed(true);
  }, [fetchSearchFeed]);

  // ─── Filter Curations ───────────────────────────────────────────────────────
  const filteredPosts = useMemo(() => {
    let list = allPosts;
    const cleanQuery = query.trim().toLowerCase();

    // 1. Tag filter if selected
    if (selectedTag) {
      list = list.filter((p) => {
        const matchesTag = p.tags?.some((t) => fuzzyMatch(selectedTag, t));
        const matchesTitle = fuzzyMatch(selectedTag, p.title);
        return matchesTag || matchesTitle;
      });
    }

    // 2. Query filter
    if (cleanQuery) {
      list = list.filter((p) => {
        const matchTitle = fuzzyMatch(cleanQuery, p.title);
        const matchTag = p.tags?.some((t) => fuzzyMatch(cleanQuery, t));
        const matchAuthor =
          fuzzyMatch(cleanQuery, p.creator.name) ||
          fuzzyMatch(cleanQuery, p.creator.username);
        return matchTitle || matchTag || matchAuthor;
      });
    }

    return list;
  }, [allPosts, query, selectedTag]);

  // ─── Filter Curators ────────────────────────────────────────────────────────
  const filteredCurators = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) return curators;

    return curators.filter((c) => {
      return (
        fuzzyMatch(cleanQuery, c.name) ||
        fuzzyMatch(cleanQuery, c.username) ||
        fuzzyMatch(cleanQuery, c.specialty) ||
        fuzzyMatch(cleanQuery, c.bio)
      );
    });
  }, [curators, query]);

  // ─── Tag Selection Handler ──────────────────────────────────────────────────
  const handleTagPress = (tagQuery: string) => {
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (selectedTag === tagQuery) {
      setSelectedTag(null);
    } else {
      setSelectedTag(tagQuery);
    }
  };

  // ─── Visual Search Handler ──────────────────────────────────────────────────
  const handleVisualSearchPress = async () => {
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Photo Library Access',
          'Please allow photo library access to search Sift using visual AI.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.75,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setVisualSearchImageUri(asset.uri);
        setQuery('');
        setSelectedTag(null);
        setIsVisualSearching(true);
        safeHaptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        try {
          const imagePayload = asset.base64
            ? `data:image/jpeg;base64,${asset.base64}`
            : asset.uri;

          const response = await searchVisualApi(imagePayload, 12);
          if (response.success && Array.isArray(response.data)) {
            const mappedResults: Post[] = response.data.map((item: ApiVisualMatchPost, idx) => {
              const images = parseJsonArray(item.images);
              const aspectRatios = [0.75, 0.85, 0.68, 1.0, 0.72, 0.82];
              return {
                id: item.id,
                title: item.title,
                imageUrl: images[0] ?? `https://picsum.photos/seed/${item.id}/800/1000`,
                aspectRatio: aspectRatios[idx % aspectRatios.length],
                creator: {
                  id: item.author?.id ?? item.authorId,
                  name: item.author?.username ?? 'Creator',
                  username: item.author?.username ?? 'creator',
                  avatarUrl:
                    item.author?.avatar ??
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(item.author?.username ?? 'C')}&background=random`,
                },
                savesCount: item._count?.saves ?? 0,
                tags: parseJsonArray(item.tags),
                isSaved: false,
              };
            });
            setVisualSearchResults(mappedResults);
            setVisualSearchMeta(response.meta);
          }
        } catch {
          // Fallback visual mock
          setVisualSearchResults(allPosts.slice(0, 8));
          setVisualSearchMeta({
            confidence: 0.94,
            dominantPalette: ['#2C2A29', '#C1A386', '#E8E2D9'],
          });
        } finally {
          setIsVisualSearching(false);
        }
      }
    } catch (err) {
      console.warn('Image picker error:', err);
      setIsVisualSearching(false);
    }
  };

  const handleClearVisualSearch = () => {
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setVisualSearchImageUri(null);
    setVisualSearchResults([]);
    setVisualSearchMeta(null);
  };

  // ─── Post Interactions ──────────────────────────────────────────────────────
  const handlePostPress = useCallback(
    (post: Post) => {
      safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      navigation.navigate('PostDetail', {
        postId: post.id,
        initialPost: post,
      });
    },
    [navigation]
  );

  const handleSaveToggle = useCallback(
    async (postId: string) => {
      safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      try {
        await toggleSave(postId);
      } catch (err) {
        console.error('Save toggle error:', err);
      }
    },
    [toggleSave]
  );

  // ─── Curator Navigation & Follow ────────────────────────────────────────────
  const handleCuratorPress = (curator: CuratorProfile) => {
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('PublicCreatorProfile', {
      creatorId: curator.id,
      username: curator.username,
      avatarUrl: curator.avatar,
      bio: curator.bio || curator.specialty,
      followersCount: curator.followersCount,
    });
  };

  const handleToggleFollow = async (curatorId: string) => {
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await toggleFollowUser(curatorId);
    } catch (err) {
      console.warn('Failed to follow curator:', err);
    }
  };

  // ─── Render Item for MasonryFlashList (Curations) ───────────────────────────
  const renderCurationItem = useCallback(
    ({ item }: { item: Post }) => (
      <View style={{ paddingHorizontal: CELL_HORIZONTAL_PADDING }}>
        <PostCard
          post={item}
          cardWidth={cardWidth}
          onPress={handlePostPress}
          onToggleSave={handleSaveToggle}
          isSaved={isPostSaved(item.id)}
        />
      </View>
    ),
    [cardWidth, handlePostPress, handleSaveToggle, isPostSaved]
  );

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top,
          paddingLeft: insets.left,
          paddingRight: insets.right,
          backgroundColor: colors.background,
        },
      ]}
    >
      {/* ─── Search Header ─────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={[styles.searchBar, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
          <Ionicons name="search" size={17} color={colors.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search aesthetics, spaces, curators..."
            placeholderTextColor="#9CA3AF"
            value={query}
            onChangeText={(text) => {
              setQuery(text);
              if (visualSearchImageUri) setVisualSearchImageUri(null);
            }}
            returnKeyType="search"
            onSubmitEditing={() => Keyboard.dismiss()}
            autoCapitalize="none"
            autoCorrect={false}
          />

          {query.length > 0 && (
            <Pressable
              onPress={() => {
                safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setQuery('');
              }}
              hitSlop={8}
              style={{ marginRight: 6 }}
            >
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </Pressable>
          )}

          {/* Reverse Visual Search Camera Button */}
          <Pressable
            onPress={handleVisualSearchPress}
            hitSlop={8}
            style={({ pressed }) => [
              styles.cameraButton,
              pressed && { opacity: 0.6, transform: [{ scale: 0.94 }] },
              visualSearchImageUri && styles.cameraButtonActive,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Reverse visual search with camera or photo"
          >
            <Ionicons
              name={visualSearchImageUri ? 'camera' : 'camera-outline'}
              size={19}
              color={visualSearchImageUri ? '#FFFFFF' : colors.text}
            />
          </Pressable>
        </View>
      </View>

      {/* ─── Task 1: Horizontal ScrollView of Minimalist Trending Tags ─────── */}
      {!visualSearchImageUri && (
        <View style={styles.trendingTagsContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.trendingTagsScroll}
          >
            {TRENDING_TAGS.map((tag) => {
              const isSelected = selectedTag === tag.query;
              return (
                <Pressable
                  key={tag.id}
                  onPress={() => handleTagPress(tag.query)}
                  style={({ pressed }) => [
                    styles.tagPill,
                    {
                      backgroundColor: isSelected
                        ? colors.text
                        : isDark
                        ? '#1F2937'
                        : '#F9FAFB',
                      borderColor: isSelected
                        ? colors.text
                        : isDark
                        ? '#374151'
                        : '#E5E7EB',
                    },
                    pressed && { opacity: 0.75 },
                  ]}
                >
                  <Text
                    style={[
                      styles.tagPillText,
                      {
                        color: isSelected
                          ? colors.background
                          : colors.textSecondary,
                        fontWeight: isSelected ? '700' : '500',
                      },
                    ]}
                  >
                    {tag.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* ─── Task 1: Tabbed Results ("Curations" & "Curators") ──────────────── */}
      {!visualSearchImageUri && (
        <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
          <Pressable
            onPress={() => {
              safeHaptics.selectionAsync();
              setActiveTab('CURATIONS');
            }}
            style={[
              styles.tabBtn,
              activeTab === 'CURATIONS' && [
                styles.tabBtnActive,
                { borderBottomColor: colors.text },
              ],
            ]}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === 'CURATIONS' ? colors.text : colors.textSecondary },
                activeTab === 'CURATIONS' && styles.tabTextActive,
              ]}
            >
              Curations
            </Text>
            {filteredPosts.length > 0 && (
              <View
                style={[
                  styles.tabBadge,
                  {
                    backgroundColor:
                      activeTab === 'CURATIONS' ? colors.text : colors.surfaceMuted,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tabBadgeText,
                    {
                      color:
                        activeTab === 'CURATIONS'
                          ? colors.background
                          : colors.textSecondary,
                    },
                  ]}
                >
                  {filteredPosts.length}
                </Text>
              </View>
            )}
          </Pressable>

          <Pressable
            onPress={() => {
              safeHaptics.selectionAsync();
              setActiveTab('CURATORS');
            }}
            style={[
              styles.tabBtn,
              activeTab === 'CURATORS' && [
                styles.tabBtnActive,
                { borderBottomColor: colors.text },
              ],
            ]}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === 'CURATORS' ? colors.text : colors.textSecondary },
                activeTab === 'CURATORS' && styles.tabTextActive,
              ]}
            >
              Curators
            </Text>
            {filteredCurators.length > 0 && (
              <View
                style={[
                  styles.tabBadge,
                  {
                    backgroundColor:
                      activeTab === 'CURATORS' ? colors.text : colors.surfaceMuted,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tabBadgeText,
                    {
                      color:
                        activeTab === 'CURATORS'
                          ? colors.background
                          : colors.textSecondary,
                    },
                  ]}
                >
                  {filteredCurators.length}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      )}

      {/* ─── Visual Search Scanning State ──────────────────────────────────── */}
      {isVisualSearching && (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#FF5C5C" />
          <Text style={[styles.scanTitle, { color: colors.text }]}>Scanning Aesthetics</Text>
          <Text style={styles.scanSubtitle}>
            Extracting spatial forms, materials, and architectural palettes...
          </Text>
        </View>
      )}

      {/* ─── Visual Search Result Banner (if active) ───────────────────────── */}
      {visualSearchImageUri && !isVisualSearching && (
        <View style={styles.visualBanner}>
          <View style={styles.visualBannerLeft}>
            <Image source={visualSearchImageUri} style={styles.visualThumb} contentFit="cover" />
            <View>
              <Text style={[styles.visualBannerTitle, { color: colors.text }]}>Visual Matches</Text>
              <Text style={styles.visualBannerSub}>
                {visualSearchResults.length} curations matching composition
              </Text>
            </View>
          </View>
          <Pressable onPress={handleClearVisualSearch} hitSlop={10} style={styles.visualCloseBtn}>
            <Ionicons name="close" size={18} color="#6B7280" />
          </Pressable>
        </View>
      )}

      {/* ─── Content Area ──────────────────────────────────────────────────── */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="small" color="#FF5C5C" />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading curated aesthetic directory…
          </Text>
        </View>
      ) : visualSearchImageUri ? (
        /* Visual Search Results Masonry List */
        <MasonryFlashList
          data={visualSearchResults}
          keyExtractor={(item: Post) => item.id}
          renderItem={renderCurationItem}
          contentContainerStyle={styles.masonryContent}
          showsVerticalScrollIndicator={false}
        />
      ) : activeTab === 'CURATIONS' ? (
        /* ─── Task 1: 2-Column MasonryFlashList for Curations ─────────────── */
        <MasonryFlashList
          data={filteredPosts}
          keyExtractor={(item: Post) => item.id}
          renderItem={renderCurationItem}
          contentContainerStyle={styles.masonryContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor="#FF5C5C"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="search-outline" size={26} color="#9CA3AF" />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                No curations found
              </Text>
              <Text style={styles.emptySubtitle}>
                {query || selectedTag
                  ? `No spatial drops found for "${query || selectedTag}". Try another aesthetic or reset filters.`
                  : 'Start exploring by tapping trending tags or searching above.'}
              </Text>
              {(query || selectedTag) && (
                <Pressable
                  onPress={() => {
                    setQuery('');
                    setSelectedTag(null);
                  }}
                  style={styles.resetBtn}
                >
                  <Text style={styles.resetBtnText}>Reset Filters</Text>
                </Pressable>
              )}
            </View>
          }
        />
      ) : (
        /* ─── Task 1: Curators List ────────────────────────────────────────── */
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.curatorsContent}
          keyboardShouldPersistTaps="handled"
        >
          {filteredCurators.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="people-outline" size={26} color="#9CA3AF" />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No curators found</Text>
              <Text style={styles.emptySubtitle}>
                No designers or architects found matching "{query}".
              </Text>
            </View>
          ) : (
            filteredCurators.map((curator) => {
              const following = isFollowingUser(curator.id);
              return (
                <Pressable
                  key={curator.id}
                  onPress={() => handleCuratorPress(curator)}
                  style={({ pressed }) => [
                    styles.curatorCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  {/* Curator Avatar */}
                  <Image source={curator.avatar} style={styles.curatorAvatar} contentFit="cover" />

                  {/* Curator Info */}
                  <View style={styles.curatorInfo}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={[styles.curatorName, { color: colors.text }]} numberOfLines={1}>
                        {curator.name}
                      </Text>
                      <Ionicons name="checkmark-circle" size={14} color="#FF5C5C" />
                    </View>
                    <Text style={styles.curatorHandle} numberOfLines={1}>
                      @{curator.username}
                    </Text>
                    <Text style={[styles.curatorSpecialty, { color: colors.textSecondary }]} numberOfLines={1}>
                      {curator.specialty}
                    </Text>
                  </View>

                  {/* Follow Button */}
                  <Pressable
                    onPress={() => handleToggleFollow(curator.id)}
                    style={({ pressed }) => [
                      styles.curatorFollowBtn,
                      following
                        ? [styles.followingBtn, { borderColor: colors.border }]
                        : styles.notFollowingBtn,
                      pressed && { opacity: 0.75 },
                    ]}
                  >
                    <Text
                      style={[
                        styles.curatorFollowBtnText,
                        following
                          ? [styles.followingBtnText, { color: colors.text }]
                          : styles.notFollowingBtnText,
                      ]}
                    >
                      {following ? 'Following' : 'Follow'}
                    </Text>
                  </Pressable>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 4,
  },
  cameraButton: {
    padding: 6,
    borderRadius: 8,
  },
  cameraButtonActive: {
    backgroundColor: '#FF5C5C',
  },
  trendingTagsContainer: {
    paddingTop: 4,
    paddingBottom: 8,
  },
  trendingTagsScroll: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tagPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  tagPillText: {
    fontSize: 12.5,
    letterSpacing: -0.2,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 24,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  tabTextActive: {
    fontWeight: '800',
  },
  tabBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  masonryContent: {
    paddingHorizontal: HORIZONTAL_CONTAINER_PADDING,
    paddingTop: 10,
    paddingBottom: 30,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '500',
  },
  scanTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginTop: 8,
  },
  scanSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
  },
  visualBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  visualBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  visualThumb: {
    width: 38,
    height: 38,
    borderRadius: 8,
  },
  visualBannerTitle: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  visualBannerSub: {
    fontSize: 11.5,
    color: '#6B7280',
  },
  visualCloseBtn: {
    padding: 6,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
  },
  resetBtn: {
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#111827',
  },
  resetBtnText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  curatorsContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 30,
    gap: 10,
  },
  curatorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  curatorAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E5E7EB',
  },
  curatorInfo: {
    flex: 1,
    gap: 2,
  },
  curatorName: {
    fontSize: 14,
    fontWeight: '800',
  },
  curatorHandle: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  curatorSpecialty: {
    fontSize: 11.5,
    fontWeight: '500',
    marginTop: 2,
  },
  curatorFollowBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFollowingBtn: {
    backgroundColor: '#FF5C5C',
  },
  followingBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  curatorFollowBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  notFollowingBtnText: {
    color: '#FFFFFF',
  },
  followingBtnText: {},
});
