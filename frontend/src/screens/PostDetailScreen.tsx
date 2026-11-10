import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
  FlatList,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Share,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { safeHaptics, Haptics } from '../utils/haptics';
import { RouteProp, useNavigation, useRoute, StackActions } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import {
  getPostById,
  getRelatedPostsApi,
  parseJsonArray,
  ApiPost,
  getCommentsApi,
  createCommentApi,
  toggleCommentLikeApi,
  ApiComment,
} from '../api';
import { Toast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { PostCarousel } from '../components/PostCarousel';
import { PostCard } from '../components/PostCard';
import { SourceTagsOverlay } from '../components/SourceTagsOverlay';
import { SourceTag, MediaItem, Post } from '../types/post';
import { MOCK_POSTS } from '../data/mockPosts';

function formatCommentTime(dateString?: string): string {
  if (!dateString) return 'Just now';
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return 'Recently';
  }
}

const STAGGERED_ASPECT_RATIOS = [0.75, 0.85, 0.68, 1.0, 0.72, 0.82];

function mapApiPostToPost(apiPost: ApiPost): Post {
  const images = parseJsonArray(apiPost.images);
  const tags = parseJsonArray(apiPost.tags);

  const hash = (apiPost.id || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const aspectRatio = STAGGERED_ASPECT_RATIOS[Math.abs(hash) % STAGGERED_ASPECT_RATIOS.length];

  return {
    id: apiPost.id,
    title: apiPost.title,
    content: apiPost.content,
    imageUrl:
      images[0] ??
      `https://picsum.photos/seed/${apiPost.id}/800/1000`,
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
    savesCount: apiPost._count?.saves ?? 0,
    tags,
    isSaved: false,
  };
}

type PostDetailRouteProp = RouteProp<RootStackParamList, 'PostDetail'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface DetailPostState {
  id: string;
  title: string;
  content: string;
  images: string[];
  tags: string[];
  sourceTags?: SourceTag[];
  author: {
    id: string;
    username: string;
    avatar: string | null;
  };
  savesCount: number;
  isSaved?: boolean;
  createdAt?: string;
}


function buildDetailPostFromFallback(
  fallback: Partial<Post> | Post,
  fallbackId: string
): DetailPostState {
  const mediaUrls =
    (fallback as any).media?.map((m: any) =>
      typeof m === 'string' ? m : m.url
    ) || (fallback.imageUrl ? [fallback.imageUrl] : []);

  return {
    id: fallback.id ?? fallbackId,
    title: fallback.title ?? 'Curated Architectural Space',
    content:
      (fallback as any).content ??
      'A study in minimalist proportions, honest materials, and spatial harmony designed for living.',
    images:
      mediaUrls.length > 0
        ? mediaUrls
        : [`https://picsum.photos/seed/${fallback.id ?? fallbackId}/800/1000`],
    tags: fallback.tags ?? ['Architecture', 'Design', 'Minimal'],
    sourceTags: (fallback as any).sourceTags ?? [],
    author: {
      id: fallback.creator?.id ?? 'author-1',
      username:
        fallback.creator?.username ??
        fallback.creator?.name ??
        'Creator',
      avatar: fallback.creator?.avatarUrl ?? null,
    },
    savesCount: fallback.savesCount ?? 0,
    isSaved: fallback.isSaved ?? false,
  };
}

// ─── Comment Heart React Button with 60FPS Reanimated Spring Bounce ─────────
const CommentHeartButton: React.FC<{
  isLiked: boolean;
  onToggle: () => void;
}> = ({ isLiked, onToggle }) => {
  const heartScale = useSharedValue(1);

  const animatedHeartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }));

  const handlePress = () => {
    heartScale.value = withSequence(
      withSpring(1.45, { damping: 6, stiffness: 350 }),
      withSpring(1.0, { damping: 12, stiffness: 220 })
    );
    onToggle();
  };

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={10}
      style={styles.commentLikeButton}
      accessibilityRole="button"
      accessibilityLabel={isLiked ? 'Unlike comment' : 'Like comment'}
    >
      <Animated.View style={animatedHeartStyle}>
        <Ionicons
          name={isLiked ? 'heart' : 'heart-outline'}
          size={16}
          color={isLiked ? '#FF5C5C' : '#9CA3AF'}
        />
      </Animated.View>
    </Pressable>
  );
};

