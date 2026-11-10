import React, { useState, useEffect, useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  Linking,
  Dimensions,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  runOnJS,
  interpolate,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { safeHaptics, Haptics } from '../utils/haptics';
import { SourceTag } from '../types/post';

export interface SourceTagsOverlayProps {
  tags?: SourceTag[];
  width: number;
  height: number;
  initiallyVisible?: boolean;
  onTagPress?: (tag: SourceTag) => void;
  onBuyPress?: (tag: SourceTag) => void;
}

/**
 * Formats a number to Indian Rupee representation (e.g. 24999 -> ₹24,999)
 */
export function formatRupees(amount: number): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `₹${amount.toLocaleString('en-IN')}`;
  }
}

/**
 * Individual Animated Pulsing Hotspot Component
 */
const PulsingHotspot: React.FC<{
  tag: SourceTag;
  isVisible: boolean;
  onPress: (tag: SourceTag) => void;
}> = memo(({ tag, isVisible, onPress }) => {
  // Reanimated shared values
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.8);

  useEffect(() => {
    if (isVisible) {
      // Spring entrance
      scale.value = withSpring(1, { damping: 14, stiffness: 220 });
      opacity.value = withTiming(1, { duration: 180 });

      // Continuous pulse ripple
      pulseScale.value = withRepeat(
        withTiming(2.2, { duration: 1600 }),
        -1,
        false
      );
      pulseOpacity.value = withRepeat(
        withTiming(0, { duration: 1600 }),
        -1,
        false
      );
    } else {
      scale.value = withTiming(0, { duration: 150 });
      opacity.value = withTiming(0, { duration: 150 });
      pulseScale.value = 1;
      pulseOpacity.value = 0;
    }
  }, [isVisible, scale, opacity, pulseScale, pulseOpacity]);

  const hotspotAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const pulseRingAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const handlePress = useCallback(() => {
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress(tag);
  }, [onPress, tag]);

  return (
    <Animated.View
      style={[
        styles.hotspotPositioner,
        {
          left: `${tag.x}%`,
          top: `${tag.y}%`,
        },
        hotspotAnimatedStyle,
      ]}
      pointerEvents={isVisible ? 'auto' : 'none'}
    >
      <Pressable
        onPress={handlePress}
        hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
        style={styles.hotspotHitArea}
        accessibilityRole="button"
        accessibilityLabel={`View source: ${tag.title}`}
      >
        {/* Pulsing Ripple Wave */}
        <Animated.View style={[styles.pulseRing, pulseRingAnimatedStyle]} />

        {/* Outer Glow Disc */}
        <View style={styles.outerDisc}>
          {/* Inner Core Dot with Shopping Bag Icon */}
          <View style={styles.coreDisc}>
            <Ionicons name="pricetag" size={10} color="#111827" />
          </View>
        </View>

        {/* Mini Price Pill Label Next to Hotspot */}
        <View style={styles.miniTagPill} className="bg-black/75 px-2 py-0.5 rounded-full ml-1 backdrop-blur-md">
          <Text style={styles.miniTagText}>
            {formatRupees(tag.priceInRupees)}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
});

/**
 * Sleek Product Bottom Sheet Modal
 */
