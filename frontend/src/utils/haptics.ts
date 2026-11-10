import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Safe haptics utility that wraps all expo-haptics calls.
 * Ensures the app never throws or crashes if the native haptics module
 * is unavailable or encounters platform-level exceptions (especially on Android Expo Go).
 */
export const safeHaptics = {
  impactAsync: async (
    style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light
  ): Promise<void> => {
    if (Platform.OS === 'web') return;
    try {
      await Haptics.impactAsync(style);
    } catch {
      // Gracefully swallow missing native module errors
    }
  },

  notificationAsync: async (
    type: Haptics.NotificationFeedbackType = Haptics.NotificationFeedbackType.Success
  ): Promise<void> => {
    if (Platform.OS === 'web') return;
    try {
      await Haptics.notificationAsync(type);
    } catch {
      // Gracefully swallow missing native module errors
    }
  },

  selectionAsync: async (): Promise<void> => {
    if (Platform.OS === 'web') return;
    try {
      await Haptics.selectionAsync();
    } catch {
      // Gracefully swallow missing native module errors
    }
  },
};

export { Haptics };

