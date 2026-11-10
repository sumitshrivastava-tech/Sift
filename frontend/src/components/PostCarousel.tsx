import React, { useState, useRef, useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import Animated, {
  SharedValue,
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  runOnJS,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { safeHaptics, Haptics } from '../utils/haptics';
import { MediaItem } from '../types/post';

export interface PostCarouselProps {
  media: (string | MediaItem)[];
  width: number;
  height?: number;
  aspectRatio?: number;
  showPagination?: boolean;
  indicatorType?: 'dots' | 'counter' | 'both';
  onMediaPress?: (index: number) => void;
  onDoubleTap?: (index: number) => void;
  autoplayVideo?: boolean;
  loopVideo?: boolean;
  borderRadius?: number;
  contentFit?: 'cover' | 'contain';
  children?: React.ReactNode; // Optional overlay content (e.g. SourceTagsOverlay)
}

/**
 * Normalizes input items into standard MediaItem shape
 */
function normalizeMediaItem(item: string | MediaItem): MediaItem {
  if (typeof item === 'string') {
    const isVideo = /\.(mp4|mov|m3u8|webm)(\?.*)?$/i.test(item);
    return {
      url: item,
      type: isVideo ? 'video' : 'image',
    };
  }
  return {
    ...item,
    type: item.type ?? (/\.(mp4|mov|m3u8|webm)(\?.*)?$/i.test(item.url) ? 'video' : 'image'),
  };
}

/**
 * Single Video Slide Component using expo-video
 */
const VideoSlide: React.FC<{
  item: MediaItem;
  width: number;
  height: number;
  isActive: boolean;
  autoplay?: boolean;
  loop?: boolean;
  onPress?: () => void;
}> = memo(({ item, width, height, isActive, autoplay = true, loop = true, onPress }) => {
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(autoplay);

  const player = useVideoPlayer(item.url, (p) => {
    p.loop = loop;
    p.muted = isMuted;
    if (autoplay && isActive) {
      p.play();
    }
  });

  // Sync mute state
  const toggleMute = useCallback(() => {
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (player) {
      player.muted = nextMuted;
    }
  }, [isMuted, player]);

  // Sync play/pause state
  const togglePlay = useCallback(() => {
    safeHaptics.selectionAsync();
    if (player) {
      if (player.playing) {
        player.pause();
        setIsPlaying(false);
      } else {
        player.play();
        setIsPlaying(true);
      }
    }
    onPress?.();
  }, [player, onPress]);

  return (
    <View style={{ width, height, position: 'relative' }} className="bg-black justify-center items-center">
      <Pressable onPress={togglePlay} style={StyleSheet.absoluteFill}>
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls={false}
          startsPictureInPictureAutomatically={false}
        />
      </Pressable>

      {/* Play/Pause center overlay when paused */}
      {!isPlaying && (
        <Pressable
          onPress={togglePlay}
          style={styles.centerPlayButton}
          className="bg-black/60 rounded-full p-3.5 backdrop-blur-md"
        >
          <Ionicons name="play" size={28} color="#FFFFFF" style={{ marginLeft: 2 }} />
        </Pressable>
      )}

      {/* Video badge and Mute button overlay */}
      <View style={styles.videoControlsOverlay}>
        <View style={styles.videoBadge} className="flex-row items-center bg-black/60 px-2.5 py-1 rounded-full backdrop-blur-md">
          <Ionicons name="videocam" size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
          <Text style={styles.videoBadgeText}>VIDEO</Text>
        </View>

        <Pressable
          onPress={toggleMute}
          hitSlop={8}
          style={styles.muteButton}
          className="bg-black/60 rounded-full p-2 backdrop-blur-md"
          accessibilityRole="button"
          accessibilityLabel={isMuted ? 'Unmute video' : 'Mute video'}
        >
          <Ionicons
            name={isMuted ? 'volume-mute' : 'volume-high'}
            size={16}
            color="#FFFFFF"
          />
        </Pressable>
      </View>
    </View>
  );
});

/**
 * Animated Dot Indicator Component
 */
const AnimatedDot: React.FC<{
  index: number;
  scrollX: SharedValue<number>;
  width: number;
}> = memo(({ index, scrollX, width }) => {
  const animatedDotStyle = useAnimatedStyle(() => {
    const inputRange = [(index - 1) * width, index * width, (index + 1) * width];

    // Expand active dot width from 6px to 18px for modern iOS capsule aesthetic
    const dotWidth = interpolate(
      scrollX.value,
      inputRange,
      [6, 18, 6],
      Extrapolation.CLAMP
    );

    // Fade inactive dots
    const opacity = interpolate(
      scrollX.value,
      inputRange,
      [0.45, 1, 0.45],
      Extrapolation.CLAMP
    );

    return {
      width: dotWidth,
      opacity,
    };
  });

  return (
    <Animated.View
      style={[styles.dot, animatedDotStyle]}
      className="h-1.5 rounded-full bg-white mx-1"
    />
  );
});

/**
 * Reusable PostCarousel Component
 */
export const PostCarousel: React.FC<PostCarouselProps> = memo(
  ({
    media,
    width,
    height: explicitHeight,
    aspectRatio = 1.0,
    showPagination = true,
    indicatorType = 'both',
    onMediaPress,
    onDoubleTap,
    autoplayVideo = true,
    loopVideo = true,
    borderRadius = 20,
    contentFit = 'cover',
    children,
  }) => {
    const calculatedHeight = explicitHeight ?? Math.round(width / aspectRatio);
    const scrollX = useSharedValue(0);
    const [activeIndex, setActiveIndex] = useState(0);
    const lastTapRef = useRef<number>(0);

    const items = media.length > 0 ? media.map(normalizeMediaItem) : [];

    const handlePageChange = useCallback((newIdx: number) => {
      setActiveIndex(newIdx);
      safeHaptics.selectionAsync();
    }, []);

    const scrollHandler = useAnimatedScrollHandler({
      onScroll: (event) => {
        scrollX.value = event.contentOffset.x;
        const page = Math.round(event.contentOffset.x / width);
        runOnJS(handlePageChange)(page);
      },
    });

    const handlePress = useCallback(
      (idx: number) => {
        const now = Date.now();
        const DOUBLE_TAP_DELAY = 300;
        if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
          safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onDoubleTap?.(idx);
          lastTapRef.current = 0;
        } else {
          lastTapRef.current = now;
          onMediaPress?.(idx);
        }
      },
      [onDoubleTap, onMediaPress]
    );

    if (items.length === 0) {
      return (
        <View
          style={[styles.emptyContainer, { width, height: calculatedHeight, borderRadius }]}
          className="bg-gray-100 items-center justify-center"
        >
          <Ionicons name="images-outline" size={32} color="#9CA3AF" />
        </View>
      );
    }

    const hasMultiple = items.length > 1;

    return (
      <View
        style={[
          styles.container,
          { width, height: calculatedHeight, borderRadius },
        ]}
        className="overflow-hidden bg-gray-900 relative"
      >
        {/* Horizontal Paging ScrollView */}
        <Animated.ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={width}
          snapToAlignment="center"
          bounces={hasMultiple}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          style={StyleSheet.absoluteFill}
        >
          {items.map((item, index) => {
            const isVideo = item.type === 'video';

            return (
              <View
                key={`carousel-item-${index}-${item.url}`}
                style={{ width, height: calculatedHeight }}
                className="relative justify-center items-center"
              >
                {isVideo ? (
                  <VideoSlide
                    item={item}
                    width={width}
                    height={calculatedHeight}
                    isActive={activeIndex === index}
                    autoplay={autoplayVideo}
                    loop={loopVideo}
                    onPress={() => handlePress(index)}
                  />
                ) : (
                  <Pressable
                    onPress={() => handlePress(index)}
                    style={StyleSheet.absoluteFill}
                  >
                    <Image
                      source={item.url}
                      placeholder={item.posterUrl}
                      style={StyleSheet.absoluteFill}
                      contentFit={contentFit}
                      transition={200}
                      cachePolicy="memory-disk"
                      priority={index === 0 ? 'high' : 'normal'}
                    />
                  </Pressable>
                )}
              </View>
            );
          })}
        </Animated.ScrollView>

        {/* Optional children overlays (e.g. SourceTagsOverlay or Scrim) */}
        {children}

        {/* Modern iOS Top-Right / Corner Counter Pill (e.g. 1/3) */}
        {showPagination && hasMultiple && (indicatorType === 'counter' || indicatorType === 'both') && (
          <View
            style={styles.counterBadge}
            className="absolute top-3 right-3 bg-black/60 px-2.5 py-1 rounded-full backdrop-blur-md z-10"
          >
            <Text style={styles.counterText}>
              {activeIndex + 1}/{items.length}
            </Text>
          </View>
        )}

        {/* Dynamic Expanding iOS Dots Indicator at Bottom Center */}
        {showPagination && hasMultiple && (indicatorType === 'dots' || indicatorType === 'both') && (
          <View
            style={styles.dotsContainer}
            className="absolute bottom-3 left-0 right-0 flex-row justify-center items-center z-10"
            pointerEvents="none"
          >
            <View style={styles.dotsPill} className="flex-row items-center bg-black/40 px-2.5 py-1.5 rounded-full backdrop-blur-sm">
              {items.map((_, i) => (
                <AnimatedDot
                  key={`dot-${i}`}
                  index={i}
                  scrollX={scrollX}
                  width={width}
                />
              ))}
            </View>
          </View>
        )}
      </View>
    );
  }
);

PostCarousel.displayName = 'PostCarousel';

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#111827',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterBadge: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  counterText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  dotsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotsPill: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  dot: {
    backgroundColor: '#FFFFFF',
  },
  centerPlayButton: {
    position: 'absolute',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
  },
  videoControlsOverlay: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 5,
  },
  videoBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  videoBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  muteButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
});
