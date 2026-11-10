import React, { useEffect } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  Share,
  Linking,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Post } from '../types/post';
import { safeHaptics, Haptics } from '../utils/haptics';

interface PeekAndPopModalProps {
  post: Post | null;
  visible: boolean;
  onClose: () => void;
  onOpenDetail: (post: Post) => void;
  onToggleSave: (postId: string, willBeSaved: boolean) => void;
  isSaved: boolean;
}

const PREVIEW_WIDTH = 275;
const PREVIEW_HEIGHT = 350;

export const PeekAndPopModal: React.FC<PeekAndPopModalProps> = ({
  post,
  visible,
  onClose,
  onOpenDetail,
  onToggleSave,
  isSaved,
}) => {
  const scale = useSharedValue(0.88);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      scale.value = withSpring(1, { damping: 16, stiffness: 220 });
      opacity.value = withTiming(1, { duration: 150 });
    } else {
      scale.value = 0.88;
      opacity.value = 0;
    }
  }, [visible, opacity, scale]);

  const animatedContainerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const animatedBackdropStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (!post || !visible) return null;

  const handleDismiss = () => {
    opacity.value = withTiming(0, { duration: 100 }, (finished) => {
      if (finished) {
        runOnJS(onClose)();
      }
    });
  };

  const handleOpen = () => {
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    handleDismiss();
    onOpenDetail(post);
  };

  const handleSave = () => {
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onToggleSave(post.id, !isSaved);
    handleDismiss();
  };

  const handleWhatsAppShare = async () => {
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    handleDismiss();
    const postUrl = `https://sift.app/post/${post.id}`;
    const text = `Check out "${post.title}" on Sift! ${postUrl}`;
    const waUrl = `whatsapp://send?text=${encodeURIComponent(text)}`;
    try {
      const supported = await Linking.canOpenURL(waUrl);
      if (supported) {
        await Linking.openURL(waUrl);
      } else {
        await Share.share({ message: text, url: postUrl });
      }
    } catch {
      await Share.share({ message: text, url: postUrl }).catch(() => null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleDismiss}>
      <Pressable style={styles.backdropPressable} onPress={handleDismiss}>
        <Animated.View style={[styles.backdropBackground, animatedBackdropStyle]} />

        {/* iOS Context Menu Container */}
        <Animated.View style={[styles.contextMenuContainer, animatedContainerStyle]}>
          {/* Scaled-down rounded preview of post image ONLY */}
          <View style={styles.imageCard}>
            <Image
              source={post.imageUrl}
              style={styles.previewImage}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          </View>

          {/* Single horizontal row of large, premium icons only: [Open], [Save], [WhatsApp Share] */}
          <View style={styles.horizontalActionRow} className="flex-row justify-around items-center">
            {/* Open Post */}
            <Pressable
              style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
              onPress={handleOpen}
              accessibilityRole="button"
              accessibilityLabel="Open Post"
            >
              <Ionicons name="expand-outline" size={24} color="#111827" />
            </Pressable>

            {/* Save / Bookmark */}
            <Pressable
              style={({ pressed }) => [
                styles.actionButton,
                isSaved && styles.actionButtonActive,
                pressed && styles.actionButtonPressed,
              ]}
              onPress={handleSave}
              accessibilityRole="button"
              accessibilityLabel={isSaved ? 'Unsave Post' : 'Save Post'}
            >
              <Ionicons
                name={isSaved ? 'bookmark' : 'bookmark-outline'}
                size={24}
                color={isSaved ? '#111827' : '#111827'}
              />
            </Pressable>

            {/* WhatsApp Share */}
            <Pressable
              style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
              onPress={handleWhatsAppShare}
              accessibilityRole="button"
              accessibilityLabel="Share on WhatsApp"
            >
              <Ionicons name="logo-whatsapp" size={25} color="#25D366" />
            </Pressable>
          </View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdropPressable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  backdropBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  contextMenuContainer: {
    width: PREVIEW_WIDTH,
    alignItems: 'center',
  },
  imageCard: {
    width: PREVIEW_WIDTH,
    height: PREVIEW_HEIGHT,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#1E293B',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.38,
        shadowRadius: 28,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  horizontalActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: PREVIEW_WIDTH,
    marginTop: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingVertical: 10,
    paddingHorizontal: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.22,
        shadowRadius: 18,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  actionButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  actionButtonActive: {
    backgroundColor: '#F3F4F6',
    borderColor: '#D1D5DB',
  },
  actionButtonPressed: {
    transform: [{ scale: 0.92 }],
    backgroundColor: '#E5E7EB',
  },
});
