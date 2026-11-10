import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { safeHaptics, Haptics } from '../utils/haptics';
import { RootStackParamList } from '../types/navigation';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  getNotificationsApi,
  ApiNotificationItem,
  NotificationCategory,
} from '../api';

const TABS: { id: NotificationCategory; label: string }[] = [
  { id: 'ALL', label: 'All' },
  { id: 'FOLLOWERS', label: 'Followers' },
  { id: 'SAVES', label: 'Saves' },
  { id: 'COMMENTS', label: 'Comments' },
];

export const ActivityScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors, isDark } = useTheme();
  const { isFollowingUser, toggleFollowUser, markNotificationsRead } = useAuth();

  const [activeTab, setActiveTab] = useState<NotificationCategory>('ALL');
  const [notifications, setNotifications] = useState<ApiNotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ─── Fetch Notifications from Backend ───────────────────────────────────────
  const fetchNotifications = useCallback(
    async (tab: NotificationCategory, isRefresh = false) => {
      try {
        if (isRefresh) setIsRefreshing(true);
        else setIsLoading(true);

        const response = await getNotificationsApi(tab);
        if (response.success && Array.isArray(response.data)) {
          setNotifications(response.data);
        }
      } catch (err) {
        console.warn('[ActivityScreen] Error fetching notifications:', err);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    []
  );

  // Load when active tab changes
  useEffect(() => {
    fetchNotifications(activeTab);
  }, [activeTab, fetchNotifications]);

  // Mark notifications as read whenever screen comes into focus
  useFocusEffect(
    useCallback(() => {
      markNotificationsRead();
      fetchNotifications(activeTab, true);
    }, [markNotificationsRead, activeTab, fetchNotifications])
  );

  const handleRefresh = useCallback(() => {
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fetchNotifications(activeTab, true);
  }, [activeTab, fetchNotifications]);

  const handleTabPress = (tab: NotificationCategory) => {
    safeHaptics.selectionAsync();
    setActiveTab(tab);
  };

  // ─── Interaction Handlers ───────────────────────────────────────────────────
  const handleActorPress = (actor: ApiNotificationItem['actor']) => {
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('PublicCreatorProfile', {
      creatorId: actor.id,
      username: actor.username,
      avatarUrl: actor.avatar,
      bio: actor.fullName ? `Architect & curator ${actor.fullName}` : undefined,
    });
  };

  const handlePostPress = (postId?: string) => {
    if (!postId) return;
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('PostDetail', {
      postId,
    });
  };

  const handleFollowBack = async (actorId: string) => {
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await toggleFollowUser(actorId);
    } catch (err) {
      console.warn('Failed to follow back:', err);
    }
  };

  // ─── Notification Item Renderer ─────────────────────────────────────────────
  const renderItem = useCallback(
    ({ item }: { item: ApiNotificationItem }) => {
      const isFollowing = isFollowingUser(item.actor.id);
      const isFollow =
        item.type === 'NEW_FOLLOWER' ||
        item.type === 'FOLLOWER' ||
        item.type === 'FOLLOWERS';
      const isSave =
        item.type === 'POST_SAVED' ||
        item.type === 'SAVES' ||
        item.type === 'SAVE';
      const isComment =
        item.type === 'NEW_COMMENT' ||
        item.type === 'COMMENTS' ||
        item.type === 'COMMENT';

      let typeIcon: any = 'notifications';
      let typeBadgeBg = '#FF5C5C';

      if (isFollow) {
        typeIcon = 'person-add';
        typeBadgeBg = '#3B82F6';
      } else if (isSave) {
        typeIcon = 'bookmark';
        typeBadgeBg = '#F59E0B';
      } else if (isComment) {
        typeIcon = 'chatbubble';
        typeBadgeBg = '#10B981';
      }

      return (
        <View style={[styles.notificationRow, { borderBottomColor: colors.border }]}>
          {/* Left: Circular Avatar with Small Action Icon Badge */}
          <Pressable
            onPress={() => handleActorPress(item.actor)}
            style={styles.avatarContainer}
            accessibilityRole="button"
            accessibilityLabel={`View ${item.actor.username}'s profile`}
          >
            <Image
              source={
                item.actor.avatar ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                  item.actor.username
                )}&background=111827&color=fff&size=120`
              }
              style={styles.avatarImg}
              contentFit="cover"
              transition={150}
            />
            <View style={[styles.typeBadgeCircle, { backgroundColor: typeBadgeBg }]}>
              <Ionicons name={typeIcon} size={9} color="#FFFFFF" />
            </View>
          </Pressable>

          {/* Center: Body with Bold Username, Action Text & Timestamp */}
          <View style={styles.bodyContainer}>
            <Text style={[styles.contentText, { color: colors.text }]} numberOfLines={3}>
              <Text
                style={styles.boldUsername}
                onPress={() => handleActorPress(item.actor)}
              >
                @{item.actor.username}{' '}
              </Text>
              {isSave && (
                <Text style={styles.actionText}>
                  saved your drop to{' '}
                  <Text style={styles.boardHighlightText}>
                    {item.targetDetails?.boardName || 'Minimalist Arch'}
                  </Text>
                  .
                </Text>
              )}
              {isFollow && (
                <Text style={styles.actionText}>started following your curations.</Text>
              )}
              {isComment && (
                <Text style={styles.actionText}>
                  commented:{' '}
                  <Text style={styles.commentSnippet}>
                    "{item.targetDetails?.commentText ? item.targetDetails.commentText.slice(0, 55) : 'Inspiring spatial aesthetic'}"
                  </Text>
                </Text>
              )}
            </Text>

            <Text style={styles.timestampText}>{item.timestamp}</Text>
          </View>

          {/* Right Accessory: Compact Follow Button or Post Thumbnail */}
          {isFollow ? (
            <Pressable
              onPress={() => handleFollowBack(item.actor.id)}
              style={({ pressed }) => [
                styles.followBtn,
                isFollowing
                  ? [styles.followingBtn, { borderColor: colors.border, backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }]
                  : styles.notFollowingBtn,
                pressed && { opacity: 0.8 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={isFollowing ? 'Following' : 'Follow back'}
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
          ) : item.targetDetails?.postThumbnail ? (
            <Pressable
              onPress={() => handlePostPress(item.targetDetails?.postId)}
              style={styles.thumbnailWrapper}
              accessibilityRole="button"
              accessibilityLabel="View post"
            >
              <Image
                source={item.targetDetails.postThumbnail}
                style={styles.thumbnailImg}
                contentFit="cover"
                transition={150}
              />
            </Pressable>
          ) : null}
        </View>
      );
    },
    [colors, isDark, isFollowingUser]
  );

  // ─── Task 1: Sticky Top Header with Horizontal Category Pills ───────────────
  const renderHeader = () => (
    <View style={[styles.stickyHeader, { backgroundColor: colors.background }]}>
      {/* Screen Title */}
      <View style={styles.titleRow}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Activity</Text>
      </View>

      {/* Horizontal Category Filter Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsScrollContent}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              onPress={() => handleTabPress(tab.id)}
              style={({ pressed }) => [
                styles.tabPill,
                {
                  backgroundColor: isActive
                    ? isDark
                      ? '#FFFFFF'
                      : '#111827'
                    : isDark
                    ? '#1F2937'
                    : '#F3F4F6',
                },
                pressed && { opacity: 0.8 },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
            >
              <Text
                style={[
                  styles.tabPillText,
                  {
                    color: isActive
                      ? isDark
                        ? '#111827'
                        : '#FFFFFF'
                      : isDark
                      ? '#9CA3AF'
                      : '#6B7280',
                    fontWeight: isActive ? '700' : '500',
                  },
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top,
          backgroundColor: colors.background,
        },
      ]}
    >
      {/* Sticky Header with Pills */}
      {renderHeader()}

      {/* ─── Task 1: FlashList for High-Performance Activity Items ─────────── */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="small" color="#FF5C5C" />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading activity…
          </Text>
        </View>
      ) : (
        <FlashList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingBottom: insets.bottom + 24,
          }}
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
                <Ionicons name="notifications-outline" size={26} color="#9CA3AF" />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No Activity Yet</Text>
              <Text style={styles.emptySubtitle}>
                {activeTab === 'ALL'
                  ? 'When creators save your drops, comment, or follow you, updates will appear here.'
                  : `No ${activeTab.toLowerCase()} activity recorded yet.`}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
};

export { ActivityScreen as NotificationsScreen };
export default ActivityScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  stickyHeader: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 10,
  },
  titleRow: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  tabsScrollContent: {
    paddingHorizontal: 18,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabPill: {
    paddingHorizontal: 16,
    paddingVertical: 7.5,
    borderRadius: 20,
  },
  tabPillText: {
    fontSize: 13,
    letterSpacing: -0.2,
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 14,
  },
  avatarImg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E5E7EB',
  },
  typeBadgeCircle: {
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
  bodyContainer: {
    flex: 1,
    paddingRight: 12,
    gap: 3,
  },
  contentText: {
    fontSize: 13.5,
    lineHeight: 18.5,
  },
  boldUsername: {
    fontWeight: '700',
  },
  actionText: {
    fontWeight: '400',
  },
  boardHighlightText: {
    fontWeight: '600',
  },
  commentSnippet: {
    fontStyle: 'italic',
    color: '#6B7280',
  },
  timestampText: {
    fontSize: 11.5,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  followBtn: {
    paddingHorizontal: 15,
    paddingVertical: 6.5,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 78,
  },
  notFollowingBtn: {
    backgroundColor: '#FF5C5C',
  },
  followingBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  followBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  thumbnailWrapper: {
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  thumbnailImg: {
    width: 48,
    height: 48,
    borderRadius: 9,
    backgroundColor: '#F3F4F6',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 36,
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
});
