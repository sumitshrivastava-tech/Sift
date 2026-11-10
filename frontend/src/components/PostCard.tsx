import React, { memo, useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
} from 'react-native-reanimated';
import { safeHaptics, Haptics } from '../utils/haptics';
import { Post } from '../types/post';
import { useTheme } from '../context/ThemeContext';

export interface PostCardProps {
  post: Post;
  cardWidth: number;
  onPress?: (post: Post) => void;
  onLongPress?: (post: Post) => void;
  onToggleSave?: (postId: string, willBeSaved: boolean) => void | Promise<void>;
  onLongPressSave?: (post: Post) => void;
  isSaved?: boolean;
}

export const PostCard = memo(
  ({
    post,
    cardWidth,
    onPress,
    onLongPress,
  }: PostCardProps) => {
    const { colors, isDark } = useTheme();

    // Deterministic image height based on aspect ratio for smooth masonry flow
    const imageHeight = Math.round(cardWidth / post.aspectRatio);

    // ─── 60FPS UI-Thread Like Micro-Animation ──────────────────────────────────
    const heartScale = useSharedValue(1);
    const animatedHeartStyle = useAnimatedStyle(() => ({
      transform: [{ scale: heartScale.value }],
    }));

    // Optimistic like state (Lemon8 style heart interaction)
    const [isLiked, setIsLiked] = useState(false);
    const [likesCount, setLikesCount] = useState(post.savesCount ?? 0);

    useEffect(() => {
      setLikesCount(post.savesCount ?? 0);
    }, [post.savesCount]);

    const handleLikePress = useCallback(() => {
      safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const nextLiked = !isLiked;
      setIsLiked(nextLiked);
      setLikesCount((prev) => (nextLiked ? prev + 1 : Math.max(0, prev - 1)));

      // 60fps spring micro-bounce on UI thread
      heartScale.value = withSequence(
        withSpring(1.4, { damping: 9, stiffness: 350 }),
        withSpring(1, { damping: 12, stiffness: 220 })
      );
    }, [isLiked, heartScale]);

    const handleCardPress = useCallback(() => {
      onPress?.(post);
    }, [onPress, post]);

    const handleCardLongPress = useCallback(() => {
      safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      onLongPress?.(post);
    }, [onLongPress, post]);

    return (
      <View
        style={[
          styles.container,
          {
            width: cardWidth,
            backgroundColor: colors.card,
            borderColor: colors.cardBorder,
          },
        ]}
      >
        {/* Main card tap area (navigates to PostDetail) */}
        <Pressable
          onPress={handleCardPress}
          onLongPress={handleCardLongPress}
          delayLongPress={300}
          android_ripple={{ color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }}
          style={({ pressed }) => [
            styles.pressableContainer,
            pressed && styles.cardPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={post.title}
        >
          {/* 1. Rounded-corner Image dynamically adjusting to aspect ratio */}
          <View
            style={[
              styles.imageContainer,
              {
                width: cardWidth,
                height: imageHeight,
                backgroundColor: isDark ? '#222222' : '#F3F4F6',
              },
            ]}
          >
            <Image
              source={post.imageUrl}
              placeholder={post.blurhash}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
              priority="high"
              recyclingKey={post.id}
              style={StyleSheet.absoluteFill}
            />

            {/* Media type indicator badge (multi-image or video) */}
            {((post.media && post.media.length > 1) || (post.sourceTags && post.sourceTags.length > 0)) && (
              <View style={styles.topMediaBadge}>
                <Ionicons
                  name={
                    post.media?.some((m) => typeof m !== 'string' && m.type === 'video')
                      ? 'videocam'
                      : post.sourceTags && post.sourceTags.length > 0
                      ? 'pricetag'
                      : 'copy'
                  }
                  size={10}
                  color="#FFFFFF"
                />
              </View>
            )}
          </View>

          {/* 2. Title text directly below the image */}
          <View style={styles.titleWrapper}>
            <Text
              numberOfLines={2}
              style={[styles.titleText, { color: colors.text }]}
            >
              {post.title}
            </Text>
          </View>
        </Pressable>

        {/* 3. Footer row: small circular user avatar, username, and heart icon with like count */}
        <View style={styles.footerRow}>
          {/* Left: Avatar + Username */}
          <View style={styles.creatorRow}>
            <Image
              source={post.creator.avatarUrl}
              style={styles.avatar}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={150}
            />
            <Text
              numberOfLines={1}
              style={[
                styles.creatorUsername,
                { color: colors.textSecondary, maxWidth: cardWidth - 76 },
              ]}
            >
              {post.creator.name || post.creator.username}
            </Text>
          </View>

          {/* Right: Heart Icon with Like Count */}
          <Pressable
            onPress={handleLikePress}
            hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
            style={styles.likeButton}
            accessibilityRole="button"
            accessibilityLabel={isLiked ? 'Unlike' : 'Like'}
          >
            <Animated.View style={[styles.heartIconWrapper, animatedHeartStyle]}>
              <Ionicons
                name={isLiked ? 'heart' : 'heart-outline'}
                size={15}
                color={isLiked ? colors.heartActive : colors.heartInactive}
              />
            </Animated.View>
            <Text
              style={[
                styles.likeCountText,
                {
                  color: isLiked ? colors.heartActive : colors.textMuted,
                },
              ]}
            >
              {likesCount}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }
);

PostCard.displayName = 'PostCard';

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1.5 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 1.5,
      },
    }),
  },
  pressableContainer: {
    overflow: 'hidden',
  },
  cardPressed: {
    opacity: 0.94,
  },
  imageContainer: {
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  topMediaBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrapper: {
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 4,
  },
  titleText: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 17,
    letterSpacing: -0.2,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 8,
    paddingTop: 4,
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 6,
  },
  avatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    marginRight: 5,
    backgroundColor: '#E5E7EB',
  },
  creatorUsername: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
  },
  heartIconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  likeCountText: {
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 3,
  },
});
