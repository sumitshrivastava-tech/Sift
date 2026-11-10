import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { safeHaptics, Haptics } from '../utils/haptics';

interface EditProfileModalProps {
  visible: boolean;
  currentUsername: string;
  currentFullName?: string | null;
  currentPhone?: string;
  currentBio?: string | null;
  currentAvatar?: string | null;
  onClose: () => void;
  onSave: (data: {
    username: string;
    fullName?: string;
    phone?: string;
    bio: string;
    avatar?: string;
  }) => Promise<void>;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  visible,
  currentUsername,
  currentFullName,
  currentPhone,
  currentBio,
  currentAvatar,
  onClose,
  onSave,
}) => {
  const { height: windowHeight } = useWindowDimensions();

  const [username, setUsername] = useState(currentUsername);
  const [fullName, setFullName] = useState(currentFullName || '');
  const [bio, setBio] = useState(currentBio || '');
  const [avatarUri, setAvatarUri] = useState<string | null>(currentAvatar || null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Bottom Sheet Slide-Up Animation drivers
  const sheetTranslateY = useSharedValue(windowHeight * 0.7);
  const backdropOpacity = useSharedValue(0);

  // 60FPS Reanimated Spinner for the Save Action
  const spinRotation = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setUsername(currentUsername);
      setFullName(currentFullName || '');
      setBio(currentBio || '');
      setAvatarUri(currentAvatar || null);
      setErrorMessage(null);
      setIsSaving(false);

      backdropOpacity.value = withTiming(1, { duration: 200 });
      sheetTranslateY.value = withSpring(0, {
        damping: 24,
        stiffness: 240,
        mass: 0.8,
      });
    } else {
      backdropOpacity.value = 0;
      sheetTranslateY.value = windowHeight * 0.7;
    }
  }, [visible, currentUsername, currentFullName, currentBio, currentAvatar, windowHeight, backdropOpacity, sheetTranslateY]);

  // Start continuous Reanimated spin when isSaving is active
  useEffect(() => {
    if (isSaving) {
      spinRotation.value = withRepeat(
        withTiming(360, { duration: 800, easing: Easing.linear }),
        -1,
        false
      );
    } else {
      spinRotation.value = 0;
    }
  }, [isSaving, spinRotation]);

  const animatedBackdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const animatedSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTranslateY.value }],
  }));

  const animatedSpinnerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spinRotation.value}deg` }],
  }));

  const handleDismiss = () => {
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    backdropOpacity.value = withTiming(0, { duration: 150 });
    sheetTranslateY.value = withTiming(windowHeight * 0.7, { duration: 180 }, (finished) => {
      if (finished) {
        runOnJS(onClose)();
      }
    });
  };

  const handlePickAvatar = async () => {
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Photo Library Access Required',
          'Please grant access to your photo library to update your profile photo.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        safeHaptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setAvatarUri(result.assets[0].uri);
      }
    } catch (err) {
      console.warn('Failed to pick avatar image:', err);
    }
  };

  const handleSave = async () => {
    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    const cleanFullName = fullName.trim();
    const cleanBio = bio.trim();

    if (!cleanUsername || cleanUsername.length < 3) {
      safeHaptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorMessage('Username must be at least 3 alphanumeric characters.');
      return;
    }

    setErrorMessage(null);
    setIsSaving(true);
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await onSave({
        username: cleanUsername,
        fullName: cleanFullName,
        phone: currentPhone,
        bio: cleanBio,
        avatar: avatarUri || undefined,
      });
      safeHaptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      handleDismiss();
    } catch (err: any) {
      safeHaptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const serverMessage =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to update profile. Please try another username.';
      setErrorMessage(serverMessage);
    } finally {
      setIsSaving(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={handleDismiss}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Dimmed Backdrop */}
        <Animated.View style={[styles.backdrop, animatedBackdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleDismiss} />
        </Animated.View>

        {/* 50% Minimalist Bottom Sheet */}
        <Animated.View style={[styles.bottomSheet, animatedSheetStyle]}>
          {/* Top Pill Handle */}
          <View style={styles.handleContainer}>
            <View style={styles.handleBar} />
          </View>

          {/* Navigation Bar */}
          <View style={styles.headerBar}>
            <Pressable
              onPress={handleDismiss}
              hitSlop={10}
              style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.6 }]}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>

            <Text style={styles.headerTitle}>Edit Profile</Text>

            <Pressable
              onPress={handleSave}
              disabled={isSaving}
              hitSlop={10}
              style={({ pressed }) => [
                styles.saveBtn,
                pressed && { opacity: 0.7 },
                isSaving && { opacity: 0.5 },
              ]}
            >
              {isSaving ? (
                <Animated.View style={animatedSpinnerStyle}>
                  <Ionicons name="sync" size={17} color="#111827" />
                </Animated.View>
              ) : (
                <Text style={styles.saveText}>Save</Text>
              )}
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >
            {/* Error Notification Banner */}
            {errorMessage && (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={16} color="#DC2626" />
                <Text style={styles.errorBannerText}>{errorMessage}</Text>
              </View>
            )}

            {/* Avatar Picker Preview */}
            <View style={styles.avatarSection}>
              <Pressable
                onPress={handlePickAvatar}
                style={({ pressed }) => [
                  styles.avatarWrapper,
                  pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Change profile photo"
              >
                <Image
                  source={
                    avatarUri ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(
                      fullName || username || 'User'
                    )}&background=111827&color=fff&size=200`
                  }
                  style={styles.avatarPreview}
                  contentFit="cover"
                  transition={150}
                />
                <View style={styles.cameraBadge}>
                  <Ionicons name="camera" size={13} color="#FFFFFF" />
                </View>
              </Pressable>

              <Pressable
                onPress={handlePickAvatar}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.changePhotoTextBtn,
                  pressed && { opacity: 0.6 },
                ]}
              >
                <Text style={styles.changePhotoText}>Change Photo</Text>
              </Pressable>
            </View>

            {/* Field 1: Full Name */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>NAME</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  value={fullName}
                  onChangeText={(val) => {
                    setFullName(val);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="e.g. Elena Rostova"
                  placeholderTextColor="#9CA3AF"
                  style={styles.textInput}
                  maxLength={60}
                />
              </View>
            </View>

            {/* Field 2: Username with @ prefix */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>USERNAME</Text>
              <View style={styles.inputWrapper}>
                <Text style={styles.atPrefix}>@</Text>
                <TextInput
                  value={username}
                  onChangeText={(val) => {
                    setUsername(val.toLowerCase().replace(/\s+/g, ''));
                    if (errorMessage) setErrorMessage(null);
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="username"
                  placeholderTextColor="#9CA3AF"
                  style={styles.textInput}
                  maxLength={30}
                />
              </View>
              <Text style={styles.hintText}>
                People can mention you with @{username || 'username'}
              </Text>
            </View>

            {/* Field 3: Bio with character counter */}
            <View style={styles.fieldContainer}>
              <View style={styles.labelRow}>
                <Text style={styles.fieldLabel}>BIO</Text>
                <Text style={styles.charCount}>{bio.length}/150</Text>
              </View>
              <View style={[styles.inputWrapper, styles.bioInputWrapper]}>
                <TextInput
                  value={bio}
                  onChangeText={(val) => {
                    setBio(val);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  multiline
                  numberOfLines={3}
                  placeholder="Share a short bio or your design aesthetic..."
                  placeholderTextColor="#9CA3AF"
                  style={[styles.textInput, styles.bioInput]}
                  maxLength={150}
                  textAlignVertical="top"
                />
              </View>
            </View>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  bottomSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 16,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  handleBar: {
    width: 38,
    height: 4.5,
    borderRadius: 3,
    backgroundColor: '#E5E7EB',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  cancelBtn: {
    paddingVertical: 4,
  },
  cancelText: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.2,
  },
  saveBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FF5C5C',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 16,
    gap: 8,
  },
  errorBannerText: {
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '600',
    flex: 1,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarWrapper: {
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  avatarPreview: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2,
    borderColor: '#F3F4F6',
    backgroundColor: '#E5E7EB',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  changePhotoTextBtn: {
    marginTop: 8,
    paddingVertical: 2,
  },
  changePhotoText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FF5C5C',
  },
  fieldContainer: {
    marginBottom: 18,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  charCount: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    minHeight: 46,
  },
  bioInputWrapper: {
    alignItems: 'flex-start',
    paddingVertical: 10,
    minHeight: 88,
  },
  atPrefix: {
    fontSize: 15,
    fontWeight: '600',
    color: '#9CA3AF',
    marginRight: 2,
  },
  textInput: {
    flex: 1,
    fontSize: 14.5,
    color: '#111827',
    paddingVertical: 8,
  },
  bioInput: {
    minHeight: 68,
  },
  hintText: {
    fontSize: 11.5,
    color: '#9CA3AF',
    marginTop: 5,
    paddingHorizontal: 2,
  },
});