export const PostDetailScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<PostDetailRouteProp>();
  const { postId, initialPost } = route.params;

  // Carousel image height (~4:5 ratio on mobile)
  const carouselHeight = Math.round(windowWidth * 1.18);

  // ─── Initial Fallback Discovery ─────────────────────────────────────────────
  const fallbackSource =
    initialPost ||
    (route.params as any)?.post ||
    MOCK_POSTS.find((p) => p.id === postId);

  // ─── State ──────────────────────────────────────────────────────────────────
  const [post, setPost] = useState<DetailPostState | null>(() => {
    if (fallbackSource) {
      return buildDetailPostFromFallback(fallbackSource, postId);
    }
    return null;
  });

  const { currentUser, isPostSaved, toggleSave, isFollowingUser, toggleFollowUser } = useAuth();
  const isSaved = isPostSaved(postId);
  const [isOptimisticallySaved, setIsOptimisticallySaved] = useState(isSaved);

  useEffect(() => {
    setIsOptimisticallySaved(isSaved);
  }, [isSaved]);

  const [isLoading, setIsLoading] = useState(!fallbackSource);

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [savesCount, setSavesCount] = useState(fallbackSource?.savesCount ?? 0);
  const authorId = post?.author?.id ?? '';
  const isFollowing = isFollowingUser(authorId);
  const [commentText, setCommentText] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const commentInputRef = useRef<any>(null);


  // Comments state
  const [comments, setComments] = useState<ApiComment[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(true);
  const [likedCommentIds, setLikedCommentIds] = useState<Set<string>>(new Set());

  // Infinite Rabbit Hole Related Posts State
  const [relatedPosts, setRelatedPosts] = useState<Post[]>([]);
  const [isLoadingRelated, setIsLoadingRelated] = useState(true);

  // Masonry geometry
  const masonryHorizontalPadding = 20;
  const masonryGap = 12;
  const masonryCardWidth = Math.floor(
    (windowWidth - masonryHorizontalPadding * 2 - masonryGap) / 2
  );

  // Advanced Reaction Engine state
  const [activeReaction, setActiveReaction] = useState<string | null>(null);
  const [showReactionMenu, setShowReactionMenu] = useState(false);

  // 60FPS Reanimated Shared Values
  const saveScale = useSharedValue(1);
  const reactScale = useSharedValue(1);
  const reactionMenuProgress = useSharedValue(0);

  const saveAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: saveScale.value }],
  }));

  const reactAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: reactScale.value }],
  }));

  const reactionMenuAnimatedStyle = useAnimatedStyle(() => ({
    opacity: reactionMenuProgress.value,
    transform: [
      { scale: reactionMenuProgress.value },
      { translateY: (1 - reactionMenuProgress.value) * 14 },
    ],
  }));

  // ─── Fetch Full Post Detail ─────────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;

    async function loadPostDetail() {
      try {
        const response = await getPostById(postId);
        if (!isMounted) return;

        const raw: ApiPost = response.data;
        const parsedImages = parseJsonArray(raw.images);
        const parsedTags = parseJsonArray(raw.tags);
        const parsedSourceTags = raw.sourceTags
          ? Array.isArray(raw.sourceTags)
            ? raw.sourceTags
            : parseJsonArray(raw.sourceTags as string)
          : [];

        const safeImages =
          parsedImages.length > 0
            ? parsedImages
            : [
                `https://picsum.photos/seed/${raw.id}/800/1000`,
              ];

        setPost({
          id: raw.id,
          title: raw.title,
          content: raw.content,
          images: safeImages,
          tags: parsedTags,
          sourceTags: parsedSourceTags as any,
          author: {
            id: raw.author?.id ?? raw.authorId,
            username: raw.author?.username ?? 'Creator',
            avatar: raw.author?.avatar ?? null,
          },
          savesCount: raw._count?.saves ?? 0,
          createdAt: raw.createdAt,
        });

        setSavesCount(raw._count?.saves ?? 0);
      } catch (error) {
        console.warn('getPostById failed (falling back to initial/mock post data):', error);
        if (isMounted) {
          const fallback =
            initialPost ||
            (route.params as any)?.post ||
            MOCK_POSTS.find((p) => p.id === postId);

          if (fallback) {
            setPost((existing) => existing ?? buildDetailPostFromFallback(fallback, postId));
            if (fallback.savesCount !== undefined) {
              setSavesCount(fallback.savesCount);
            }
          } else {
            setToastMessage('Could not load full post details.');
          }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadPostDetail();

    return () => {
      isMounted = false;
    };
  }, [postId]);

  // ─── Fetch Comments on Mount ────────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;

    async function loadComments() {
      try {
        setIsLoadingComments(true);
        const res = await getCommentsApi(postId);
        if (isMounted && res.success && Array.isArray(res.data) && res.data.length > 0) {
          setComments(res.data);
        } else if (isMounted) {
          setComments([
            {
              id: 'comment-mock-1',
              postId,
              authorId: 'user-mock-1',
              content: 'The interplay between concrete textures and indirect light here is masterful.',
              createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
              author: {
                id: 'user-mock-1',
                username: 'minimal_archi',
                avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
              },
            },
            {
              id: 'comment-mock-2',
              postId,
              authorId: 'user-mock-2',
              content: 'Where was this shot? Incredible spatial perspective.',
              createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
              author: {
                id: 'user-mock-2',
                username: 'elena_r',
                avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80',
              },
            },
          ]);
        }
      } catch (error) {
        console.warn('Failed to load comments, using fallback comments:', error);
        if (isMounted) {
          setComments([
            {
              id: 'comment-mock-1',
              postId,
              authorId: 'user-mock-1',
              content: 'The interplay between concrete textures and indirect light here is masterful.',
              createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
              author: {
                id: 'user-mock-1',
                username: 'minimal_archi',
                avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
              },
            },
          ]);
        }
      } finally {
        if (isMounted) {
          setIsLoadingComments(false);
        }
      }
    }

    loadComments();

    return () => {
      isMounted = false;
    };
  }, [postId]);

  // ─── Fetch Related Posts (Infinite Rabbit Hole) ─────────────────────────────
  useEffect(() => {
    let isMounted = true;

    async function loadRelated() {
      try {
        setIsLoadingRelated(true);
        const res = await getRelatedPostsApi(postId, 10);
        if (isMounted && res.success && Array.isArray(res.data) && res.data.length > 0) {
          const mapped = res.data.map(mapApiPostToPost);
          setRelatedPosts(mapped);
        } else if (isMounted) {
          const mockRelated = MOCK_POSTS.filter((p) => p.id !== postId).slice(0, 6);
          setRelatedPosts(mockRelated);
        }
      } catch (error) {
        console.warn('Failed to load related posts, using mock fallback:', error);
        if (isMounted) {
          const mockRelated = MOCK_POSTS.filter((p) => p.id !== postId).slice(0, 6);
          setRelatedPosts(mockRelated);
        }
      } finally {
        if (isMounted) {
          setIsLoadingRelated(false);
        }
      }
    }

    loadRelated();

    return () => {
      isMounted = false;
    };
  }, [postId]);

  // ─── Rabbit Hole Navigation & Interaction Callbacks ─────────────────────────
  const handleRelatedPostPress = useCallback(
    (item: Post) => {
      safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      navigation.dispatch(
        StackActions.push('PostDetail', {
          postId: item.id,
          initialPost: item,
        })
      );
    },
    [navigation]
  );

  const handleToggleRelatedSave = useCallback(
    async (targetPostId: string, willBeSaved: boolean) => {
      try {
        await toggleSave(targetPostId);
      } catch (err) {
        console.warn('Error saving related post:', err);
      }
    },
    [toggleSave]
  );

  // ─── Carousel Scroll Handler ────────────────────────────────────────────────
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const index = Math.round(offsetX / windowWidth);
      if (index !== activeImageIndex && index >= 0) {
        setActiveImageIndex(index);
      }
    },
    [activeImageIndex, windowWidth]
  );

  // ─── Save / Bookmark Toggle Handler ─────────────────────────────────────────
  const handleToggleSave = useCallback(async () => {
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // 60FPS Reanimated spring bounce
    saveScale.value = withSpring(1.35, { damping: 9, stiffness: 250 }, () => {
      saveScale.value = withSpring(1, { damping: 12, stiffness: 220 });
    });

    const willSave = !isOptimisticallySaved;
    setIsOptimisticallySaved(willSave);
    setSavesCount((prev: number) => (willSave ? prev + 1 : Math.max(0, prev - 1)));
    setToastMessage(willSave ? 'Saved to your board' : 'Removed from saved');

    try {
      await toggleSave(postId);
    } catch {
      // Revert state if backend failed
      setIsOptimisticallySaved(!willSave);
      setSavesCount((prev: number) => (willSave ? Math.max(0, prev - 1) : prev + 1));
      setToastMessage('Could not update save. Please check your connection.');
    }
  }, [isOptimisticallySaved, postId, saveScale, toggleSave]);


  // ─── Follow Toggle Handler ──────────────────────────────────────────────────
  const handleToggleFollow = useCallback(async () => {
    if (!authorId) return;
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const willFollow = !isFollowingUser(authorId);
    await toggleFollowUser(authorId);
    setToastMessage(
      willFollow
        ? `Following @${post?.author.username || 'creator'}`
        : `Unfollowed @${post?.author.username || 'creator'}`
    );
  }, [authorId, isFollowingUser, post?.author.username, toggleFollowUser]);


  // ─── Comment Submit Handler (Optimistic UI + Profile Sync) ─────────────────
  const handleSendComment = useCallback(async () => {
    const trimmed = commentText.trim();
    if (!trimmed) return;

    safeHaptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const optimisticComment: ApiComment = {
      id: tempId,
      content: trimmed,
      postId,
      authorId: currentUser.id,
      createdAt: new Date().toISOString(),
      author: {
        id: currentUser.id,
        username: currentUser.username,
        avatar: currentUser.avatar ?? null,
      },
    };

    // 1. Instantly append to local list
    setComments((prev) => [...prev, optimisticComment]);
    // 2. Clear input field immediately
    setCommentText('');
    // 3. Dismiss keyboard
    Keyboard.dismiss();

    // 4. Submit to backend in background with authenticated user id
    try {
      const res = await createCommentApi(postId, trimmed, currentUser.id);
      if (res.success && res.data) {
        // Replace optimistic placeholder with real persisted comment from server
        setComments((prev) =>
          prev.map((item) => (item.id === tempId ? res.data : item))
        );
      }
    } catch (error) {
      console.error('Failed to post comment to backend:', error);
      // Rollback optimistic comment on network failure
      setComments((prev) => prev.filter((item) => item.id !== tempId));
      setToastMessage('Could not post comment. Please try again.');
    }
  }, [commentText, currentUser, postId]);

  // ─── Comment Reply Handler (Auto-focuses TextInput with @username prefix) ──
  const handleReplyToComment = useCallback((authorUsername: string) => {
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const prefix = `@${authorUsername} `;
    setCommentText((prev) => {
      if (prev.startsWith(prefix)) return prev;
      return `${prefix}${prev.replace(/^@\w+\s*/, '')}`;
    });
    setTimeout(() => {
      commentInputRef.current?.focus();
    }, 60);
  }, []);

  // ─── Comment Like Toggle Handler (Reanimated Bounce + Backend Sync) ─────────
  const handleToggleCommentLike = useCallback(async (commentId: string) => {
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLikedCommentIds((prev) => {
      const next = new Set(prev);
      if (next.has(commentId)) {
        next.delete(commentId);
      } else {
        next.add(commentId);
      }
      return next;
    });

    try {
      await toggleCommentLikeApi(commentId);
    } catch (err) {
      console.warn('Backend comment like sync failed:', err);
    }
  }, []);

  // ─── Native OS Share Sheet Handler ──────────────────────────────────────────
  const handleShare = useCallback(async () => {
    if (!post) return;
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const postUrl = `https://sift.app/post/${post.id}`;
    try {
      await Share.share({
        message: `Check out this review for "${post.title}" on Sift! ${postUrl}`,
        url: postUrl,
      });
    } catch (error: any) {
      console.warn('Native share error:', error?.message);
    }
  }, [post]);

  // ─── Advanced Reaction Engine (Instagram/iMessage Style) ───────────────────
  // Single Tap: Toggle default Like (❤️) with scale bounce
  const handleReactSingleTap = useCallback(() => {
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    reactScale.value = withSpring(1.35, { damping: 9, stiffness: 260 }, () => {
      reactScale.value = withSpring(1, { damping: 12, stiffness: 220 });
    });

    if (showReactionMenu) {
      reactionMenuProgress.value = withTiming(0, { duration: 120 });
      setShowReactionMenu(false);
    }

    if (activeReaction) {
      setActiveReaction(null);
      setToastMessage('Reaction removed');
    } else {
      setActiveReaction('❤️');
      setToastMessage('Liked ❤️');
    }
  }, [activeReaction, reactScale, reactionMenuProgress, showReactionMenu]);

  // Long Press: Spring open floating reaction menu
  const handleReactLongPress = useCallback(() => {
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowReactionMenu(true);
    reactionMenuProgress.value = withSpring(1, { damping: 14, stiffness: 240 });
  }, [reactionMenuProgress]);

  // Select an emoji from floating menu
  const handleSelectReaction = useCallback(
    (emoji: string) => {
      safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      reactScale.value = withSpring(1.3, { damping: 9, stiffness: 260 }, () => {
        reactScale.value = withSpring(1, { damping: 12, stiffness: 220 });
      });

      const isRemoving = activeReaction === emoji;
      setActiveReaction(isRemoving ? null : emoji);
      setToastMessage(isRemoving ? 'Reaction removed' : `Reacted with ${emoji}`);

      reactionMenuProgress.value = withTiming(0, { duration: 120 }, (finished) => {
        if (finished) {
          runOnJS(setShowReactionMenu)(false);
        }
      });
    },
    [activeReaction, reactScale, reactionMenuProgress]
  );

  const handleDismissReactionMenu = useCallback(() => {
    if (showReactionMenu) {
      reactionMenuProgress.value = withTiming(0, { duration: 120 }, (finished) => {
        if (finished) {
          runOnJS(setShowReactionMenu)(false);
        }
      });
    }
  }, [reactionMenuProgress, showReactionMenu]);

  // ─── Loading Screen ─────────────────────────────────────────────────────────
  if (isLoading && !post) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: '#FFFFFF' }]}>
        <ActivityIndicator size="large" color="#111827" />
        <Text style={styles.loadingText}>Loading post…</Text>
      </View>
    );
  }

  // ─── Graceful Fallback if post cannot be resolved ──────────────────────────
  if (!post) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: '#FFFFFF', paddingHorizontal: 24 }]}>
        <Ionicons name="alert-circle-outline" size={48} color="#9CA3AF" />
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginTop: 16 }}>
          Post Not Available
        </Text>
        <Text style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', marginTop: 8 }}>
          This visual curation may have been moved or removed.
        </Text>
        <Pressable
          onPress={() => navigation.goBack()}
          style={{
            marginTop: 20,
            paddingHorizontal: 24,
            paddingVertical: 12,
            backgroundColor: '#111827',
            borderRadius: 24,
          }}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Back to Feed</Text>
        </Pressable>
      </View>
    );
  }

  const images = post?.images ?? [];

  // Find matching mock post if present for rich media & source tags
  const matchedMock = MOCK_POSTS.find((p) => p.id === postId);
  const mediaItems: (string | MediaItem)[] =
    matchedMock?.media ?? (post?.images && post.images.length > 0 ? post.images : (images.length > 0 ? images : ['https://picsum.photos/seed/sift/800/1000']));
  const postSourceTags = (post as any)?.sourceTags;
  const sourceTags: SourceTag[] =
    Array.isArray(postSourceTags) && postSourceTags.length > 0
      ? postSourceTags
      : matchedMock?.sourceTags ?? [

      {
        id: 'st-default-1',
        title: 'Minimalist Teak Wood Lounge Chair',
        brand: 'Muuto Design',
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
        id: 'st-default-2',
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
        x: 70,
        y: 28,
      },
    ];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <View style={styles.container} className="bg-white">
        {/* Main Scrollable Content */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={{ paddingBottom: 110 }}
          showsVerticalScrollIndicator={false}
          bounces={true}
        >
          {/* ─── Swipeable Horizontal Carousel + Interactive Tap to Source Overlay ──── */}
          <View style={[styles.carouselContainer, { height: carouselHeight }]}>
            <PostCarousel
              media={mediaItems}
              width={windowWidth}
              height={carouselHeight}
              borderRadius={0}
              showPagination={true}
              indicatorType="both"
            >
              {/* Tap to Source Interactive Shopping Tags Overlay */}
              <SourceTagsOverlay
                tags={sourceTags}
                width={windowWidth}
                height={carouselHeight}
              />
            </PostCarousel>

            {/* Floating Top Navigation Header */}
            <View
              style={[
                styles.floatingHeader,
                { top: Math.max(insets.top, 12) },
              ]}
            >
              <Pressable
                onPress={() => navigation.goBack()}
                hitSlop={10}
                style={styles.floatingButton}
                accessibilityRole="button"
                accessibilityLabel="Go back"
              >
                <Ionicons name="chevron-back" size={22} color="#111827" />
              </Pressable>

              <View style={styles.headerRightActions}>
                <Pressable
                  onPress={handleShare}
                  hitSlop={10}
                  style={styles.floatingButton}
                  accessibilityRole="button"
                  accessibilityLabel="Share post"
                >
                  <Ionicons name="share-outline" size={20} color="#111827" />
                </Pressable>
              </View>
            </View>
          </View>

          {/* ─── Post Details Content Body ───────────────────────────────────── */}
          <View style={styles.contentBody} className="px-5 pt-5 bg-white">
            {/* Creator Information Row */}
            <View style={styles.creatorRow} className="flex-row items-center justify-between pb-4">
              <Pressable
                onPress={() => {
                  safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  navigation.navigate('PublicCreatorProfile', {
                    creatorId: post?.author.id || '',
                    username: post?.author.username || 'creator',
                    avatarUrl: post?.author.avatar,
                    followersCount: 1240,
                  });
                }}
                className="flex-row items-center flex-1 pr-3"
                accessibilityRole="button"
                accessibilityLabel="View creator profile"
              >
                <Image
                  source={
                    post?.author.avatar ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(
                      post?.author.username ?? 'C'
                    )}&background=111827&color=fff`
                  }
                  style={styles.creatorAvatar}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
                <View className="ml-3 flex-1">
                  <View className="flex-row items-center">
                    <Text
                      numberOfLines={1}
                      className="text-base font-bold text-neutral-900 tracking-tight"
                    >
                      {post?.author.username}
                    </Text>
                    <Ionicons
                      name="checkmark-circle"
                      size={15}
                      color="#2563EB"
                      style={{ marginLeft: 4 }}
                    />
                  </View>
                  <Text className="text-xs text-neutral-400 mt-0.5 font-medium">
                    1.2k followers
                  </Text>
                </View>
              </Pressable>

              {/* Follow Button */}
              <Pressable
                onPress={handleToggleFollow}
                style={[
                  styles.followButton,
                  isFollowing ? styles.followingButton : styles.notFollowingButton,
                ]}
                accessibilityRole="button"
              >
                <Text
                  style={[
                    styles.followButtonText,
                    isFollowing
                      ? styles.followingButtonText
                      : styles.notFollowingButtonText,
                  ]}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </Text>
              </Pressable>
            </View>

            {/* Post Title */}
            <Text
              style={styles.postTitle}
              className="text-2xl font-black text-neutral-900 leading-[32px] tracking-tight mt-1 mb-3"
            >
              {post?.title}
            </Text>

            {/* Tags Pills */}
            {post?.tags && post.tags.length > 0 && (
              <View style={styles.tagsContainer} className="flex-row flex-wrap gap-2 mb-5">
                {post.tags.map((tag, idx) => (
                  <View key={`tag-${idx}`} style={styles.tagPill}>
                    <Text style={styles.tagPillText}>#{tag}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Long-Form Rich Text Content */}
            <View style={styles.richTextContainer} className="mt-1">
              <Text style={styles.richTextContent}>
                {post?.content ||
                  'No description provided for this collection piece.'}
              </Text>
            </View>

            {/* ─── Comments Section ────────────────────────────────────────── */}
            <View style={styles.commentsSection}>
              <View style={styles.commentsHeaderRow}>
                <Text style={styles.commentsSectionTitle}>Comments</Text>
                <View style={styles.commentsCountPill}>
                  <Text style={styles.commentsCountText}>{comments.length}</Text>
                </View>
              </View>

              {isLoadingComments ? (
                <View style={styles.commentsLoadingBox}>
                  <ActivityIndicator size="small" color="#111827" />
                  <Text style={styles.commentsLoadingText}>Loading comments…</Text>
                </View>
              ) : comments.length === 0 ? (
                <View style={styles.emptyCommentsBox}>
                  <Ionicons name="chatbubbles-outline" size={28} color="#D1D5DB" />
                  <Text style={styles.emptyCommentsTitle}>No comments yet</Text>
                  <Text style={styles.emptyCommentsSubtitle}>
                    Be the first to share your thoughts on this curation!
                  </Text>
                </View>
              ) : (
                <View style={styles.commentsList}>
                  {comments.map((comment) => {
                    const isLiked = likedCommentIds.has(comment.id);
                    return (
                      <View key={comment.id} style={styles.commentItem}>
                        <Image
                          source={
                            comment.author?.avatar ||
                            `https://ui-avatars.com/api/?name=${encodeURIComponent(
                              comment.author?.username || 'User'
                            )}&background=111827&color=fff`
                          }
                          style={styles.commentAvatar}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                        />
                        <View style={styles.commentContentBox}>
                          <View style={styles.commentMetaRow}>
                            <Text style={styles.commentAuthorName} numberOfLines={1}>
                              {comment.author?.username || 'Curator'}
                            </Text>
                            <Text style={styles.commentDateText}>
                              {formatCommentTime(comment.createdAt)}
                            </Text>
                          </View>
                          <Text style={styles.commentBodyText}>
                            {comment.content}
                          </Text>

                          {/* Reply Button Beneath Comment */}
                          <View style={styles.commentActionRow}>
                            <Pressable
                              onPress={() =>
                                handleReplyToComment(comment.author?.username || 'Curator')
                              }
                              hitSlop={8}
                              style={styles.replyButton}
                              accessibilityRole="button"
                              accessibilityLabel={`Reply to ${comment.author?.username || 'user'}`}
                            >
                              <Ionicons
                                name="arrow-undo-outline"
                                size={12}
                                color="#6B7280"
                                style={{ marginRight: 4 }}
                              />
                              <Text style={styles.replyButtonText}>Reply</Text>
                            </Pressable>
                          </View>
                        </View>

                        {/* Comment Like Heart Action with Reanimated Scale Bounce */}
                        <CommentHeartButton
                          isLiked={isLiked}
                          onToggle={() => handleToggleCommentLike(comment.id)}
                        />
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            {/* ─── Infinite Rabbit Hole: More Like This Section ──────────────── */}
            <View style={styles.relatedSection}>
              {/* Subtle Elegant Divider */}
              <View style={styles.relatedDivider} />

              <View style={styles.relatedHeader}>
                <View style={styles.relatedHeaderLeft}>
                  <Text style={styles.relatedTitle}>More like this ✨</Text>
                  <Text style={styles.relatedSubtitle}>
                    Spaces & objects with similar aesthetic energy
                  </Text>
                </View>
                {relatedPosts.length > 0 && (
                  <View style={styles.relatedCountPill}>
                    <Text style={styles.relatedCountText}>{relatedPosts.length} drops</Text>
                  </View>
                )}
              </View>

              {isLoadingRelated ? (
                <View style={styles.relatedLoadingBox}>
                  <ActivityIndicator size="small" color="#111827" />
                  <Text style={styles.relatedLoadingText}>Uncovering similar drops…</Text>
                </View>
              ) : relatedPosts.length === 0 ? (
                <View style={styles.relatedEmptyBox}>
                  <Ionicons name="sparkles-outline" size={24} color="#D1D5DB" />
                  <Text style={styles.relatedEmptyText}>No similar curations found yet.</Text>
                </View>
              ) : (
                <View style={styles.masonryContainer}>
                  {/* Left Column */}
                  <View style={[styles.masonryColumn, { width: masonryCardWidth, marginRight: masonryGap }]}>
                    {relatedPosts
                      .filter((_, idx) => idx % 2 === 0)
                      .map((item) => (
                        <View key={item.id} style={styles.masonryCardWrapper}>
                          <PostCard
                            post={item}
                            cardWidth={masonryCardWidth}
                            isSaved={isPostSaved(item.id)}
                            onPress={() => handleRelatedPostPress(item)}
                            onToggleSave={handleToggleRelatedSave}
                          />
                        </View>
                      ))}
                  </View>

                  {/* Right Column */}
                  <View style={[styles.masonryColumn, { width: masonryCardWidth }]}>
                    {relatedPosts
                      .filter((_, idx) => idx % 2 !== 0)
                      .map((item) => (
                        <View key={item.id} style={styles.masonryCardWrapper}>
                          <PostCard
                            post={item}
                            cardWidth={masonryCardWidth}
                            isSaved={isPostSaved(item.id)}
                            onPress={() => handleRelatedPostPress(item)}
                            onToggleSave={handleToggleRelatedSave}
                          />
                        </View>
                      ))}
                  </View>
                </View>
              )}
            </View>
          </View>
        </ScrollView>

        {/* ─── Tap-Out Backdrop to dismiss Reaction Menu ─────────────────────── */}
        {showReactionMenu && (
          <TouchableWithoutFeedback onPress={handleDismissReactionMenu}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
        )}

        {/* ─── Floating Emoji Reaction Menu (Instagram/iMessage Style) ──────── */}
        {showReactionMenu && (
          <Animated.View
            style={[
              styles.reactionPopup,
              { bottom: Math.max(insets.bottom, 12) + 62 },
              reactionMenuAnimatedStyle,
            ]}
          >
            {['❤️', '🔥', '👏', '💡'].map((emoji) => {
              const isSelected = activeReaction === emoji;
              return (
                <Pressable
                  key={emoji}
                  onPress={() => handleSelectReaction(emoji)}
                  style={({ pressed }) => [
                    styles.reactionEmojiItem,
                    isSelected && styles.reactionEmojiItemSelected,
                    pressed && styles.reactionEmojiItemPressed,
                  ]}
                >
                  <Text style={styles.reactionEmojiText}>{emoji}</Text>
                </Pressable>
              );
            })}
          </Animated.View>
        )}

        {/* ─── Streamlined Minimalist Sticky Bottom Bar ───────────────────────── */}
        <View
          style={[
            styles.stickyBottomBar,
            { paddingBottom: Math.max(insets.bottom, 12) },
          ]}
        >
          {/* Comment Input Field */}
          <View style={styles.commentInputContainer}>
            <Ionicons
              name="chatbubble-outline"
              size={18}
              color="#9CA3AF"
              style={{ marginRight: 8 }}
            />
            <TextInput
              ref={commentInputRef}
              style={styles.commentInput}
              value={commentText}
              onChangeText={setCommentText}
              placeholder="Add a comment..."
              placeholderTextColor="#9CA3AF"
              returnKeyType="send"
              onSubmitEditing={handleSendComment}
            />
            {commentText.trim().length > 0 && (
              <Pressable
                onPress={handleSendComment}
                hitSlop={8}
                style={styles.sendButton}
              >
                <Ionicons name="arrow-up-circle" size={24} color="#111827" />
              </Pressable>
            )}
          </View>

          {/* Clean Icon-Only React Button (Single Tap: Like ❤️ / Long Press: Emoji Menu) */}
          <Pressable
            onPress={handleReactSingleTap}
            onLongPress={handleReactLongPress}
            delayLongPress={260}
            hitSlop={6}
            style={({ pressed }) => [
              styles.iconCircleBtn,
              activeReaction && styles.reactBtnActive,
              pressed && styles.buttonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="React to post"
          >
            <Animated.View style={reactAnimatedStyle}>
              {activeReaction === '❤️' ? (
                <Ionicons name="heart" size={22} color="#E11D48" />
              ) : activeReaction ? (
                <Text style={styles.reactionActiveEmoji}>{activeReaction}</Text>
              ) : (
                <Ionicons name="heart-outline" size={22} color="#111827" />
              )}
            </Animated.View>
          </Pressable>

          {/* Clean Icon-Only Save / Bookmark Button */}
          <Pressable
            onPress={handleToggleSave}
            hitSlop={6}
            style={({ pressed }) => [
              styles.iconCircleBtn,
              isOptimisticallySaved ? styles.saveBtnActive : styles.saveBtnInactive,
              pressed && styles.buttonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={isOptimisticallySaved ? 'Unsave post' : 'Save post'}
          >
            <Animated.View style={saveAnimatedStyle}>
              <Ionicons
                name={isOptimisticallySaved ? 'bookmark' : 'bookmark-outline'}
                size={20}
                color={isOptimisticallySaved ? '#FFFFFF' : '#111827'}
              />
            </Animated.View>
          </Pressable>

        </View>

        {/* Feedback Toast */}
        <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  carouselContainer: {
    width: '100%',
    position: 'relative',
    backgroundColor: '#F3F4F6',
  },
  floatingHeader: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  floatingButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  paginationPill: {
    position: 'absolute',
    bottom: 14,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  paginationText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  contentBody: {
    backgroundColor: '#FFFFFF',
  },
  creatorRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  creatorAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  followButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFollowingButton: {
    backgroundColor: '#111827',
  },
  followingButton: {
    backgroundColor: '#F3F4F6',
  },
  followButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  notFollowingButtonText: {
    color: '#FFFFFF',
  },
  followingButtonText: {
    color: '#111827',
  },
  postTitle: {
    color: '#111827',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tagPill: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  tagPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
  richTextContainer: {
    paddingTop: 4,
  },
  richTextContent: {
    fontSize: 15,
    lineHeight: 25,
    color: '#374151',
    fontWeight: '400',
  },
  commentsSection: {
    marginTop: 28,
    paddingTop: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#F3F4F6',
  },
  commentsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  commentsSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.3,
  },
  commentsCountPill: {
    marginLeft: 8,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  commentsCountText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
  commentsLoadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  commentsLoadingText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  emptyCommentsBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  emptyCommentsTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    marginTop: 8,
  },
  emptyCommentsSubtitle: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 18,
  },
  commentsList: {
    marginTop: 4,
  },
  commentItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  commentContentBox: {
    flex: 1,
    marginLeft: 12,
    backgroundColor: '#FAFAFA',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  commentMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  commentAuthorName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    marginRight: 8,
  },
  commentDateText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  commentBodyText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#374151',
    fontWeight: '400',
  },
  commentActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  replyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  replyButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
  },
  commentLikeButton: {
    paddingLeft: 10,
    paddingRight: 4,
    paddingTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickyBottomBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 8,
  },
  commentInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
    marginRight: 10,
  },
  commentInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    paddingVertical: Platform.OS === 'ios' ? 2 : 0,
  },
  sendButton: {
    marginLeft: 6,
  },
  iconCircleBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  reactBtnActive: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECDD3',
  },
  saveBtnActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  saveBtnInactive: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  reactionActiveEmoji: {
    fontSize: 19,
  },
  reactionPopup: {
    position: 'absolute',
    right: 48,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 14,
    zIndex: 99,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  reactionEmojiItem: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionEmojiItemSelected: {
    backgroundColor: '#FEE2E2',
    transform: [{ scale: 1.15 }],
  },
  reactionEmojiItemPressed: {
    transform: [{ scale: 1.25 }],
  },
  reactionEmojiText: {
    fontSize: 22,
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.94 }],
  },
  // ─── Infinite Rabbit Hole Styles ───────────────────────────────────────────
  relatedSection: {
    marginTop: 28,
    marginBottom: 40,
  },
  relatedDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginBottom: 24,
  },
  relatedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  relatedHeaderLeft: {
    flex: 1,
    paddingRight: 10,
  },
  relatedTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#111827',
    letterSpacing: -0.5,
  },
  relatedSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
    fontWeight: '400',
  },
  relatedCountPill: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  relatedCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  relatedLoadingBox: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  relatedLoadingText: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 8,
  },
  relatedEmptyBox: {
    paddingVertical: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  relatedEmptyText: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 6,
  },
  masonryContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  masonryColumn: {
    flexDirection: 'column',
  },
  masonryCardWrapper: {
    marginBottom: 14,
  },
});