const ProductBottomSheet: React.FC<{
  tag: SourceTag | null;
  visible: boolean;
  onClose: () => void;
  onBuy?: (tag: SourceTag) => void;
}> = memo(({ tag, visible, onClose, onBuy }) => {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(400);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible && tag) {
      backdropOpacity.value = withTiming(1, { duration: 200 });
      translateY.value = withSpring(0, { damping: 20, stiffness: 240 });
    } else {
      backdropOpacity.value = withTiming(0, { duration: 150 });
      translateY.value = withTiming(400, { duration: 180 });
    }
  }, [visible, tag, translateY, backdropOpacity]);

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const handleClose = useCallback(() => {
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    backdropOpacity.value = withTiming(0, { duration: 150 });
    translateY.value = withTiming(400, { duration: 160 }, (finished) => {
      if (finished) {
        runOnJS(onClose)();
      }
    });
  }, [backdropOpacity, translateY, onClose]);

  const handleBuy = useCallback(async () => {
    if (!tag) return;
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    if (onBuy) {
      onBuy(tag);
      return;
    }

    if (tag.buyUrl) {
      try {
        const canOpen = await Linking.canOpenURL(tag.buyUrl);
        if (canOpen) {
          await Linking.openURL(tag.buyUrl);
        }
      } catch (err) {
        console.warn('Could not open buy URL:', err);
      }
    }
  }, [tag, onBuy]);

  if (!tag) return null;

  const discountPercent =
    tag.originalPriceInRupees && tag.originalPriceInRupees > tag.priceInRupees
      ? Math.round(
          ((tag.originalPriceInRupees - tag.priceInRupees) /
            tag.originalPriceInRupees) *
            100
        )
      : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.modalContainer}>
        {/* Semi-transparent Dimmed Backdrop */}
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose}>
          <Animated.View style={[styles.backdrop, backdropAnimatedStyle]} />
        </Pressable>

        {/* Slide-Up Bottom Sheet Card */}
        <Animated.View
          style={[
            styles.bottomSheet,
            { paddingBottom: Math.max(insets.bottom, 20) + 12 },
            sheetAnimatedStyle,
          ]}
          className="bg-white rounded-t-3xl shadow-2xl px-5 pt-3"
        >
          {/* iOS Style Drag Handle Indicator */}
          <View style={styles.dragHandleWrapper}>
            <View style={styles.dragHandle} className="w-10 h-1.5 bg-gray-300 rounded-full" />
          </View>

          {/* Top Bar: Category Pill & Close Button */}
          <View style={styles.sheetHeader} className="flex-row items-center justify-between mt-2 mb-3">
            <View style={styles.categoryPill} className="bg-gray-100 px-3 py-1 rounded-full flex-row items-center">
              <Ionicons name="sparkles" size={12} color="#4B5563" style={{ marginRight: 4 }} />
              <Text style={styles.categoryPillText}>
                {tag.category?.toUpperCase() || 'SOURCED ITEM'}
              </Text>
            </View>

            <Pressable
              onPress={handleClose}
              hitSlop={10}
              style={styles.closeButton}
              className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
              accessibilityRole="button"
              accessibilityLabel="Close product details"
            >
              <Ionicons name="close" size={18} color="#4B5563" />
            </Pressable>
          </View>

          {/* Product Info Row: Image + Main Details */}
          <View style={styles.productRow} className="flex-row items-start mb-4">
            {tag.imageUrl && (
              <View style={styles.productImageWrapper} className="w-24 h-24 rounded-2xl bg-gray-100 overflow-hidden mr-4 border border-gray-200">
                <Image
                  source={tag.imageUrl}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  transition={200}
                />
              </View>
            )}

            <View style={styles.productTextContainer} className="flex-1 justify-center">
              {tag.brand && (
                <Text style={styles.productBrand} className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  {tag.brand}
                </Text>
              )}

              <Text style={styles.productTitle} numberOfLines={2} className="text-base font-bold text-gray-900 leading-tight mb-2">
                {tag.title}
              </Text>

              {/* Price Row with Rupees and optional discount */}
              <View style={styles.priceRow} className="flex-row items-baseline gap-2">
                <Text style={styles.productPrice} className="text-xl font-extrabold text-gray-900">
                  {formatRupees(tag.priceInRupees)}
                </Text>

                {tag.originalPriceInRupees && (
                  <Text style={styles.originalPrice} className="text-sm font-medium text-gray-400 line-through">
                    {formatRupees(tag.originalPriceInRupees)}
                  </Text>
                )}

                {discountPercent && (
                  <View style={styles.discountBadge} className="bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    <Text style={styles.discountText} className="text-xs font-bold text-emerald-700">
                      {discountPercent}% OFF
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Extra Badges: Verified Merchant & Stock Info */}
          <View style={styles.featuresRow} className="flex-row items-center gap-4 py-2 border-t border-b border-gray-100 mb-4">
            <View style={styles.featureItem} className="flex-row items-center">
              <Ionicons name="checkmark-circle" size={15} color="#2563EB" style={{ marginRight: 4 }} />
              <Text style={styles.featureText} className="text-xs text-gray-600 font-medium">
                Verified Seller
              </Text>
            </View>

            <View style={styles.featureItem} className="flex-row items-center">
              <Ionicons
                name={tag.inStock !== false ? 'cube-outline' : 'alert-circle-outline'}
                size={14}
                color={tag.inStock !== false ? '#059669' : '#DC2626'}
                style={{ marginRight: 4 }}
              />
              <Text
                style={styles.featureText}
                className={`text-xs font-medium ${
                  tag.inStock !== false ? 'text-emerald-700' : 'text-rose-600'
                }`}
              >
                {tag.inStock !== false ? 'In Stock • Ships in 24h' : 'Out of Stock'}
              </Text>
            </View>

            {tag.rating && (
              <View style={styles.featureItem} className="flex-row items-center">
                <Ionicons name="star" size={13} color="#F59E0B" style={{ marginRight: 3 }} />
                <Text style={styles.featureText} className="text-xs text-gray-700 font-semibold">
                  {tag.rating}
                </Text>
              </View>
            )}
          </View>

          {/* Action Buttons: View/Buy Primary CTA */}
          <View style={styles.actionsContainer} className="gap-2.5">
            <Pressable
              onPress={handleBuy}
              style={({ pressed }) => [
                styles.buyButton,
                pressed && styles.buyButtonPressed,
              ]}
              className="bg-gray-900 py-3.5 px-6 rounded-2xl flex-row items-center justify-center shadow-md"
              accessibilityRole="button"
              accessibilityLabel={`Buy ${tag.title} for ${formatRupees(tag.priceInRupees)}`}
            >
              <Ionicons name="bag-check-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.buyButtonText} className="text-white font-bold text-base tracking-wide">
                View & Buy on {tag.brand || 'Store'}
              </Text>
              <Ionicons name="arrow-forward" size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />
            </Pressable>

            <Pressable
              onPress={handleClose}
              style={({ pressed }) => [
                styles.cancelButton,
                pressed && styles.cancelButtonPressed,
              ]}
              className="py-2.5 items-center justify-center rounded-xl"
            >
              <Text style={styles.cancelButtonText} className="text-gray-500 font-semibold text-sm">
                Done
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
});

