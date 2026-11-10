import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  useWindowDimensions,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { safeHaptics, Haptics } from '../utils/haptics';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { createPostApi } from '../api/api';
import { uploadPostImageToSupabase } from '../services/supabase';
import { RootStackParamList } from '../types/navigation';

export interface DroppedSourceTag {
  id: string;
  title: string;
  priceInRupees: number;
  buyUrl?: string;
  x: number; // percentage (0 - 100)
  y: number; // percentage (0 - 100)
  imageIndex: number;
}

const TAG_SUGGESTIONS = [
  '#Brutalism',
  '#DesiMinimalist',
  '#RawConcrete',
  '#Terracotta',
  '#TropicalModernism',
  '#CaneAndTeak',
  '#LightAndForm',
  '#Nordic',
];

type CreatePostRouteProp = RouteProp<RootStackParamList, 'CreatePost'>;

export const CreatePostScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const navigation = useNavigation<any>();
  const route = useRoute<CreatePostRouteProp>();
  const { currentUser } = useAuth();
  const { colors, isDark } = useTheme();

  // Route parameters passed when launched from central "+" button
  const initialUri = route.params?.imageUri || null;
  const initialBase64 = route.params?.imageBase64 || null;

  // ─── Local State ────────────────────────────────────────────────────────────
  const [imageUri, setImageUri] = useState<string | null>(initialUri);
  const [imageBase64, setImageBase64] = useState<string | null>(initialBase64);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishingStep, setPublishingStep] = useState<string>('Preparing image...');

  // Creator Source Tags
  const [sourceTags, setSourceTags] = useState<DroppedSourceTag[]>([]);
  const [isTagModalVisible, setIsTagModalVisible] = useState(false);
  const [tagProductName, setTagProductName] = useState('');
  const [tagProductPrice, setTagProductPrice] = useState('');
  const [tagProductLink, setTagProductLink] = useState('');

  // ─── 60FPS Reanimated Spinner for Publishing Overlay ────────────────────────
  const spinRotation = useSharedValue(0);
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    if (isPublishing) {
      spinRotation.value = withRepeat(
        withTiming(360, { duration: 900, easing: Easing.linear }),
        -1,
        false
      );
      pulseScale.value = withRepeat(
        withTiming(1.08, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    } else {
      spinRotation.value = 0;
      pulseScale.value = 1;
    }
  }, [isPublishing, spinRotation, pulseScale]);

  const animatedSpinnerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spinRotation.value}deg` }],
  }));

  const animatedPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  // Update image when route params change
  useEffect(() => {
    if (route.params?.imageUri) {
      setImageUri(route.params.imageUri);
      setImageBase64(route.params.imageBase64 || null);
    }
  }, [route.params?.imageUri, route.params?.imageBase64]);

  // ─── Launch Image Picker (Task 1: 4:5 Aspect Ratio & 0.7 Quality) ───────────
  const handlePickOrChangeImage = async () => {
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Photo Library Access Required',
          'Please allow photo library access to choose images for your drop.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 5],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        safeHaptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setImageUri(asset.uri);
        setImageBase64(asset.base64 || null);
      }
    } catch (err) {
      console.warn('Image picker error:', err);
      Alert.alert('Picker Notice', 'Could not open photo library. Please try again.');
    }
  };

  // ─── Tag Insertion Helper ───────────────────────────────────────────────────
  const handleAppendTag = (tag: string) => {
    safeHaptics.selectionAsync();
    setDescription((prev) => {
      if (prev.includes(tag)) return prev;
      const separator = prev.endsWith(' ') || prev.length === 0 ? '' : ' ';
      return `${prev}${separator}${tag} `;
    });
  };

  // ─── Save Source Tag ────────────────────────────────────────────────────────
  const handleSaveSourceTag = () => {
    if (!tagProductName.trim()) {
      Alert.alert('Product Name Required', 'Please enter a name for the tagged item.');
      return;
    }

    safeHaptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const price = parseFloat(tagProductPrice.replace(/[^0-9.]/g, '')) || 0;

    const newTag: DroppedSourceTag = {
      id: `tag-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      title: tagProductName.trim(),
      priceInRupees: price,
      buyUrl: tagProductLink.trim() || undefined,
      x: 50,
      y: 50,
      imageIndex: 0,
    };

    setSourceTags((prev) => [...prev, newTag]);
    setIsTagModalVisible(false);
    setTagProductName('');
    setTagProductPrice('');
    setTagProductLink('');
  };

  // ─── Publish Drop (Task 3: Supabase Storage + Database Integration) ─────────
  const handlePublish = async () => {
    if (!imageUri) {
      safeHaptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Image Required', 'Please select a photo before publishing your drop.');
      return;
    }

    if (!title.trim() && !description.trim()) {
      safeHaptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Title or Description Required', 'Please enter a title or description for your curation.');
      return;
    }

    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsPublishing(true);
    setPublishingStep('Uploading image to Supabase Storage...');

    try {
      // 1. Upload image to Supabase Storage bucket ('post-images')
      const publicImageUrl = await uploadPostImageToSupabase(imageUri, imageBase64);

      setPublishingStep('Saving curation drop...');

      // 2. Extract hashtags from description
      const fullText = `${title} ${description}`;
      const extractedTags = (fullText.match(/#[a-zA-Z0-9_]+/g) || []).map((t) =>
        t.slice(1).trim()
      );

      // 3. Post to Express backend: POST /api/posts
      await createPostApi({
        title: title.trim() || description.trim().slice(0, 50) || 'Architectural Drop',
        description: description.trim() || title.trim(),
        content: description.trim() || title.trim(),
        imageUrl: publicImageUrl,
        images: [publicImageUrl],
        tags: extractedTags,
        sourceTags,
        authorId: currentUser.id,
        userId: currentUser.id,
      });

      safeHaptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // 4. Close modal and navigate to Home feed (auto-refreshed via useFocusEffect)
      setIsPublishing(false);

      if (navigation.canGoBack()) {
        navigation.goBack();
      }
      navigation.navigate('MainTabs', { screen: 'Home' });
    } catch (error: any) {
      console.error('Failed to publish drop:', error);
      setIsPublishing(false);
      safeHaptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        'Could not publish drop. Please check your connection and try again.';
      Alert.alert('Publish Notice', errorMessage);
    }
  };

  // Preview dimensions (4:5 Aspect Ratio)
  const previewWidth = windowWidth - 32;
  const previewHeight = Math.round(previewWidth * 1.25);

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
      {/* ─── Header Navigation Bar ─────────────────────────────────────────── */}
      <View style={[styles.headerBar, { borderBottomColor: colors.border }]}>
        <Pressable
          onPress={() => {
            safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.navigate('MainTabs', { screen: 'Home' });
            }
          }}
          hitSlop={10}
          style={styles.closeBtn}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>

        <Text style={[styles.headerTitle, { color: colors.text }]}>New Drop</Text>

        <Pressable
          onPress={handlePublish}
          disabled={isPublishing}
          style={({ pressed }) => [
            styles.publishHeaderBtn,
            pressed && { opacity: 0.8 },
            isPublishing && { opacity: 0.6 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Publish drop"
        >
          <Text style={styles.publishHeaderBtnText}>Publish</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 24) + 20 },
          ]}
        >
          {/* ─── Task 2: Large Rounded Image Preview (4:5 Ratio) ──────────── */}
          <View style={styles.imagePreviewContainer}>
            {imageUri ? (
              <Pressable
                onPress={handlePickOrChangeImage}
                style={({ pressed }) => [
                  styles.imageWrapper,
                  { width: previewWidth, height: previewHeight },
                  pressed && { opacity: 0.95 },
                ]}
              >
                <Image
                  source={imageUri}
                  style={[styles.previewImage, { width: previewWidth, height: previewHeight }]}
                  contentFit="cover"
                  transition={200}
                />

                {/* Change photo pill overlay */}
                <View style={styles.changePhotoPill}>
                  <Ionicons name="camera-reverse-outline" size={14} color="#FFFFFF" />
                  <Text style={styles.changePhotoPillText}>Change Photo</Text>
                </View>

                {/* Aspect ratio badge */}
                <View style={styles.aspectBadge}>
                  <Text style={styles.aspectBadgeText}>4:5 Editorial</Text>
                </View>
              </Pressable>
            ) : (
              <Pressable
                onPress={handlePickOrChangeImage}
                style={[
                  styles.imagePlaceholder,
                  { width: previewWidth, height: previewHeight * 0.75, borderColor: colors.border },
                ]}
              >
                <View style={styles.placeholderIconCircle}>
                  <Ionicons name="image-outline" size={32} color="#FF5C5C" />
                </View>
                <Text style={[styles.placeholderTitle, { color: colors.text }]}>
                  Select Architectural Photo
                </Text>
                <Text style={styles.placeholderSubtitle}>
                  Forced 4:5 aspect ratio optimized for spatial aesthetics.
                </Text>
                <View style={styles.pickPhotoBtn}>
                  <Text style={styles.pickPhotoBtnText}>Open Camera Roll</Text>
                </View>
              </Pressable>
            )}
          </View>

          {/* ─── Task 2: Minimalist TextInput Fields ───────────────────────── */}
          <View style={styles.formSection}>
            {/* Field 1: Title (Bold, large font) */}
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Title (e.g., Monolithic stairs cut through volcanic stone)"
              placeholderTextColor="#9CA3AF"
              style={[styles.titleInput, { color: colors.text }]}
              maxLength={120}
              returnKeyType="next"
            />

            <View style={[styles.fieldDivider, { backgroundColor: colors.border }]} />

            {/* Field 2: Description / Notes (Multiline, smaller font) */}
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Add architectural notes, spatial materiality, or hashtags..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
              style={[styles.descriptionInput, { color: colors.text }]}
              textAlignVertical="top"
              maxLength={1500}
            />

            {/* ─── Tag Suggestion Pills ─── */}
            <View style={styles.tagSuggestionsSection}>
              <Text style={styles.tagSectionLabel}>POPULAR TAGS</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagSuggestionsRow}>
                {TAG_SUGGESTIONS.map((tag) => (
                  <Pressable
                    key={tag}
                    onPress={() => handleAppendTag(tag)}
                    style={({ pressed }) => [
                      styles.suggestionPill,
                      { borderColor: colors.border, backgroundColor: isDark ? '#1F2937' : '#F9FAFB' },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Text style={[styles.suggestionPillText, { color: colors.textSecondary }]}>
                      {tag}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {/* ─── Optional Source / Product Tags ─── */}
            <View style={styles.sourceTagsSection}>
              <View style={styles.sourceTagsHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="pricetag-outline" size={15} color="#FF5C5C" />
                  <Text style={[styles.sourceTagsTitle, { color: colors.text }]}>
                    Source & Material Tags ({sourceTags.length})
                  </Text>
                </View>
                <Pressable
                  onPress={() => setIsTagModalVisible(true)}
                  style={styles.addTagPillBtn}
                >
                  <Ionicons name="add" size={14} color="#FF5C5C" />
                  <Text style={styles.addTagPillText}>Add Tag</Text>
                </Pressable>
              </View>

              {sourceTags.length > 0 && (
                <View style={styles.taggedList}>
                  {sourceTags.map((tag) => (
                    <View key={tag.id} style={styles.tagItem}>
                      <Text style={styles.tagItemName} numberOfLines={1}>
                        {tag.title}
                      </Text>
                      {tag.priceInRupees > 0 && (
                        <Text style={styles.tagItemPrice}>₹{tag.priceInRupees}</Text>
                      )}
                      <Pressable
                        onPress={() => setSourceTags((prev) => prev.filter((t) => t.id !== tag.id))}
                        hitSlop={6}
                      >
                        <Ionicons name="close" size={14} color="#9CA3AF" />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* ─── Primary Bottom Publish Button ─── */}
            <Pressable
              onPress={handlePublish}
              disabled={isPublishing}
              style={({ pressed }) => [
                styles.primaryPublishBtn,
                pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
                isPublishing && { opacity: 0.6 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Publish Drop"
            >
              <Text style={styles.primaryPublishBtnText}>Publish Drop</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ─── Task 3: Absolute-Positioned Reanimated Loading Overlay ─────────── */}
      {isPublishing && (
        <View style={styles.loadingOverlay}>
          <Animated.View style={[styles.loadingCard, animatedPulseStyle]}>
            <Animated.View style={animatedSpinnerStyle}>
              <Ionicons name="sync" size={38} color="#FF5C5C" />
            </Animated.View>
            <Text style={styles.loadingTitle}>Publishing to Sift</Text>
            <Text style={styles.loadingSubtitle}>{publishingStep}</Text>
          </Animated.View>
        </View>
      )}

      {/* ─── Product Source Tag Modal ───────────────────────────────────────── */}
      <Modal
        visible={isTagModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsTagModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Tag Furniture or Material</Text>
              <Pressable onPress={() => setIsTagModalVisible(false)} hitSlop={10}>
                <Ionicons name="close" size={20} color="#6B7280" />
              </Pressable>
            </View>

            <TextInput
              value={tagProductName}
              onChangeText={setTagProductName}
              placeholder="Product Name (e.g. Cane & Teak Armchair)"
              placeholderTextColor="#9CA3AF"
              style={styles.modalInput}
            />

            <TextInput
              value={tagProductPrice}
              onChangeText={setTagProductPrice}
              placeholder="Price in ₹ (Optional)"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
              style={styles.modalInput}
            />

            <TextInput
              value={tagProductLink}
              onChangeText={setTagProductLink}
              placeholder="Product URL / Store Link (Optional)"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              style={styles.modalInput}
            />

            <Pressable onPress={handleSaveSourceTag} style={styles.modalSaveBtn}>
              <Text style={styles.modalSaveBtnText}>Attach Tag</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export { CreatePostScreen as CreateScreen };
export default CreatePostScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeBtn: {
    padding: 4,
    minWidth: 40,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  publishHeaderBtn: {
    backgroundColor: '#FF5C5C',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 18,
  },
  publishHeaderBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  imagePreviewContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  imageWrapper: {
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  previewImage: {
    borderRadius: 20,
  },
  changePhotoPill: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(17, 24, 39, 0.75)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  changePhotoPillText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '600',
  },
  aspectBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(17, 24, 39, 0.65)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  aspectBadgeText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  imagePlaceholder: {
    borderRadius: 20,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F9FAFB',
    gap: 8,
  },
  placeholderIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  placeholderTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  placeholderSubtitle: {
    fontSize: 12.5,
    color: '#6B7280',
    textAlign: 'center',
    maxWidth: 240,
    lineHeight: 17,
  },
  pickPhotoBtn: {
    marginTop: 8,
    backgroundColor: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
  },
  pickPhotoBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  formSection: {
    paddingHorizontal: 4,
  },
  titleInput: {
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: -0.3,
    paddingVertical: 10,
  },
  fieldDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 8,
  },
  descriptionInput: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
    minHeight: 80,
    paddingVertical: 8,
  },
  tagSuggestionsSection: {
    marginTop: 12,
    marginBottom: 16,
  },
  tagSectionLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  tagSuggestionsRow: {
    gap: 8,
    flexDirection: 'row',
  },
  suggestionPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  suggestionPillText: {
    fontSize: 12,
    fontWeight: '500',
  },
  sourceTagsSection: {
    marginTop: 8,
    marginBottom: 24,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  sourceTagsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sourceTagsTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  addTagPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    gap: 2,
  },
  addTagPillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FF5C5C',
  },
  taggedList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  tagItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 6,
  },
  tagItemName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
    maxWidth: 120,
  },
  tagItemPrice: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  primaryPublishBtn: {
    backgroundColor: '#FF5C5C',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 24,
    shadowColor: '#FF5C5C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 8,
  },
  primaryPublishBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    paddingHorizontal: 32,
  },
  loadingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    gap: 12,
    width: 260,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  loadingTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.2,
  },
  loadingSubtitle: {
    fontSize: 12.5,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 17,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 340,
    gap: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  modalInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
  },
  modalSaveBtn: {
    backgroundColor: '#111827',
    paddingVertical: 11,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  modalSaveBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
});
