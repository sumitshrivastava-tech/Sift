import React, { useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { useAuth } from '../context/AuthContext';
import { useTheme, ACCENT_COLOR } from '../context/ThemeContext';
import { safeHaptics, Haptics } from '../utils/haptics';

const { width } = Dimensions.get('window');

// Circular orbit radius around central logo
const ORBIT_RADIUS = 74;
// Coordinates of the red full-stop dot relative to the logo center
const DOT_TARGET_X = 52;
const DOT_TARGET_Y = 14;

export const SplashScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { isAuthenticated } = useAuth();
  const { colors } = useTheme();

  // ─── Reanimated v3 Shared Values (Pure UI Thread Execution) ─────────────────
  const logoScale = useSharedValue(0.85);
  const logoOpacity = useSharedValue(0);

  // Rotation and chain-like motion shared values
  const orbitAngle = useSharedValue(0); // 0 to 2*PI radians
  const mergeProgress = useSharedValue(0); // 0 (orbiting) -> 1 (merged into dot)
  const wordsScale = useSharedValue(1); // 1 -> 0.1
  const wordsOpacity = useSharedValue(1); // 1 -> 0

  // Red dot absorption pulse shared value
  const dotScale = useSharedValue(1); // 1 -> 1.35 -> 1.0

  // Container fade-out for smooth screen transition
  const containerOpacity = useSharedValue(1);

  // ─── Navigation Transition Callback ─────────────────────────────────────────
  const handleTransition = useCallback(() => {
    navigation.reset({
      index: 0,
      routes: [{ name: isAuthenticated ? 'MainTabs' : 'Auth' }],
    });
  }, [isAuthenticated, navigation]);

  // ─── Red Dot Absorption Pulse ───────────────────────────────────────────────
  const triggerDotPulse = useCallback(() => {
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    dotScale.value = withSequence(
      withSpring(1.38, { damping: 7, stiffness: 320 }),
      withSpring(1.0, { damping: 12, stiffness: 220 })
    );
  }, [dotScale]);

  // ─── 2-Second Coordinated Sequence ─────────────────────────────────────────
  useEffect(() => {
    // Phase 1 (0ms - 400ms): Logo fades in and springs up
    logoOpacity.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) });
    logoScale.value = withSpring(1, { damping: 15, stiffness: 180 });

    // Phase 2 (0ms - 1100ms): Words orbit logo in a circular chain motion
    orbitAngle.value = withTiming(Math.PI * 2, {
      duration: 1100,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });

    // Phase 3 (1100ms - 1550ms): Words shrink & converge directly into the red dot
    const mergeTimer = setTimeout(() => {
      mergeProgress.value = withTiming(1, {
        duration: 450,
        easing: Easing.in(Easing.cubic),
      });
      wordsScale.value = withTiming(0.12, {
        duration: 450,
        easing: Easing.in(Easing.quad),
      });
      wordsOpacity.value = withTiming(0, {
        duration: 450,
        easing: Easing.in(Easing.quad),
      });
    }, 1100);

    // Phase 4 (1550ms): Red dot absorbs words with spring pulse & haptic feedback
    const absorbTimer = setTimeout(() => {
      triggerDotPulse();
    }, 1550);

    // Phase 5 (1900ms - 2150ms): Clean exit transition under ~2 seconds
    const exitTimer = setTimeout(() => {
      containerOpacity.value = withTiming(
        0,
        { duration: 250, easing: Easing.in(Easing.quad) },
        (finished) => {
          if (finished) {
            runOnJS(handleTransition)();
          }
        }
      );
    }, 1900);

    return () => {
      clearTimeout(mergeTimer);
      clearTimeout(absorbTimer);
      clearTimeout(exitTimer);
    };
  }, [containerOpacity, handleTransition, logoOpacity, logoScale, mergeProgress, orbitAngle, triggerDotPulse, wordsOpacity, wordsScale]);

  // ─── UI Thread Animated Styles ──────────────────────────────────────────────
  const animatedLogoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const animatedDotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: dotScale.value }],
  }));

  // "Discover" orbiting & merging style (starts at -PI/2, top of circle)
  const animatedDiscoverStyle = useAnimatedStyle(() => {
    'worklet';
    const angle = orbitAngle.value - Math.PI / 2;
    const orbitX = ORBIT_RADIUS * Math.cos(angle);
    const orbitY = ORBIT_RADIUS * Math.sin(angle);

    const x = orbitX + (DOT_TARGET_X - orbitX) * mergeProgress.value;
    const y = orbitY + (DOT_TARGET_Y - orbitY) * mergeProgress.value;

    return {
      opacity: wordsOpacity.value,
      transform: [
        { translateX: x },
        { translateY: y },
        { scale: wordsScale.value },
      ],
    };
  });

  // "Better" orbiting & merging style (starts at +PI/2, bottom of circle)
  const animatedBetterStyle = useAnimatedStyle(() => {
    'worklet';
    const angle = orbitAngle.value + Math.PI / 2;
    const orbitX = ORBIT_RADIUS * Math.cos(angle);
    const orbitY = ORBIT_RADIUS * Math.sin(angle);

    const x = orbitX + (DOT_TARGET_X - orbitX) * mergeProgress.value;
    const y = orbitY + (DOT_TARGET_Y - orbitY) * mergeProgress.value;

    return {
      opacity: wordsOpacity.value,
      transform: [
        { translateX: x },
        { translateY: y },
        { scale: wordsScale.value },
      ],
    };
  });

  const animatedContainerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: colors.background },
        animatedContainerStyle,
      ]}
    >
      <View style={styles.stage}>
        {/* Central "sift." Logo with Independently Pulsing Red Dot */}
        <Animated.View style={[styles.logoContainer, animatedLogoStyle]}>
          <View style={styles.brandRow}>
            <Text style={[styles.brandText, { color: colors.text }]}>sift</Text>
            <Animated.View style={[styles.dotWrapper, animatedDotStyle]}>
              <Text style={[styles.brandText, { color: ACCENT_COLOR }]}>.</Text>
            </Animated.View>
          </View>
        </Animated.View>

        {/* Orbiting Word 1: "Discover" */}
        <Animated.View
          style={[styles.orbitingWordWrapper, animatedDiscoverStyle]}
          pointerEvents="none"
        >
          <View style={[styles.wordPill, { backgroundColor: colors.surfaceMuted }]}>
            <Text style={[styles.orbitWordText, { color: colors.text }]}>Discover</Text>
          </View>
        </Animated.View>

        {/* Orbiting Word 2: "Better" */}
        <Animated.View
          style={[styles.orbitingWordWrapper, animatedBetterStyle]}
          pointerEvents="none"
        >
          <View style={[styles.wordPill, { backgroundColor: colors.surfaceMuted }]}>
            <Text style={[styles.orbitWordText, { color: colors.text }]}>Better</Text>
          </View>
        </Animated.View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stage: {
    width: width * 0.85,
    height: 260,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  brandText: {
    fontSize: 54,
    fontWeight: '900',
    letterSpacing: -2.5,
  },
  dotWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbitingWordWrapper: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  wordPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  orbitWordText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
});

