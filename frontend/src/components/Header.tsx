import React, { memo, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, LayoutChangeEvent } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { safeHaptics, Haptics } from '../utils/haptics';
import { useTheme } from '../context/ThemeContext';

export type FeedViewType = 'FOLLOWING' | 'FOR_YOU';

export interface HeaderProps {
  onLogoPress?: () => void;
  activeFeedView?: FeedViewType;
  onFeedViewChange?: (view: FeedViewType) => void;
}

export const Header = memo<HeaderProps>(
  ({
    onLogoPress,
    activeFeedView = 'FOR_YOU',
    onFeedViewChange,
  }) => {
    const { colors } = useTheme();

    // ─── 60FPS UI-Thread Animated Underline ─────────────────────────────────────
    // indicatorX represents the center offset or target position for the underline
    const indicatorTranslateX = useSharedValue(0);
    const indicatorWidth = useSharedValue(24);

    // Track tab button centers for pixel-perfect dynamic sliding underline
    const tabPositions = React.useRef<{ [key in FeedViewType]?: { x: number; width: number } }>({});

    const updateIndicatorPosition = (view: FeedViewType) => {
      const pos = tabPositions.current[view];
      if (pos) {
        // Center the 24px underline indicator on the active tab text
        const targetX = pos.x + (pos.width - 24) / 2;
        indicatorTranslateX.value = withSpring(targetX, {
          damping: 20,
          stiffness: 240,
          mass: 0.8,
        });
      }
    };

    useEffect(() => {
      updateIndicatorPosition(activeFeedView);
    }, [activeFeedView]);

    const handleTabLayout = (view: FeedViewType, e: LayoutChangeEvent) => {
      const { x, width } = e.nativeEvent.layout;
      tabPositions.current[view] = { x, width };
      if (view === activeFeedView) {
        const targetX = x + (width - 24) / 2;
        indicatorTranslateX.value = targetX;
      }
    };

    const handleToggle = (view: FeedViewType) => {
      if (view === activeFeedView) {
        onLogoPress?.(); // Tap active tab to scroll to top
        return;
      }
      safeHaptics.selectionAsync();
      onFeedViewChange?.(view);
      updateIndicatorPosition(view);
    };

    const isFollowing = activeFeedView === 'FOLLOWING';
    const isForYou = activeFeedView === 'FOR_YOU';

    const animatedIndicatorStyle = useAnimatedStyle(() => ({
      transform: [{ translateX: indicatorTranslateX.value }],
      width: indicatorWidth.value,
    }));

    return (
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        {/* ─── Left: Brand Logo ("sift.") ────────────────────────────────────── */}
        <Pressable
          onPress={() => {
            safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onLogoPress?.();
          }}
          hitSlop={8}
          style={({ pressed }) => [
            styles.logoPressable,
            pressed && styles.logoPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Sift Home - Scroll to top"
        >
          <Text style={[styles.brandText, { color: colors.text }]}>
            sift<Text style={{ color: colors.accent }}>.</Text>
          </Text>
        </Pressable>

        {/* ─── Center: Custom Top Tabs ("Following" | "For You") ──────────────── */}
        <View style={styles.tabsWrapper}>
          <View style={styles.toggleContainer}>
            {/* 1. "Following" Tab */}
            <Pressable
              onPress={() => handleToggle('FOLLOWING')}
              onLayout={(e) => handleTabLayout('FOLLOWING', e)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 8 }}
              style={styles.toggleTab}
              accessibilityRole="tab"
              accessibilityState={{ selected: isFollowing }}
              accessibilityLabel="Following Feed"
            >
              <Text
                style={[
                  styles.toggleText,
                  {
                    color: isFollowing ? colors.activeTab : colors.inactiveTab,
                    fontWeight: isFollowing ? '800' : '500',
                  },
                ]}
              >
                Following
              </Text>
            </Pressable>

            {/* Spacer */}
            <View style={styles.tabSpacer} />

            {/* 2. "For You" Tab */}
            <Pressable
              onPress={() => handleToggle('FOR_YOU')}
              onLayout={(e) => handleTabLayout('FOR_YOU', e)}
              hitSlop={{ top: 12, bottom: 12, left: 8, right: 12 }}
              style={styles.toggleTab}
              accessibilityRole="tab"
              accessibilityState={{ selected: isForYou }}
              accessibilityLabel="For You Feed"
            >
              <Text
                style={[
                  styles.toggleText,
                  {
                    color: isForYou ? colors.activeTab : colors.inactiveTab,
                    fontWeight: isForYou ? '800' : '500',
                  },
                ]}
              >
                For You
              </Text>
            </Pressable>

            {/* ─── Reanimated Accent-Colored Underline ───────────────────────── */}
            <Animated.View
              style={[
                styles.activeIndicatorUnderline,
                { backgroundColor: colors.accent },
                animatedIndicatorStyle,
              ]}
            />
          </View>
        </View>

        {/* ─── Right: Balanced Spacer (Notification Bell moved to Bottom Tab) ─── */}
        <View style={styles.rightSpacer} />
      </View>
    );
  }
);

Header.displayName = 'Header';

const styles = StyleSheet.create({
  header: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    zIndex: 10,
  },
  logoPressable: {
    paddingVertical: 4,
    minWidth: 64,
  },
  logoPressed: {
    opacity: 0.7,
  },
  brandText: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -1.2,
  },
  tabsWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    height: 38,
  },
  toggleTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabSpacer: {
    width: 6,
  },
  toggleText: {
    fontSize: 16,
    letterSpacing: -0.3,
  },
  activeIndicatorUnderline: {
    position: 'absolute',
    bottom: 2,
    left: 0,
    height: 3,
    borderRadius: 2,
  },
  rightSpacer: {
    minWidth: 64, // Matches logo width to ensure center tabs remain perfectly aligned
  },
});
