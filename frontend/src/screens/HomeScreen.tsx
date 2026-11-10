import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  useWindowDimensions,
  RefreshControl,
  Text,
  ActivityIndicator,
  ScrollView,
  Pressable,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { FlashList, ListRenderItemInfo, FlashListProps } from '@shopify/flash-list';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Header, FeedViewType } from '../components/Header';
import { PostCard } from '../components/PostCard';
import { PeekAndPopModal } from '../components/PeekAndPopModal';
import { SaveModal } from '../components/SaveModal';
import { Toast } from '../components/Toast';
import { Post } from '../types/post';
import { getFeed, getFollowingFeedApi, parseJsonArray, ApiPost } from '../api/api';
import { MOCK_POSTS } from '../data/mockPosts';
import { RootStackParamList } from '../types/navigation';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { safeHaptics, Haptics } from '../utils/haptics';

const HORIZONTAL_CONTAINER_PADDING = 10;
const CELL_HORIZONTAL_PADDING = 5;
const NUM_COLUMNS = 2;

// Staggered aspect ratios for authentic dual-column Lemon8/Pinterest masonry layout
const STAGGERED_ASPECT_RATIOS = [0.75, 0.85, 0.68, 1.0, 0.72, 0.82];

/**
 * Performant MasonryFlashList Component using @shopify/flash-list
 * Eliminates scroll lag by leveraging recycled viewholders and native UI thread rendering.
 */
export const MasonryFlashList = React.forwardRef<any, FlashListProps<any>>((props, ref) => {
  return (
    <FlashList
      ref={ref}
      masonry={true}
      numColumns={NUM_COLUMNS}
      optimizeItemArrangement={true}
      {...props}
    />
  );
});
MasonryFlashList.displayName = 'MasonryFlashList';