/**
 * Main SourceTagsOverlay Component
 * Renders on top of any post image/carousel.
 * Tap anywhere on the container to toggle hotspot visibility.
 */
export const SourceTagsOverlay: React.FC<SourceTagsOverlayProps> = ({
  tags = [],
  width,
  height,
  initiallyVisible = false,
  onTagPress,
  onBuyPress,
}) => {
  const insets = useSafeAreaInsets();
  const [areTagsVisible, setAreTagsVisible] = useState(initiallyVisible);
  const [selectedTag, setSelectedTag] = useState<SourceTag | null>(null);
  const [showHint, setShowHint] = useState(true);

  // Auto-dismiss hint badge after 3 seconds
  useEffect(() => {
    if (tags.length > 0) {
      const timer = setTimeout(() => {
        setShowHint(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [tags]);

  const toggleTagsVisibility = useCallback(() => {
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAreTagsVisible((prev) => !prev);
    setShowHint(false);
  }, []);

  const handleSelectTag = useCallback(
    (tag: SourceTag) => {
      setSelectedTag(tag);
      onTagPress?.(tag);
    },
    [onTagPress]
  );

  const handleCloseSheet = useCallback(() => {
    setSelectedTag(null);
  }, []);

  if (!tags || tags.length === 0) {
    return null;
  }

  return (
    <>
      {/* Full-bleed interactive tap surface */}
      <Pressable
        onPress={toggleTagsVisibility}
        style={[styles.overlayContainer, { width, height }]}
        pointerEvents="box-none"
      >
        {/* Pulsing Hotspots */}
        {tags.map((tag) => (
          <PulsingHotspot
            key={`tag-${tag.id}`}
            tag={tag}
            isVisible={areTagsVisible}
            onPress={handleSelectTag}
          />
        ))}

        {/* Minimalist "Tap to Source" Floating Indicator Pill */}
        <Pressable
          onPress={toggleTagsVisibility}
          hitSlop={8}
          style={[styles.indicatorPill, areTagsVisible && styles.indicatorPillActive]}
          className="absolute bottom-3 left-3 bg-black/65 px-3 py-1.5 rounded-full flex-row items-center backdrop-blur-md z-10 shadow"
        >
          <Ionicons
            name={areTagsVisible ? 'pricetag' : 'pricetag-outline'}
            size={13}
            color="#FFFFFF"
            style={{ marginRight: 5 }}
          />
          <Text style={styles.indicatorText}>
            {areTagsVisible
              ? `Hide Sources (${tags.length})`
              : `Tap to Source (${tags.length})`}
          </Text>
        </Pressable>

        {/* Subtle Top Hint Badge for Discovery (Safe Area Offset) */}
        {showHint && !areTagsVisible && (
          <View
            style={[
              styles.hintBadge,
              { top: insets.top + 10 },
            ]}
            className="absolute left-3 bg-black/75 px-3 py-1.5 rounded-full flex-row items-center backdrop-blur-md"
            pointerEvents="none"
          >
            <Ionicons name="finger-print-outline" size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.hintText}>Tap image for tagged items</Text>
          </View>
        )}
      </Pressable>

      {/* Sourced Product Bottom Sheet */}
      <ProductBottomSheet
        tag={selectedTag}
        visible={!!selectedTag}
        onClose={handleCloseSheet}
        onBuy={onBuyPress}
      />
    </>
  );
};

const styles = StyleSheet.create({
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 10,
  },
  hotspotPositioner: {
    position: 'absolute',
    marginLeft: -16,
    marginTop: -16,
    zIndex: 15,
  },
  hotspotHitArea: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  pulseRing: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  outerDisc: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
    borderWidth: 1.5,
    borderColor: '#111827',
  },
  coreDisc: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniTagPill: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  miniTagText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  indicatorPill: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  indicatorPillActive: {
    backgroundColor: 'rgba(17, 24, 39, 0.88)',
  },
  indicatorText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  hintBadge: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  hintText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  bottomSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  dragHandleWrapper: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  dragHandle: {
    backgroundColor: '#D1D5DB',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryPill: {
    backgroundColor: '#F3F4F6',
  },
  categoryPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#4B5563',
    letterSpacing: 0.8,
  },
  closeButton: {
    backgroundColor: '#F3F4F6',
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  productImageWrapper: {
    backgroundColor: '#F3F4F6',
  },
  productTextContainer: {
    flex: 1,
  },
  productBrand: {
    letterSpacing: 0.6,
  },
  productTitle: {
    color: '#111827',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  productPrice: {
    color: '#111827',
    letterSpacing: -0.3,
  },
  originalPrice: {
    color: '#9CA3AF',
  },
  discountBadge: {
    backgroundColor: '#ECFDF5',
  },
  discountText: {
    color: '#047857',
  },
  featuresRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureText: {
    fontSize: 11,
  },
  actionsContainer: {},
  buyButton: {
    backgroundColor: '#111827',
  },
  buyButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
  buyButtonText: {
    letterSpacing: -0.2,
  },
  cancelButton: {},
  cancelButtonPressed: {
    opacity: 0.6,
  },
  cancelButtonText: {},
});
