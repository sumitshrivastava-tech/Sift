import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeInDown,
} from 'react-native-reanimated';
import { safeHaptics, Haptics } from '../utils/haptics';
import { RootStackParamList } from '../types/navigation';
import { useAuth } from '../context/AuthContext';
import { checkUsernameAvailableApi } from '../api';
import { Toast } from '../components/Toast';

export const OnboardingScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { currentUser, updateProfile, logout } = useAuth();

  // Prepopulate with currentUser if existing, otherwise start with blank / clean state
  const [fullName, setFullName] = useState(currentUser?.fullName || '');
  const [username, setUsername] = useState(
    currentUser?.username && !currentUser.username.startsWith('user_')
      ? currentUser.username
      : ''
  );
  const [avatar, setAvatar] = useState<string | null>(currentUser?.avatar || null);
  const [bio, setBio] = useState(currentUser?.bio || '');

  // Focused state for styling inputs
  const [focusedField, setFocusedField] = useState<'fullName' | 'username' | 'bio' | null>(null);

  // Username validation & live check state
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [isUsernameAvailable, setIsUsernameAvailable] = useState<boolean | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animated scale for submit button press
  const buttonScale = useSharedValue(1);
  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const handleButtonPressIn = () => {
    buttonScale.value = withSpring(0.97, { damping: 15, stiffness: 300 });
  };

  const handleButtonPressOut = () => {
    buttonScale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  // ─── Live Username Availability Check ───────────────────────────────────────
  const checkUsername = useCallback(
    async (candidate: string) => {
      const clean = candidate.trim().toLowerCase();
      if (!clean) {
        setIsUsernameAvailable(null);
        setUsernameError(null);
        setIsCheckingUsername(false);
        return;
      }

      if (clean.length < 3) {
        setIsUsernameAvailable(null);
        setUsernameError('Username must be at least 3 characters');
        setIsCheckingUsername(false);
        return;
      }

      if (!/^[a-z0-9_]+$/.test(clean)) {
        setIsUsernameAvailable(null);
        setUsernameError('Only lowercase letters, numbers, and underscores');
        setIsCheckingUsername(false);
        return;
      }

      setIsCheckingUsername(true);
      setUsernameError(null);

      try {
        const res = await checkUsernameAvailableApi(clean, currentUser?.id);
        if (res.success && res.data) {
          setIsUsernameAvailable(res.data.available);
          if (!res.data.available) {
            setUsernameError('Username is already taken');
          }
        }
      } catch {
        // Fallback: assume valid if network glitch during onboarding
        setIsUsernameAvailable(true);
      } finally {
        setIsCheckingUsername(false);
      }
    },
    [currentUser?.id]
  );

  const handleUsernameChange = (text: string) => {
    // Enforce auto-lowercase and no spaces
    const clean = text.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9_]/g, '');
    setUsername(clean);
    if (errorMessage) setErrorMessage(null);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      checkUsername(clean);
    }, 350);
  };

  // ─── Pick Image From Gallery ────────────────────────────────────────────────
  const handlePickImage = async () => {
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      setToastMessage('Permission to access photos is needed to set a profile picture.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setAvatar(result.assets[0].uri);
        safeHaptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      setToastMessage('Could not open photo library. Please try again.');
    }
  };

  // ─── Escape Hatch: Cancel / Use Different Number ────────────────────────────
  const handleEscapeHatch = async () => {
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await logout();
    } catch (e) {
      console.warn('Logout error during onboarding escape:', e);
    }
    navigation.reset({
      index: 0,
      routes: [{ name: 'Auth' }],
    });
  };

  // ─── Complete Profile Submission ────────────────────────────────────────────
  const handleSubmit = async () => {
    Keyboard.dismiss();
    const cleanFullName = fullName.trim();
    const cleanUsername = username.trim().toLowerCase();
    const cleanBio = bio.trim();

    if (!cleanFullName) {
      safeHaptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorMessage('Please enter your full name.');
      return;
    }

    if (!cleanUsername || cleanUsername.length < 3) {
      safeHaptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorMessage('Please enter a username with at least 3 characters.');
      return;
    }

    if (isUsernameAvailable === false) {
      safeHaptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorMessage('Username is already taken. Please choose another.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Sends PATCH /api/users/:id via updateProfile in AuthContext
      await updateProfile({
        fullName: cleanFullName,
        username: cleanUsername,
        avatar: avatar || undefined,
        bio: cleanBio || undefined,
      });

      safeHaptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Navigate to MainTabs and reset navigation history
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      });
    } catch (err: any) {
      safeHaptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorMessage(
        err?.response?.data?.message || 'Failed to complete profile. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: Math.max(insets.bottom, 24) + 32 },
            ]}
            keyboardShouldPersistTaps="handled"
          >
            {/* ─── Top Bar / Escape Hatch ─────────────────────────────────────── */}
            <Animated.View
              entering={FadeInDown.duration(300)}
              style={styles.topBar}
              className="flex-row items-center justify-between mb-4"
            >
              <Pressable
                onPress={handleEscapeHatch}
                hitSlop={10}
                style={styles.escapeButton}
                className="flex-row items-center py-1.5 px-1"
                accessibilityRole="button"
                accessibilityLabel="Cancel and use different number"
              >
                <Ionicons name="chevron-back" size={18} color="#6B7280" />
                <Text style={styles.escapeText} className="text-xs font-semibold text-neutral-500 ml-1">
                  Cancel / Use different number
                </Text>
              </Pressable>

              <View style={styles.stepBadge} className="bg-neutral-100 px-2.5 py-1 rounded-full">
                <Text style={styles.stepBadgeText} className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                  Step 2 of 2
                </Text>
              </View>
            </Animated.View>

            {/* ─── Header Section ─────────────────────────────────────────────── */}
            <Animated.View entering={FadeInDown.duration(350).delay(50)} style={styles.header} className="mb-6">
              <Text style={styles.title} className="text-3xl font-black text-neutral-900 tracking-tight">
                Complete Profile
              </Text>
              <Text style={styles.subtitle} className="text-sm text-neutral-500 mt-1 leading-5">
                Set up your curator identity on Sift. Personalize your name, handle, and aesthetic.
              </Text>
            </Animated.View>

            {/* ─── Error Banner ───────────────────────────────────────────────── */}
            {errorMessage && (
              <Animated.View
                entering={FadeInDown.duration(200)}
                style={styles.errorBanner}
                className="flex-row items-center bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5 mb-5"
              >
                <Ionicons name="alert-circle" size={16} color="#E11D48" />
                <Text style={styles.errorBannerText} className="text-xs font-medium text-rose-600 ml-2 flex-1">
                  {errorMessage}
                </Text>
              </Animated.View>
            )}

            {/* ─── 1. Avatar Picker ───────────────────────────────────────────── */}
            <Animated.View
              entering={FadeInDown.duration(400).delay(100)}
              style={styles.avatarSection}
              className="items-center mb-6"
            >
              <Pressable
                onPress={handlePickImage}
                style={({ pressed }) => [
                  styles.avatarWrapper,
                  !avatar && styles.avatarWrapperEmpty,
                  pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                ]}
                className="w-28 h-28 rounded-full items-center justify-center relative overflow-hidden"
                accessibilityRole="button"
                accessibilityLabel="Upload profile photo"
              >
                {avatar ? (
                  <>
                    <Image
                      source={{ uri: avatar }}
                      style={styles.avatarImage}
                      contentFit="cover"
                      transition={200}
                    />
                    <View style={styles.cameraIconBadge} className="absolute bottom-0 inset-x-0 bg-black/60 py-1 items-center justify-center">
                      <Ionicons name="camera" size={14} color="#FFFFFF" />
                    </View>
                  </>
                ) : (
                  <View style={styles.avatarPlaceholder} className="items-center justify-center">
                    <Ionicons name="camera-outline" size={36} color="#9CA3AF" />
                    <Text style={styles.avatarPlaceholderText} className="text-[10px] font-bold text-neutral-400 mt-1 uppercase tracking-wider">
                      Add Photo
                    </Text>
                  </View>
                )}
              </Pressable>

              <Text style={styles.avatarHint} className="text-xs font-medium text-neutral-500 mt-2.5">
                {avatar ? 'Tap to change photo' : 'Upload a profile photo'}
              </Text>
            </Animated.View>

            {/* ─── 2. Full Name Input ─────────────────────────────────────────── */}
            <Animated.View entering={FadeInDown.duration(400).delay(150)} style={styles.fieldContainer} className="mb-4">
              <Text style={styles.fieldLabel} className="text-xs font-bold text-neutral-700 uppercase tracking-wider mb-2">
                Full Name
              </Text>
              <View
                style={[
                  styles.inputWrapper,
                  focusedField === 'fullName' && styles.inputWrapperFocused,
                ]}
                className="flex-row items-center bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3.5"
              >
                <TextInput
                  style={styles.textInput}
                  className="flex-1 text-sm font-medium text-neutral-900"
                  placeholder="e.g. Elena Rostova"
                  placeholderTextColor="#9CA3AF"
                  value={fullName}
                  onChangeText={(val) => {
                    setFullName(val);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  onFocus={() => setFocusedField('fullName')}
                  onBlur={() => setFocusedField(null)}
                  autoCapitalize="words"
                  autoCorrect={false}
                  maxLength={50}
                />
                {fullName.trim().length > 0 && (
                  <Pressable onPress={() => setFullName('')} hitSlop={8}>
                    <Ionicons name="close-circle" size={16} color="#9CA3AF" />
                  </Pressable>
                )}
              </View>
            </Animated.View>

            {/* ─── 3. Username Input (Auto-lowercase, No Spaces) ──────────────── */}
            <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.fieldContainer} className="mb-4">
              <View style={styles.labelRow} className="flex-row justify-between items-center mb-2">
                <Text style={styles.fieldLabel} className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
                  Username
                </Text>
                {isCheckingUsername ? (
                  <ActivityIndicator size="small" color="#6B7280" />
                ) : isUsernameAvailable === true && username.length >= 3 ? (
                  <View style={styles.statusPillAvailable} className="flex-row items-center bg-emerald-50 px-2 py-0.5 rounded-md">
                    <Ionicons name="checkmark-circle" size={12} color="#059669" />
                    <Text style={styles.statusTextAvailable} className="text-[11px] font-bold text-emerald-700 ml-1">
                      Available
                    </Text>
                  </View>
                ) : isUsernameAvailable === false ? (
                  <View style={styles.statusPillTaken} className="flex-row items-center bg-rose-50 px-2 py-0.5 rounded-md">
                    <Ionicons name="close-circle" size={12} color="#E11D48" />
                    <Text style={styles.statusTextTaken} className="text-[11px] font-bold text-rose-600 ml-1">
                      Taken
                    </Text>
                  </View>
                ) : null}
              </View>

              <View
                style={[
                  styles.inputWrapper,
                  focusedField === 'username' && styles.inputWrapperFocused,
                  isUsernameAvailable === false && styles.inputWrapperError,
                ]}
                className="flex-row items-center bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3.5"
              >
                <Text style={styles.atPrefix} className="text-base font-semibold text-neutral-400 mr-1">
                  @
                </Text>
                <TextInput
                  style={styles.textInput}
                  className="flex-1 text-sm font-medium text-neutral-900"
                  placeholder="username"
                  placeholderTextColor="#9CA3AF"
                  value={username}
                  onChangeText={handleUsernameChange}
                  onFocus={() => setFocusedField('username')}
                  onBlur={() => setFocusedField(null)}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={30}
                />
              </View>
              {usernameError ? (
                <Text style={styles.fieldErrorText} className="text-xs text-rose-500 font-medium mt-1.5 ml-1">
                  {usernameError}
                </Text>
              ) : (
                <Text style={styles.hintText} className="text-[11px] text-neutral-400 mt-1.5 ml-1">
                  Auto-formatted: lowercase letters, numbers, and underscores only.
                </Text>
              )}
            </Animated.View>

            {/* ─── 4. Bio Input (Multiline, Optional) ─────────────────────────── */}
            <Animated.View entering={FadeInDown.duration(400).delay(250)} style={styles.fieldContainer} className="mb-6">
              <View style={styles.labelRow} className="flex-row justify-between items-center mb-2">
                <Text style={styles.fieldLabel} className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
                  Bio <Text style={styles.optionalTag} className="text-neutral-400 font-normal lowercase">(optional)</Text>
                </Text>
                <Text style={styles.charCount} className="text-[11px] text-neutral-400">
                  {bio.length}/160
                </Text>
              </View>

              <View
                style={[
                  styles.bioInputWrapper,
                  focusedField === 'bio' && styles.inputWrapperFocused,
                ]}
                className="bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3"
              >
                <TextInput
                  style={[styles.textInput, styles.bioInput]}
                  className="text-sm font-medium text-neutral-900"
                  placeholder="Curator of spaces, textures, and contemporary design..."
                  placeholderTextColor="#9CA3AF"
                  value={bio}
                  onChangeText={(val) => {
                    setBio(val);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  onFocus={() => setFocusedField('bio')}
                  onBlur={() => setFocusedField(null)}
                  multiline
                  numberOfLines={3}
                  maxLength={160}
                  textAlignVertical="top"
                />
              </View>
            </Animated.View>

            {/* ─── 5. Submit Button ───────────────────────────────────────────── */}
            <Animated.View
              entering={FadeInDown.duration(400).delay(300)}
              style={animatedButtonStyle}
            >
              <Pressable
                onPress={handleSubmit}
                onPressIn={handleButtonPressIn}
                onPressOut={handleButtonPressOut}
                disabled={isSubmitting}
                style={[
                  styles.submitButton,
                  isSubmitting && styles.submitButtonDisabled,
                ]}
                className="w-full bg-neutral-900 rounded-2xl py-4 items-center justify-center flex-row shadow-sm"
                accessibilityRole="button"
                accessibilityLabel="Complete Profile"
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <View style={styles.submitButtonContent} className="flex-row items-center justify-center">
                    <Text style={styles.submitButtonText} className="text-white text-base font-bold tracking-tight">
                      Complete Profile
                    </Text>
                    <Ionicons
                      name="arrow-forward"
                      size={18}
                      color="#FFFFFF"
                      style={{ marginLeft: 8 }}
                    />
                  </View>
                )}
              </Pressable>
            </Animated.View>

            {/* ─── 6. Secondary Bottom Escape Hatch ───────────────────────────── */}
            <Animated.View
              entering={FadeInDown.duration(400).delay(350)}
              style={styles.bottomEscapeRow}
              className="mt-4 items-center"
            >
              <Pressable
                onPress={handleEscapeHatch}
                hitSlop={8}
                className="py-2 px-3"
                accessibilityRole="button"
                accessibilityLabel="Cancel / Use different number"
              >
                <Text style={styles.bottomEscapeText} className="text-xs font-semibold text-neutral-400">
                  Cancel / Use different number
                </Text>
              </Pressable>
            </Animated.View>

          </ScrollView>
        </KeyboardAvoidingView>

        {/* Feedback Toast */}
        <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  escapeButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  escapeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginLeft: 4,
  },
  stepBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  stepBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6B7280',
    letterSpacing: 0.6,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#111827',
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
    lineHeight: 20,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 18,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#E11D48',
    fontWeight: '500',
    marginLeft: 8,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarWrapper: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: '#F3F4F6',
    borderWidth: 2,
    borderColor: '#111827',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarWrapperEmpty: {
    borderStyle: 'dashed',
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  cameraIconBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 26,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarHint: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 10,
  },
  fieldContainer: {
    marginBottom: 18,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  optionalTag: {
    textTransform: 'none',
    fontWeight: '400',
    color: '#9CA3AF',
  },
  charCount: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  statusPillAvailable: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusTextAvailable: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
    marginLeft: 4,
  },
  statusPillTaken: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusTextTaken: {
    fontSize: 11,
    fontWeight: '700',
    color: '#E11D48',
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  bioInputWrapper: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 90,
  },
  inputWrapperFocused: {
    borderColor: '#111827',
    backgroundColor: '#FFFFFF',
  },
  inputWrapperError: {
    borderColor: '#FDA4AF',
    backgroundColor: '#FFF1F2',
  },
  atPrefix: {
    fontSize: 15,
    fontWeight: '600',
    color: '#9CA3AF',
    marginRight: 4,
  },
  textInput: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
    padding: 0,
  },
  bioInput: {
    minHeight: 70,
  },
  hintText: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 6,
    marginLeft: 4,
  },
  fieldErrorText: {
    fontSize: 12,
    color: '#E11D48',
    fontWeight: '500',
    marginTop: 6,
    marginLeft: 4,
  },
  submitButton: {
    backgroundColor: '#111827',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  submitButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  submitButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  bottomEscapeRow: {
    alignItems: 'center',
    marginTop: 14,
  },
  bottomEscapeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
  },
});