function mapApiPostToPost(apiPost: ApiPost): Post {
  const images = parseJsonArray(apiPost.images);
  const tags = parseJsonArray(apiPost.tags);
  const sourceTags = apiPost.sourceTags
    ? Array.isArray(apiPost.sourceTags)
      ? apiPost.sourceTags
      : parseJsonArray(apiPost.sourceTags as string)
    : [];

  const hash = (apiPost.id || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const aspectRatio = STAGGERED_ASPECT_RATIOS[Math.abs(hash) % STAGGERED_ASPECT_RATIOS.length];

  return {
    id: apiPost.id,
    title: apiPost.title,
    imageUrl:
      images[0] ??
      `https://picsum.photos/seed/${apiPost.id}/800/1000`,
    media: images,
    sourceTags: sourceTags as any[],
    aspectRatio,
    creator: {
      id: apiPost.author?.id ?? apiPost.authorId,
      name: apiPost.author?.username ?? 'Creator',
      username: apiPost.author?.username ?? 'creator',
      avatarUrl:
        apiPost.author?.avatar ??
        `https://ui-avatars.com/api/?name=${encodeURIComponent(apiPost.author?.username ?? 'C')}&background=random`,
      isVerified: Math.abs(hash) % 2 === 0,
    },
    savesCount: apiPost._count?.saves ?? (Math.abs(hash) % 45 + 1),
    tags,
    isSaved: false,
  };
}

export interface ContactFriend {
  id: string;
  name: string;
  username: string;
  avatar: string;
  phoneOrContact: string;
}

export const MOCK_CONTACTS: ContactFriend[] = [
  {
    id: 'contact-aarav',
    name: 'Aarav Mehta',
    username: 'aarav_arch',
    avatar:
      'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=240&q=80',
    phoneOrContact: 'In your contacts',
  },
  {
    id: 'contact-sophia',
    name: 'Sophia Chen',
    username: 'sophiadesign',
    avatar:
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=240&q=80',
    phoneOrContact: 'In your contacts',
  },
  {
    id: 'contact-rohan',
    name: 'Rohan Kapoor',
    username: 'rohank_interiors',
    avatar:
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=240&q=80',
    phoneOrContact: 'In your contacts',
  },
  {
    id: 'contact-mira',
    name: 'Mira Nair',
    username: 'mira_spatial',
    avatar:
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=240&q=80',
    phoneOrContact: 'In your contacts',
  },
];

export const HomeScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors, isDark } = useTheme();
  const {
    isPostSaved,
    toggleSave,
    refreshSaves,
    followingUserIds,
    isFollowingUser,
    toggleFollowUser,
  } = useAuth();
  const listRef = useRef<any>(null);

  // ─── Feed View State (Following vs For You) ─────────────────────────────────
  const [activeFeedView, setActiveFeedView] = useState<FeedViewType>('FOR_YOU');
  const [posts, setPosts] = useState<Post[]>([]);
  const [followingPosts, setFollowingPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Peek and Pop modal state
  const [peekPost, setPeekPost] = useState<Post | null>(null);
  // Collaborative Canvas Board Save modal state
  const [saveModalPost, setSaveModalPost] = useState<Post | null>(null);

  // Find Friends / Contact Sync state
  const [isContactsSynced, setIsContactsSynced] = useState(false);
  const [isSyncingContacts, setIsSyncingContacts] = useState(false);

  // ─── 60FPS Reanimated Grid Transition Animation ─────────────────────────────
  const gridOpacity = useSharedValue(1);
  const gridTranslateY = useSharedValue(0);

  const animatedGridStyle = useAnimatedStyle(() => ({
    opacity: gridOpacity.value,
    transform: [{ translateY: gridTranslateY.value }],
  }));

  // ─── Layout Geometry ────────────────────────────────────────────────────────
  const columnWidth = useMemo(() => {
    const totalListPadding = HORIZONTAL_CONTAINER_PADDING * 2;
    const availableWidth = windowWidth - totalListPadding;
    return availableWidth / NUM_COLUMNS;
  }, [windowWidth]);

  const cardWidth = useMemo(
    () => Math.floor(columnWidth - CELL_HORIZONTAL_PADDING * 2),
    [columnWidth]
  );

  // ─── Fetch Feed with Real Database Integration for Both Feeds ───────────────
  const fetchFeed = useCallback(
    async (showRefresh = false) => {
      if (showRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        if (activeFeedView === 'FOR_YOU') {
          const response = await getFeed({ page: 1, limit: 50 });
          if (response?.data && Array.isArray(response.data) && response.data.length > 0) {
            const mapped = response.data.map(mapApiPostToPost);
            setPosts(mapped);
          } else {
            setPosts(MOCK_POSTS);
          }
        } else {
          // Following Feed wired directly to live backend database
          const followedIds = Array.from(followingUserIds);
          if (followedIds.length > 0) {
            const response = await getFollowingFeedApi({
              authorIds: followedIds.join(','),
              limit: 50,
            });
            if (response?.data && Array.isArray(response.data)) {
              const mapped = response.data.map(mapApiPostToPost);
              setFollowingPosts(mapped);
            } else {
              setFollowingPosts([]);
            }
          } else {
            setFollowingPosts([]);
          }
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Failed to load posts';
        console.warn('Backend feed unavailable, fallback active:', message);
        if (activeFeedView === 'FOR_YOU') {
          setPosts(MOCK_POSTS);
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [activeFeedView, followingUserIds]
  );

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  useFocusEffect(
    useCallback(() => {
      fetchFeed(true);
    }, [fetchFeed])
  );

  // ─── Feed Toggle Handler with Smooth 60FPS Transition ───────────────────────
  const handleFeedViewChange = useCallback(
    (view: FeedViewType) => {
      if (view === activeFeedView) return;

      setActiveFeedView(view);

      // Smooth fade and micro-slide spring transition on UI thread
      gridOpacity.value = withSequence(
        withTiming(0.2, { duration: 100 }),
        withTiming(1, { duration: 180 })
      );
      gridTranslateY.value = withSequence(
        withTiming(8, { duration: 100 }),
        withSpring(0, { damping: 18, stiffness: 220 })
      );

      // Smoothly scroll back to top of new feed view
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    },
    [activeFeedView, gridOpacity, gridTranslateY]
  );

  const handleLogoPress = useCallback(() => {
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    fetchFeed(true);
  }, [fetchFeed]);

  // ─── Algorithmic Feed vs Following Feed Selection ───────────────────────────
  const displayedPosts = useMemo(() => {
    if (activeFeedView === 'FOR_YOU') {
      return posts.length > 0 ? posts : MOCK_POSTS;
    }
    return followingPosts;
  }, [activeFeedView, posts, followingPosts]);

  // ─── Save / Bookmark Handler ────────────────────────────────────────────────
  const handleToggleSave = useCallback(
    async (postId: string, willBeSaved: boolean) => {
      setToastMessage(
        willBeSaved ? 'Saved to your collection' : 'Removed from saved'
      );
      try {
        await toggleSave(postId);
      } catch (err: any) {
        console.error('Error toggling save:', err);
        setToastMessage('Could not update save. Please check your connection.');
      }
    },
    [toggleSave]
  );

  const handleCardPress = useCallback(
    (post: Post) => {
      navigation.navigate('PostDetail', {
        postId: post.id,
        initialPost: post,
      });
    },
    [navigation]
  );

  const handleCardLongPress = useCallback((post: Post) => {
    setPeekPost(post);
  }, []);

  const handleSyncContacts = useCallback(() => {
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSyncingContacts(true);
    setTimeout(() => {
      setIsSyncingContacts(false);
      setIsContactsSynced(true);
      safeHaptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setToastMessage('Address book synced! 4 contacts found on Sift.');
    }, 600);
  }, []);

  const handleRefresh = useCallback(() => {
    fetchFeed(true);
    refreshSaves();
  }, [fetchFeed, refreshSaves]);

  // ─── MasonryFlashList Helpers ───────────────────────────────────────────────
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Post>) => (
      <View style={{ paddingHorizontal: CELL_HORIZONTAL_PADDING }}>
        <PostCard
          post={item}
          cardWidth={cardWidth}
          isSaved={isPostSaved(item.id)}
          onPress={handleCardPress}
          onLongPress={handleCardLongPress}
          onToggleSave={handleToggleSave}
          onLongPressSave={(p) => setSaveModalPost(p)}
        />
      </View>
    ),
    [cardWidth, handleCardPress, handleCardLongPress, handleToggleSave, isPostSaved]
  );

  const keyExtractor = useCallback((item: Post) => item.id, []);
  const getItemType = useCallback(() => 'post', []);
  const overrideItemLayout = useCallback(
    (layout: { span?: number }) => {
      layout.span = 1;
    },
    []
  );

  // ─── Loading Skeleton ───────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View
        style={[
          styles.safeArea,
          {
            backgroundColor: colors.background,
            paddingTop: insets.top,
            paddingLeft: insets.left,
            paddingRight: insets.right,
          },
        ]}
      >
        <Header
          activeFeedView={activeFeedView}
          onFeedViewChange={handleFeedViewChange}
          onLogoPress={handleLogoPress}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Curating your visual feed…
          </Text>
        </View>
      </View>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <View
      style={[
        styles.safeArea,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}
    >
      {/* ─── Lemon8 Top Tabs Header: Brand Logo + Animated Following / For You Tabs ─ */}
      <Header
        onLogoPress={handleLogoPress}
        activeFeedView={activeFeedView}
        onFeedViewChange={handleFeedViewChange}
      />

      {/* Error Banner */}
      {error && (
        <View style={[styles.errorBanner, { backgroundColor: isDark ? '#2D1616' : '#FEF2F2' }]}>
          <Text style={styles.errorBannerText}>⚠ {error}</Text>
        </View>
      )}

      {/* ─── MasonryFeed using @shopify/flash-list MasonryFlashList (Never Empty) ──── */}
      <Animated.View style={[styles.listWrapper, { backgroundColor: colors.background }, animatedGridStyle]}>
        <MasonryFlashList
          ref={listRef}
          data={displayedPosts}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          getItemType={getItemType}
          overrideItemLayout={overrideItemLayout}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: HORIZONTAL_CONTAINER_PADDING,
            paddingTop: 6,
            paddingBottom: insets.bottom + 24,
          }}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.accent}
              colors={[colors.accent]}
              progressBackgroundColor={colors.card}
            />
          }
          ListHeaderComponent={
            activeFeedView === 'FOLLOWING' ? (
              <View style={styles.contactHeaderWrapper}>
                {/* ─── "From Your Contacts" Header Row ─── */}
                <View style={styles.contactSectionHeader}>
                  <View style={styles.suggestedHeadingRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="book-outline" size={17} color={colors.accent} />
                      <Text style={[styles.suggestedHeadingText, { color: colors.text }]}>
                        From Your Contacts
                      </Text>
                    </View>
                    <Pressable
                      onPress={handleSyncContacts}
                      disabled={isSyncingContacts}
                      style={[
                        styles.syncContactsHeaderBtn,
                        {
                          backgroundColor: isContactsSynced ? colors.surfaceMuted : colors.card,
                          borderColor: colors.border,
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="Sync contacts"
                    >
                      {isSyncingContacts ? (
                        <ActivityIndicator
                          size="small"
                          color={colors.accent}
                          style={{ transform: [{ scale: 0.75 }] }}
                        />
                      ) : (
                        <>
                          <Ionicons
                            name={isContactsSynced ? 'checkmark-circle' : 'sync-outline'}
                            size={13}
                            color={isContactsSynced ? '#10B981' : colors.accent}
                            style={{ marginRight: 4 }}
                          />
                          <Text style={[styles.syncContactsHeaderBtnText, { color: colors.text }]}>
                            {isContactsSynced ? 'Synced' : 'Sync'}
                          </Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                  <Text style={[styles.contactSubtitleText, { color: colors.textSecondary }]}>
                    Find friends and colleagues already curating on Sift.
                  </Text>
                </View>

                {/* Horizontal Scroll of Sync Card + 4 Contact Cards */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.contactsScrollContent}
                >
                  {/* Action Sync Contacts Hero Card */}
                  <View
                    style={[
                      styles.syncActionCard,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.syncIconContainer,
                        { backgroundColor: isContactsSynced ? '#ECFDF5' : '#FFF1F2' },
                      ]}
                    >
                      <Ionicons
                        name={isContactsSynced ? 'checkmark-done-circle' : 'people'}
                        size={24}
                        color={isContactsSynced ? '#10B981' : colors.accent}
                      />
                    </View>
                    <Text style={[styles.syncCardTitle, { color: colors.text }]} numberOfLines={1}>
                      {isContactsSynced ? 'Contacts Active' : 'Sync Contacts'}
                    </Text>
                    <Text
                      style={[styles.syncCardSubtitle, { color: colors.textSecondary }]}
                      numberOfLines={2}
                    >
                      {isContactsSynced ? 'Auto-matching your circle' : 'Connect your address book'}
                    </Text>
                    <Pressable
                      onPress={handleSyncContacts}
                      disabled={isSyncingContacts}
                      style={[
                        styles.syncButtonPill,
                        { backgroundColor: isContactsSynced ? colors.surfaceMuted : colors.accent },
                      ]}
                      accessibilityRole="button"
                    >
                      {isSyncingContacts ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Ionicons
                            name={isContactsSynced ? 'refresh-outline' : 'book-outline'}
                            size={12}
                            color={isContactsSynced ? colors.text : '#FFFFFF'}
                            style={{ marginRight: 4 }}
                          />
                          <Text
                            style={[
                              styles.syncButtonPillText,
                              { color: isContactsSynced ? colors.text : '#FFFFFF' },
                            ]}
                          >
                            {isContactsSynced ? 'Re-sync' : 'Sync Contacts'}
                          </Text>
                        </>
                      )}
                    </Pressable>
                  </View>

                  {/* 4 Mock Contact Cards */}
                  {MOCK_CONTACTS.map((contact) => {
                    const isFollowing = isFollowingUser(contact.id);
                    return (
                      <View
                        key={contact.id}
                        style={[
                          styles.contactCard,
                          {
                            backgroundColor: colors.card,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <Pressable
                          onPress={() => {
                            safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            navigation.navigate('PublicCreatorProfile', {
                              creatorId: contact.id,
                              username: contact.username,
                              avatarUrl: contact.avatar,
                              followersCount: 840,
                            });
                          }}
                          style={styles.contactAvatarWrap}
                          accessibilityRole="button"
                          accessibilityLabel={`View ${contact.name}'s profile`}
                        >
                          <Image
                            source={contact.avatar}
                            style={styles.contactAvatar}
                            contentFit="cover"
                            cachePolicy="memory-disk"
                          />
                          <View style={[styles.contactBookBadge, { backgroundColor: colors.accent }]}>
                            <Ionicons name="call" size={8} color="#FFFFFF" />
                          </View>
                        </Pressable>

                        <Text style={[styles.contactName, { color: colors.text }]} numberOfLines={1}>
                          {contact.name}
                        </Text>
                        <Text style={[styles.contactUsername, { color: colors.textMuted }]} numberOfLines={1}>
                          @{contact.username}
                        </Text>

                        {/* Subtle "In your contacts" pill */}
                        <View
                          style={[
                            styles.inContactsBadge,
                            { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
                          ]}
                        >
                          <Ionicons
                            name="person-outline"
                            size={9}
                            color={colors.textSecondary}
                            style={{ marginRight: 3 }}
                          />
                          <Text
                            style={[styles.inContactsBadgeText, { color: colors.textSecondary }]}
                            numberOfLines={1}
                          >
                            {contact.phoneOrContact}
                          </Text>
                        </View>

                        {/* Interactive Follow Button */}
                        <Pressable
                          onPress={async () => {
                            safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            const willFollow = !isFollowing;
                            await toggleFollowUser(contact.id);
                            setToastMessage(
                              willFollow
                                ? `Following @${contact.username}`
                                : `Unfollowed @${contact.username}`
                            );
                          }}
                          style={[
                            styles.contactFollowBtn,
                            isFollowing
                              ? [
                                  styles.creatorFollowingBtn,
                                  { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
                                ]
                              : [styles.creatorNotFollowingBtn, { backgroundColor: colors.accent }],
                          ]}
                          accessibilityRole="button"
                        >
                          <Text
                            style={[
                              styles.creatorFollowBtnText,
                              isFollowing
                                ? [styles.creatorFollowingBtnText, { color: colors.text }]
                                : styles.creatorNotFollowingBtnText,
                            ]}
                          >
                            {isFollowing ? 'Following' : 'Follow'}
                          </Text>
                        </Pressable>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceMuted }]}>
                <Ionicons
                  name={activeFeedView === 'FOLLOWING' ? 'people-outline' : 'sparkles-outline'}
                  size={30}
                  color={colors.textMuted}
                />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {activeFeedView === 'FOLLOWING'
                  ? 'No posts from creators you follow'
                  : error
                  ? 'Unable to load curations'
                  : 'No curations found'}
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                {activeFeedView === 'FOLLOWING'
                  ? 'Follow architects, designers, and visual curators to build your personal feed.'
                  : error
                  ? 'Check your connection and pull down to retry.'
                  : 'Pull down to refresh and discover new architectural photography.'}
              </Text>
              {activeFeedView === 'FOLLOWING' && (
                <Pressable
                  onPress={() => handleFeedViewChange('FOR_YOU')}
                  style={[styles.emptyActionBtn, { backgroundColor: colors.accent }]}
                  accessibilityRole="button"
                >
                  <Text style={styles.emptyActionBtnText}>Explore For You</Text>
                </Pressable>
              )}
            </View>
          }
        />
      </Animated.View>

      {/* iOS-Style Peek & Pop Context Menu Modal */}
      <PeekAndPopModal
        post={peekPost}
        visible={peekPost !== null}
        onClose={() => setPeekPost(null)}
        onOpenDetail={handleCardPress}
        onToggleSave={handleToggleSave}
        isSaved={peekPost ? isPostSaved(peekPost.id) : false}
      />

      {/* Collaborative Canvas Board Save Bottom Sheet Modal */}
      <SaveModal
        visible={saveModalPost !== null}
        post={saveModalPost}
        onClose={() => setSaveModalPost(null)}
        onSavedToBoard={(board) => {
          setToastMessage(`Saved to "${board.name}"`);
        }}
      />

      {/* Toast Notification */}
      <Toast
        message={toastMessage}
        onDismiss={() => setToastMessage(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  listWrapper: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  errorBanner: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  errorBannerText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '500',
  },
  emptyContainer: {
    paddingVertical: 64,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  emptyActionBtn: {
    marginTop: 18,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyActionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  curateContainer: {
    paddingTop: 36,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  curateIconWrapper: {
    marginBottom: 16,
  },
  curateIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  curateTitle: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: 8,
  },
  curateSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 300,
    marginBottom: 28,
  },
  followingSuggestionsHeader: {
    paddingTop: 8,
    paddingBottom: 12,
  },
  // Contact Sync UI Styles
  contactHeaderWrapper: {
    paddingBottom: 8,
  },
  contactSectionHeader: {
    paddingTop: 4,
    paddingBottom: 4,
  },
  contactSubtitleText: {
    fontSize: 12,
    fontWeight: '500',
    paddingHorizontal: 4,
    marginBottom: 12,
    marginTop: -8,
  },
  syncContactsHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 14,
    borderWidth: 1,
  },
  syncContactsHeaderBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  contactsScrollContent: {
    paddingLeft: 4,
    paddingRight: 16,
    gap: 12,
    paddingBottom: 16,
  },
  syncActionCard: {
    width: 154,
    height: 196,
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  syncIconContainer: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  syncCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  syncCardSubtitle: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 15,
    paddingHorizontal: 4,
  },
  syncButtonPill: {
    width: '100%',
    paddingVertical: 7,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncButtonPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  contactCard: {
    width: 154,
    height: 196,
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  contactAvatarWrap: {
    position: 'relative',
    marginTop: 4,
  },
  contactAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#E5E7EB',
  },
  contactBookBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  contactName: {
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  contactUsername: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 1,
  },
  inContactsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 10,
    borderWidth: 0.5,
  },
  inContactsBadgeText: {
    fontSize: 9.5,
    fontWeight: '600',
  },
  contactFollowBtn: {
    width: '100%',
    paddingVertical: 7,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followingFeedDivider: {
    marginTop: 18,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  suggestedHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 4,
    marginBottom: 14,
  },
  suggestedHeadingText: {
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  curatedBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  curatedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  suggestedScrollContent: {
    paddingLeft: 4,
    paddingRight: 16,
    gap: 14,
    paddingBottom: 16,
  },
  creatorCard: {
    width: 172,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    paddingBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  creatorCardCover: {
    width: '100%',
    height: 72,
    backgroundColor: '#E5E7EB',
  },
  avatarTouchArea: {
    marginTop: -28,
    marginBottom: 8,
    position: 'relative',
  },
  creatorCardAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    backgroundColor: '#E5E7EB',
  },
  verifiedCheckBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FF5C5C',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  creatorName: {
    fontSize: 14,
    fontWeight: '800',
    paddingHorizontal: 8,
    textAlign: 'center',
  },
  creatorUsername: {
    fontSize: 12,
    marginTop: 2,
    paddingHorizontal: 8,
    textAlign: 'center',
    fontWeight: '500',
  },
  specialtyPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginTop: 8,
    marginBottom: 12,
    maxWidth: 150,
    borderWidth: 0.5,
  },
  specialtyPillText: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  creatorFollowBtn: {
    width: 142,
    paddingVertical: 8,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatorNotFollowingBtn: {},
  creatorFollowingBtn: {
    borderWidth: 1,
  },
  creatorFollowBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  creatorNotFollowingBtnText: {
    color: '#FFFFFF',
  },
  creatorFollowingBtnText: {},
});
