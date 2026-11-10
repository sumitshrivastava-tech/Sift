import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Share,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { safeHaptics, Haptics } from '../utils/haptics';

import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { RootStackParamList } from '../types/navigation';
import { Toast } from '../components/Toast';
import { EditProfileModal } from '../components/EditProfileModal';
import { MasonryFlashList } from '../components/MasonryFlashList';
import { PostCard } from '../components/PostCard';
import {
  getFeed,
  getUserSavesApi,
  parseJsonArray,
  ApiPost,
  UserSaveRecord,
  api,
} from '../api';
import { Post } from '../types/post';

const HORIZONTAL_CONTAINER_PADDING = 10;
const CELL_HORIZONTAL_PADDING = 5;
const NUM_COLUMNS = 2;

type ProfileRouteProps = RouteProp<
  RootStackParamList,
  'PublicCreatorProfile'
>;

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return String(num);
}

export const ProfileScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<ProfileRouteProps>();
  const { colors, isDark } = useTheme();

  const {
    currentUser,
    savedPostIds,
    updateProfile,
    followingCount,
    isFollowingUser,
    toggleFollowUser,
    isPostSaved,
    toggleSave,
  } = useAuth();

  // Route parameters (when viewing a public creator profile)
  const routeParams = route?.params as any;
  const targetUserId = routeParams?.creatorId || routeParams?.userId;

  // Determine if viewing own profile or another creator's profile
  const isOwnProfile = !targetUserId || targetUserId === currentUser.id;

  // ─── Profile Details State ──────────────────────────────────────────────────
  const [profileData, setProfileData] = useState({
    id: isOwnProfile ? currentUser.id : targetUserId,
    username: isOwnProfile
      ? currentUser.username
      : routeParams?.username || 'creator',
    fullName: isOwnProfile
      ? currentUser.fullName || currentUser.username
      : routeParams?.fullName || routeParams?.username || 'Creator',
    avatar: isOwnProfile
      ? currentUser.avatar
      : routeParams?.avatarUrl || null,
    bio: isOwnProfile
      ? currentUser.bio || 'Spatial designer & aesthetic curator.'
      : routeParams?.bio || 'Architectural designer, spatial researcher & curator.',
    followersCount: isOwnProfile
      ? currentUser.followersCount ?? 1240
      : routeParams?.followersCount ?? 1240,
    followingCount: isOwnProfile
      ? currentUser.followingCount ?? followingCount ?? 38
      : routeParams?.followingCount ?? 42,
  });

  const [activeTab, setActiveTab] = useState<'CREATED' | 'SAVED'>('CREATED');
  const [createdPosts, setCreatedPosts] = useState<Post[]>([]);
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Follow state for public creator profile
  const isFollowing = isFollowingUser(profileData.id);

  // Sync profile data when currentUser updates (for own profile)
  useEffect(() => {
    if (isOwnProfile) {
      setProfileData({
        id: currentUser.id,
        username: currentUser.username,
        fullName: currentUser.fullName || currentUser.username,
        avatar: currentUser.avatar,
        bio: currentUser.bio || 'Spatial designer & aesthetic curator.',
        followersCount: currentUser.followersCount ?? 1240,
        followingCount: currentUser.followingCount ?? followingCount ?? 38,
      });
    }
  }, [currentUser, isOwnProfile, followingCount]);

  // If viewing another user, optionally fetch fresh profile info from backend
  useEffect(() => {
    if (!isOwnProfile && targetUserId) {
      let isMounted = true;
      async function fetchCreatorDetails() {
        try {
          const res = await api.get(`/api/users/${targetUserId}`);
          if (isMounted && res.data?.data) {
            const u = res.data.data;
            setProfileData((prev) => ({
              ...prev,
              username: u.username || prev.username,
              fullName: u.fullName || prev.fullName,
              avatar: u.avatar || prev.avatar,
              bio: u.bio || prev.bio,
              followersCount: u.followersCount ?? prev.followersCount,
            }));
          }
        } catch {
          // Graceful retention of route parameters
        }
      }
      fetchCreatorDetails();
      return () => {
        isMounted = false;
      };
    }
  }, [isOwnProfile, targetUserId]);

  // ─── Fetch Created & Saved Drops from Backend ────────────────────────────────
  const loadProfileFeed = useCallback(async () => {
    try {
      setIsLoadingPosts(true);

      // 1. Fetch created posts for this profile user
      const feedRes = await getFeed({ page: 1, limit: 50 });
      if (feedRes.success && Array.isArray(feedRes.data)) {
        const aspectRatios = [0.75, 0.85, 0.68, 1.0, 0.72, 0.82];

        // Filter drops created by this profile user (or show aesthetic showcase if newly seeded)
        let matched = feedRes.data.filter(
          (p: ApiPost) =>
            p.authorId === profileData.id ||
            p.author?.id === profileData.id ||
            p.author?.username?.toLowerCase() === profileData.username.toLowerCase()
        );

        if (matched.length === 0 && !isOwnProfile) {
          matched = feedRes.data.slice(0, 6);
        }

        const mappedCreated: Post[] = matched.map((raw: ApiPost, idx: number) => {
          const images = parseJsonArray(raw.images);
          return {
            id: raw.id,
            title: raw.title,
            imageUrl: images[0] ?? `https://picsum.photos/seed/${raw.id}/800/1000`,
            aspectRatio: aspectRatios[idx % aspectRatios.length],
            creator: {
              id: profileData.id,
              name: profileData.fullName,
              username: profileData.username,
              avatarUrl: profileData.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(profileData.username)}&background=random`,
            },
            savesCount: raw._count?.saves ?? raw.likesCount ?? 0,
            tags: parseJsonArray(raw.tags),
            isSaved: isPostSaved(raw.id),
          };
        });
        setCreatedPosts(mappedCreated);

        // 2. Fetch saved posts for this user
        try {
          const savesRes = await getUserSavesApi(profileData.id);
          if (savesRes.success && Array.isArray(savesRes.data)) {
            const mappedSaved: Post[] = savesRes.data
              .filter((rec: UserSaveRecord) => !!rec.post)
              .map((rec: UserSaveRecord, idx: number) => {
                const images = parseJsonArray(rec.post.images);
                return {
                  id: rec.post.id,
                  title: rec.post.title,
                  imageUrl: images[0] ?? `https://picsum.photos/seed/${rec.post.id}/800/1000`,
                  aspectRatio: aspectRatios[idx % aspectRatios.length],
                  creator: {
                    id: rec.post.author?.id ?? rec.post.authorId,
                    name: rec.post.author?.fullName || rec.post.author?.username || 'Creator',
                    username: rec.post.author?.username || 'creator',
                    avatarUrl: rec.post.author?.avatar ?? `https://ui-avatars.com/api/?name=C&background=random`,
                  },
                  savesCount: rec.post._count?.saves ?? 0,
                  tags: parseJsonArray(rec.post.tags),
                  isSaved: true,
                };
              });
            setSavedPosts(mappedSaved);
          } else {
            // Fallback: match any post whose ID is in savedPostIds
            const fallbackSaved = feedRes.data
              .filter((p: ApiPost) => savedPostIds.has(p.id))
              .map((raw: ApiPost, idx: number) => ({
                id: raw.id,
                title: raw.title,
                imageUrl: parseJsonArray(raw.images)[0] ?? `https://picsum.photos/seed/${raw.id}/800/1000`,
                aspectRatio: aspectRatios[idx % aspectRatios.length],
                creator: {
                  id: raw.author?.id ?? raw.authorId,
                  name: raw.author?.username ?? 'Creator',
                  username: raw.author?.username ?? 'creator',
                  avatarUrl: raw.author?.avatar ?? `https://ui-avatars.com/api/?name=C&background=random`,
                },
                savesCount: raw._count?.saves ?? 0,
                tags: parseJsonArray(raw.tags),
                isSaved: true,
              }));
            setSavedPosts(fallbackSaved);
          }
        } catch {
          setSavedPosts([]);
        }
      }
    } catch (err) {
      console.warn('Failed to load profile posts:', err);
    } finally {
      setIsLoadingPosts(false);
      setIsRefreshing(false);
    }
  }, [profileData.id, profileData.username, profileData.fullName, profileData.avatar, isOwnProfile, isPostSaved, savedPostIds]);

  useEffect(() => {
    loadProfileFeed();
  }, [loadProfileFeed]);

  const handleRefresh = async () => {
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsRefreshing(true);
    await loadProfileFeed();
  };

  // ─── Follow / Unfollow Interaction (Task 4) ─────────────────────────────────
  const handleFollowPress = async () => {
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Dynamic follower count update
    const willFollow = !isFollowing;
    setProfileData((prev) => ({
      ...prev,
      followersCount: Math.max(0, prev.followersCount + (willFollow ? 1 : -1)),
    }));

    try {
      await toggleFollowUser(profileData.id);
      setToastMessage(willFollow ? `Following @${profileData.username}` : `Unfollowed @${profileData.username}`);
    } catch (err) {
      // Rollback on failure
      setProfileData((prev) => ({
        ...prev,
        followersCount: Math.max(0, prev.followersCount + (willFollow ? -1 : 1)),
      }));
      setToastMessage('Could not update follow status. Please try again.');
    }
  };

  // ─── Share Profile Action ───────────────────────────────────────────────────
  const handleShareProfile = async () => {
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({
        message: `Check out @${profileData.username}'s spatial moodboards on Sift: https://sift.app/@${profileData.username}`,
      });
    } catch {
      // Ignored
    }
  };

  // ─── Card Press Navigators ──────────────────────────────────────────────────
  const handleCardPress = useCallback(
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
        console.error('Error toggling save in profile:', err);
      }
    },
    [toggleSave]
  );

  // Layout width for 2-column masonry grid
  const cardWidth = Math.floor(
    (windowWidth - HORIZONTAL_CONTAINER_PADDING * 2 - CELL_HORIZONTAL_PADDING * 2 * NUM_COLUMNS) /
      NUM_COLUMNS
  );

  const displayedPosts = activeTab === 'CREATED' ? createdPosts : savedPosts;

  const renderPostItem = useCallback(
    ({ item }: { item: Post }) => (
      <View style={{ paddingHorizontal: CELL_HORIZONTAL_PADDING }}>
        <PostCard
          post={item}
          cardWidth={cardWidth}
          onPress={handleCardPress}
          onToggleSave={handleSaveToggle}
          isSaved={isPostSaved(item.id)}
        />
      </View>
    ),
    [cardWidth, handleCardPress, handleSaveToggle, isPostSaved]
  );

  const avatarUrl =
    profileData.avatar ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      profileData.fullName || profileData.username || 'User'
    )}&background=111827&color=fff&size=200`;

  // ─── Unified Profile Header (Task 2) ────────────────────────────────────────
  const renderProfileHeader = () => (
    <View style={styles.headerContainer}>
      {/* ─── Top Navigation Bar ─── */}
      <View style={[styles.topNavBar, { borderBottomColor: colors.border }]}>
        {!isOwnProfile ? (
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={10}
            style={styles.navBarIconBtn}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
        ) : (
          <View style={{ width: 40 }} />
        )}

        <Text style={[styles.navBarTitle, { color: colors.text }]} numberOfLines={1}>
          @{profileData.username}
        </Text>

        {isOwnProfile ? (
          <Pressable
            onPress={() => {
              safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate('Settings');
            }}
            hitSlop={10}
            style={styles.navBarIconBtn}
            accessibilityRole="button"
            accessibilityLabel="Settings"
          >
            <Ionicons name="settings-outline" size={21} color={colors.text} />
          </Pressable>
        ) : (
          <Pressable
            onPress={handleShareProfile}
            hitSlop={10}
            style={styles.navBarIconBtn}
            accessibilityRole="button"
            accessibilityLabel="Share profile"
          >
            <Ionicons name="share-outline" size={21} color={colors.text} />
          </Pressable>
        )}
      </View>

      {/* ─── Center-Aligned Avatar -> Name -> @username -> Bio ─── */}
      <View style={styles.centerHeroSection}>
        <View style={styles.avatarContainer}>
          <Image
            source={avatarUrl}
            style={styles.avatarImg}
            contentFit="cover"
            transition={150}
          />
        </View>

        <Text style={[styles.profileFullName, { color: colors.text }]}>
          {profileData.fullName}
        </Text>
        <Text style={styles.profileHandle}>@{profileData.username}</Text>

        {profileData.bio ? (
          <Text style={[styles.profileBio, { color: colors.textSecondary }]}>
            {profileData.bio}
          </Text>
        ) : null}

        {/* ─── Minimalist Text-Only Stats Row (No Heavy Grey Boxes) ─── */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {formatNumber(profileData.followersCount)}
            </Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>

          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />

          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {formatNumber(profileData.followingCount)}
            </Text>
            <Text style={styles.statLabel}>Following</Text>
          </View>

          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />

          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {formatNumber(
                isOwnProfile ? savedPostIds.size : savedPosts.length || 16
              )}
            </Text>
            <Text style={styles.statLabel}>Saves</Text>
          </View>
        </View>

        {/* ─── Prominent Full-Width Action Button ─── */}
        <View style={styles.actionButtonContainer}>
          {isOwnProfile ? (
            <Pressable
              onPress={() => {
                safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setIsEditModalVisible(true);
              }}
              style={({ pressed }) => [
                styles.editProfileBtn,
                { backgroundColor: isDark ? '#1F2937' : '#F3F4F6', borderColor: colors.border },
                pressed && { opacity: 0.8 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Edit Profile"
            >
              <Ionicons name="pencil-outline" size={15} color={colors.text} style={{ marginRight: 6 }} />
              <Text style={[styles.editProfileBtnText, { color: colors.text }]}>
                Edit Profile
              </Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={handleFollowPress}
              style={({ pressed }) => [
                styles.followBtn,
                isFollowing
                  ? [styles.followingActiveBtn, { borderColor: colors.border, backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }]
                  : styles.notFollowingSolidBtn,
                pressed && { opacity: 0.85 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={isFollowing ? 'Unfollow' : 'Follow'}
            >
              <Text
                style={[
                  styles.followBtnText,
                  isFollowing ? { color: colors.text } : { color: '#FFFFFF' },
                ]}
              >
                {isFollowing ? 'Following' : 'Follow'}
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* ─── Two Tabs: "Created" | "Saved" ─── */}
      <View style={[styles.tabSelectorBar, { borderBottomColor: colors.border }]}>
        <Pressable
          onPress={() => {
            safeHaptics.selectionAsync();
            setActiveTab('CREATED');
          }}
          style={[
            styles.tabSelectorBtn,
            activeTab === 'CREATED' && [styles.tabSelectorBtnActive, { borderBottomColor: colors.text }],
          ]}
        >
          <Ionicons
            name={activeTab === 'CREATED' ? 'grid' : 'grid-outline'}
            size={17}
            color={activeTab === 'CREATED' ? colors.text : colors.textSecondary}
          />
          <Text
            style={[
              styles.tabSelectorText,
              { color: activeTab === 'CREATED' ? colors.text : colors.textSecondary },
              activeTab === 'CREATED' && styles.tabSelectorTextActive,
            ]}
          >
            Created ({createdPosts.length})
          </Text>
        </Pressable>

        <Pressable
          onPress={() => {
            safeHaptics.selectionAsync();
            setActiveTab('SAVED');
          }}
          style={[
            styles.tabSelectorBtn,
            activeTab === 'SAVED' && [styles.tabSelectorBtnActive, { borderBottomColor: colors.text }],
          ]}
        >
          <Ionicons
            name={activeTab === 'SAVED' ? 'bookmark' : 'bookmark-outline'}
            size={17}
            color={activeTab === 'SAVED' ? colors.text : colors.textSecondary}
          />
          <Text
            style={[
              styles.tabSelectorText,
              { color: activeTab === 'SAVED' ? colors.text : colors.textSecondary },
              activeTab === 'SAVED' && styles.tabSelectorTextActive,
            ]}
          >
            Saved ({isOwnProfile ? savedPostIds.size : savedPosts.length})
          </Text>
        </Pressable>
      </View>
    </View>
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
      {/* ─── Both Tabs Render in Lag-Free MasonryFlashList ─── */}
      <MasonryFlashList
        data={displayedPosts}
        keyExtractor={(item: Post) => item.id}
        renderItem={renderPostItem}
        ListHeaderComponent={renderProfileHeader}
        contentContainerStyle={styles.flashListContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#FF5C5C"
          />
        }
        ListEmptyComponent={
          isLoadingPosts ? (
            <View style={styles.emptyStateContainer}>
              <ActivityIndicator size="small" color="#FF5C5C" />
            </View>
          ) : (
            <View style={styles.emptyStateContainer}>
              <View style={styles.emptyIconWrap}>
                <Ionicons
                  name={activeTab === 'CREATED' ? 'cube-outline' : 'bookmark-outline'}
                  size={26}
                  color="#9CA3AF"
                />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {activeTab === 'CREATED' ? 'No Drops Published Yet' : 'No Saved Drops'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {activeTab === 'CREATED'
                  ? isOwnProfile
                    ? 'Publish your first architecture or interior drop using the (+) button.'
                    : `@${profileData.username} hasn't published any public drops yet.`
                  : 'Bookmark design pieces, textures, and spaces across Sift to collect them here.'}
              </Text>
            </View>
          )
        }
      />

      {/* ─── Edit Profile 50% Bottom Sheet (Task 3) ─── */}
      {isOwnProfile && (
        <EditProfileModal
          visible={isEditModalVisible}
          currentUsername={currentUser.username}
          currentFullName={currentUser.fullName}
          currentBio={currentUser.bio}
          currentAvatar={currentUser.avatar}
          onClose={() => setIsEditModalVisible(false)}
          onSave={async (data) => {
            await updateProfile(data);
            setToastMessage('Profile updated successfully');
          }}
        />
      )}

      {/* Feedback Toast */}
      <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  flashListContent: {
    paddingBottom: 40,
  },
  headerContainer: {
    paddingBottom: 4,
  },
  topNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navBarTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  navBarIconBtn: {
    padding: 6,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerHeroSection: {
    alignItems: 'center',
    paddingTop: 18,
    paddingHorizontal: 20,
  },
  avatarContainer: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 12,
  },
  avatarImg: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    backgroundColor: '#E5E7EB',
  },
  profileFullName: {
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  profileHandle: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '500',
    marginTop: 2,
    textAlign: 'center',
  },
  profileBio: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 8,
    maxWidth: 320,
    paddingHorizontal: 8,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    marginBottom: 16,
    width: '100%',
    paddingHorizontal: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '500',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 20,
  },
  actionButtonContainer: {
    width: '100%',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  editProfileBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  followBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 11,
    borderRadius: 20,
  },
  notFollowingSolidBtn: {
    backgroundColor: '#FF5C5C',
  },
  followingActiveBtn: {
    borderWidth: 1,
  },
  followBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  tabSelectorBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    width: '100%',
  },
  tabSelectorBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabSelectorBtnActive: {
    borderBottomWidth: 2,
  },
  tabSelectorText: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  tabSelectorTextActive: {
    fontWeight: '800',
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 12.5,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 17,
  },
});
