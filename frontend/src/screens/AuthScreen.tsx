import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Animated,
  ScrollView,
  Linking,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { safeHaptics, Haptics } from '../utils/haptics';

import { RootStackParamList } from '../types/navigation';
import { sendOtpApi, verifyOtpApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { Toast } from '../components/Toast';
import { ACCENT_COLOR } from '../context/ThemeContext';

const OTP_LENGTH = 4;
const RESEND_COOLDOWN_SECONDS = 30;

export const AuthScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { login } = useAuth();

  // ─── Step Management: 'PHONE' | 'OTP' ───────────────────────────────────────
  const [step, setStep] = useState<'PHONE' | 'OTP'>('PHONE');

  // ─── Step 1: Phone State ───────────────────────────────────────────────────
  const [countryCode] = useState('+91');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);

  // ─── Step 2: OTP State ─────────────────────────────────────────────────────
  const [otpCode, setOtpCode] = useState('');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isOtpInputFocused, setIsOtpInputFocused] = useState(true);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [devPreviewCode, setDevPreviewCode] = useState<string | null>(null);

  // ─── Feedback State ────────────────────────────────────────────────────────
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // ─── Refs & Animations ──────────────────────────────────────────────────────
  const phoneInputRef = useRef<any>(null);
  const otpInputRef = useRef<any>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // ─── Resend Timer Countdown ─────────────────────────────────────────────────
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (resendCooldown > 0) {
      timer = setTimeout(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // ─── Auto-Focus Phone Input on Load ─────────────────────────────────────────
  useEffect(() => {
    if (step === 'PHONE') {
      const timer = setTimeout(() => {
        phoneInputRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    } else if (step === 'OTP') {
      setIsOtpInputFocused(true);
      const timer = setTimeout(() => {
        otpInputRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [step]);

  // ─── Legal Links Handlers ───────────────────────────────────────────────────
  const handleOpenTerms = useCallback(async () => {
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const url = 'https://sift.app/terms';
    try {
      await Linking.openURL(url);
    } catch (err) {
      console.warn('Could not open Terms of Service URL:', err);
    }
  }, []);

  const handleOpenPrivacy = useCallback(async () => {
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const url = 'https://sift.app/privacy';
    try {
      await Linking.openURL(url);
    } catch (err) {
      console.warn('Could not open Privacy Policy URL:', err);
    }
  }, []);


  // ─── Error Shake Animation ──────────────────────────────────────────────────
  const triggerShake = useCallback(() => {
    safeHaptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  // ─── Full E.164 Phone Validation ───────────────────────────────────────────
  const cleanPhoneDigits = phoneNumber.replace(/\D/g, '');
  const fullPhoneNumber = `${countryCode}${cleanPhoneDigits}`;
  const isPhoneValid = cleanPhoneDigits.length === 10;

  // ─── Step 1 Action: Send Verification Code ──────────────────────────────────
  const handleSendOtp = async () => {
    if (!isPhoneValid || isSendingOtp) return;
    Keyboard.dismiss();
    setIsSendingOtp(true);
    setErrorMessage(null);

    try {
      safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const res = await sendOtpApi(fullPhoneNumber);

      if (res.success) {
        if (res.data.previewCode) {
          setDevPreviewCode(res.data.previewCode);
        }
        Animated.sequence([
          Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
          Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
        ]).start();

        setStep('OTP');
        setResendCooldown(RESEND_COOLDOWN_SECONDS);
        setToastMessage('Verification code sent');
        setTimeout(() => {
          otpInputRef.current?.focus();
        }, 300);
      } else {
        setErrorMessage(res.message || 'Failed to send verification code');
        triggerShake();
      }
    } catch (error: any) {
      const msg = error?.response?.data?.message || 'Network error. Please try again.';
      setErrorMessage(msg);
      triggerShake();
    } finally {
      setIsSendingOtp(false);
    }
  };

  // ─── Trigger Submit from "Continue" Button with Validation ──────────────────
  const handleSendCode = async () => {
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!isPhoneValid) {
      setErrorMessage('Please enter a valid 10-digit mobile number.');
      triggerShake();
      phoneInputRef.current?.focus();
      return;
    }
    await handleSendOtp();
  };

  // ─── Step 2 Action: Verify OTP & Smart Route (New vs Existing) ──────────────
  const handleVerifyOtp = async (codeToVerify?: string) => {
    const targetCode = (codeToVerify ?? otpCode).trim();
    if (targetCode.length !== OTP_LENGTH || isVerifyingOtp) return;

    Keyboard.dismiss();
    setIsVerifyingOtp(true);
    setErrorMessage(null);

    try {
      safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const res = await verifyOtpApi(fullPhoneNumber, targetCode);

      if (res.success && res.data) {
        safeHaptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Store session in AuthContext
        await login(res.data.token, res.data.user);

        // Smart Routing:
        // New user -> Onboarding Screen
        // Existing user -> Main Feed
        if (res.data.isNewUser) {
          navigation.reset({
            index: 0,
            routes: [{ name: 'Onboarding' }],
          });
        } else {
          navigation.reset({
            index: 0,
            routes: [{ name: 'MainTabs' }],
          });
        }
      } else {
        setErrorMessage(res.message || 'Verification failed');
        triggerShake();
        setOtpCode('');
      }
    } catch (error: any) {
      const msg = error?.response?.data?.message || 'Invalid verification code';
      setErrorMessage(msg);
      triggerShake();
      setOtpCode('');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: Math.max(insets.bottom, 24) + 20 },
            ]}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            {/* ─── Minimalist Brand Section ───────────────────────────────────── */}
            <View style={styles.brandSection} className="items-center mb-8">
              <Text style={styles.brandLogo} className="text-5xl font-black text-neutral-900 tracking-tighter">
                sift<Text style={[styles.brandDot, { color: ACCENT_COLOR }]}>.</Text>
              </Text>
              <Text style={styles.brandTagline} className="text-xs font-semibold text-neutral-400 tracking-widest mt-1.5">
                Discover Better.
              </Text>
            </View>

            {/* ─── High-End White Card Container ──────────────────────────────── */}
            <Animated.View
              style={[
                styles.card,
                {
                  opacity: fadeAnim,
                  transform: [{ translateX: shakeAnim }],
                },
              ]}
            >
              {/* Error Banner */}
              {errorMessage && (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle" size={16} color="#DC2626" />
                  <Text style={styles.errorBannerText}>{errorMessage}</Text>
                </View>
              )}

              {step === 'PHONE' ? (
                /* ═══════════ STEP 1: PHONE INPUT ═══════════ */
                <View>
                  <Text style={styles.stepTitle} className="text-2xl font-extrabold text-neutral-900 tracking-tight">
                    Enter mobile number
                  </Text>
                  <Text style={styles.stepSubtitle} className="text-sm text-neutral-500 mt-1.5 mb-6 leading-5 font-normal">
                    Step inside the world's best spaces.
                  </Text>


                  {/* Pre-filled +91 Indian Phone Input */}
                  <View style={styles.phoneInputRow}>
                    <View style={styles.countryBadge}>
                      <Text style={styles.flagEmoji}>🇮🇳</Text>
                      <Text style={styles.countryCodeText}>{countryCode}</Text>
                    </View>

                    <TextInput
                      ref={phoneInputRef}
                      style={styles.phoneTextInput}
                      className="flex-1 px-4 py-3.5 text-base font-semibold text-neutral-900 tracking-wider"
                      keyboardType="phone-pad"
                      placeholder="98765 43210"
                      placeholderTextColor="#9CA3AF"
                      value={phoneNumber}
                      onChangeText={(val) => {
                        setPhoneNumber(val);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      maxLength={10}
                      autoFocus={true}
                    />

                  </View>

                  {/* Full-Width Prominent Primary Action Button: "Continue" */}
                  <Pressable
                    onPress={handleSendCode}
                    disabled={isSendingOtp}
                    style={({ pressed }) => [
                      styles.continueButton,
                      pressed && styles.continueButtonPressed,
                      isSendingOtp && { opacity: 0.7 },
                    ]}
                    className="w-full py-4 rounded-xl flex-row justify-center items-center mt-6 bg-neutral-900"
                    accessibilityRole="button"
                    accessibilityLabel="Continue"
                  >
                    {isSendingOtp ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Text
                          style={styles.continueButtonText}
                          className="text-white font-bold text-base"
                        >
                          Continue
                        </Text>
                        <Ionicons
                          name="arrow-forward"
                          size={18}
                          color="#FFFFFF"
                          style={styles.continueArrowIcon}
                        />
                      </>
                    )}
                  </Pressable>
                </View>
              ) : (
                /* ═══════════ STEP 2: 4-DIGIT OTP VERIFICATION ═══════════ */
                <View>
                  <Text style={styles.stepTitle}>Verification code</Text>
                  <Text style={styles.stepSubtitle}>
                    Sent to {fullPhoneNumber} ·{' '}
                    <Text
                      style={styles.editPhoneLink}
                      onPress={() => {
                        setStep('PHONE');
                        setOtpCode('');
                      }}
                    >
                      Change
                    </Text>
                  </Text>

                  {/* Dev Code Quick Auto-fill Pill */}
                  {devPreviewCode && (
                    <Pressable
                      onPress={() => {
                        setOtpCode(devPreviewCode);
                        handleVerifyOtp(devPreviewCode);
                      }}
                      style={styles.devPill}
                    >
                      <Ionicons name="sparkles" size={13} color="#FF5C5C" />
                      <Text style={styles.devPillText}>
                        Auto-fill test code:{' '}
                        <Text style={{ fontWeight: '800' }}>{devPreviewCode}</Text>
                      </Text>
                    </Pressable>
                  )}

                  {/* 4-Digit OTP Container with Transparent Overlay TextInput */}
                  <View style={styles.otpContainer}>
                    {/* Visual OTP Boxes (pointerEvents='none' so touches hit the native overlay input) */}
                    <View style={styles.otpBoxesRow} pointerEvents="none">
                      {[0, 1, 2, 3].map((index) => {
                        const digit = otpCode[index] || '';
                        const isFocused =
                          isOtpInputFocused &&
                          (otpCode.length === index || (otpCode.length === 4 && index === 3));
                        return (
                          <View
                            key={index}
                            style={[
                              styles.otpBox,
                              digit.length > 0 && styles.otpBoxFilled,
                              isFocused && [
                                styles.otpBoxFocused,
                                { borderColor: ACCENT_COLOR, borderWidth: 2 },
                              ],
                            ]}
                          >
                            <Text style={styles.otpBoxDigit}>{digit}</Text>
                          </View>
                        );
                      })}
                    </View>

                    {/* Foolproof Transparent Overlay TextInput covering entire container */}
                    <TextInput
                      ref={otpInputRef}
                      style={styles.transparentOverlayInput}
                      keyboardType="number-pad"
                      maxLength={OTP_LENGTH}
                      value={otpCode}
                      onChangeText={(val) => {
                        const clean = val.replace(/\D/g, '').slice(0, OTP_LENGTH);
                        setOtpCode(clean);
                        if (errorMessage) setErrorMessage(null);
                        if (clean.length === OTP_LENGTH) {
                          handleVerifyOtp(clean);
                        }
                      }}
                      onFocus={() => setIsOtpInputFocused(true)}
                      onBlur={() => setIsOtpInputFocused(false)}
                      autoFocus
                      caretHidden
                      accessibilityLabel="Enter verification code"
                    />
                  </View>

                  {/* Resend Cooldown Countdown */}
                  <View style={styles.resendRow}>
                    {resendCooldown > 0 ? (
                      <Text style={styles.cooldownText}>
                        Resend code in {resendCooldown}s
                      </Text>
                    ) : (
                      <Pressable onPress={handleSendOtp} hitSlop={8}>
                        <Text style={styles.resendLink}>Resend code</Text>
                      </Pressable>
                    )}
                  </View>

                  {/* Full-Width Prominent Verify Button */}
                  <Pressable
                    onPress={() => handleVerifyOtp()}
                    disabled={isVerifyingOtp}
                    style={({ pressed }) => [
                      styles.continueButton,
                      pressed && styles.continueButtonPressed,
                      isVerifyingOtp && { opacity: 0.7 },
                    ]}
                    className="w-full py-4 rounded-xl flex-row justify-center items-center mt-6 bg-neutral-900"
                    accessibilityRole="button"
                    accessibilityLabel="Verify and continue"
                  >
                    {isVerifyingOtp ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Text
                          style={styles.continueButtonText}
                          className="text-white font-bold text-base"
                        >
                          Verify & Continue
                        </Text>
                        <Ionicons
                          name="checkmark"
                          size={18}
                          color="#FFFFFF"
                          style={styles.continueArrowIcon}
                        />
                      </>
                    )}
                  </Pressable>
                </View>
              )}
            </Animated.View>

            {/* Legal Compliance Footer with Clickable Links */}
            <View style={styles.termsContainer} className="flex-row flex-wrap justify-center items-center mt-6 px-4">
              <Text style={styles.termsText} className="text-xs text-neutral-400 text-center">
                By continuing, you agree to Sift's{' '}
              </Text>
              <Pressable
                onPress={handleOpenTerms}
                hitSlop={6}
                accessibilityRole="link"
                accessibilityLabel="Terms of Service"
              >
                <Text style={styles.termsLink} className="text-xs font-bold text-neutral-700">
                  Terms of Service
                </Text>
              </Pressable>
              <Text style={styles.termsText} className="text-xs text-neutral-400 text-center">
                {' '}&{' '}
              </Text>
              <Pressable
                onPress={handleOpenPrivacy}
                hitSlop={6}
                accessibilityRole="link"
                accessibilityLabel="Privacy Policy"
              >
                <Text style={styles.termsLink} className="text-xs font-bold text-neutral-700">
                  Privacy Policy
                </Text>
              </Pressable>
              <Text style={styles.termsText} className="text-xs text-neutral-400 text-center">
                .
              </Text>
            </View>

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
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  brandSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  brandLogo: {
    fontSize: 46,
    fontWeight: '900',
    color: '#111827',
    letterSpacing: -2,
  },
  brandDot: {
    color: '#E11D48',
  },
  brandTagline: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    marginTop: 6,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
      },
      android: {
        elevation: 4,
      },
    }),
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
    marginBottom: 16,
    gap: 8,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '500',
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.4,
  },
  stepSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 6,
    marginBottom: 22,
    lineHeight: 20,
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    overflow: 'hidden',
  },
  countryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 15,
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
    backgroundColor: '#F3F4F6',
    gap: 6,
  },
  flagEmoji: {
    fontSize: 17,
  },
  countryCodeText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  phoneTextInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 15,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    letterSpacing: 1,
  },
  continueButton: {
    width: '100%',
    backgroundColor: '#111827',
    paddingVertical: 16,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.16,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  continueButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: -0.2,
  },
  continueArrowIcon: {
    marginLeft: 8,
  },
  editPhoneLink: {
    color: '#FF5C5C',
    fontWeight: '700',
  },
  devPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FED7D7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 16,
    gap: 6,
  },
  devPillText: {
    fontSize: 12,
    color: '#C53030',
  },
  otpContainer: {
    position: 'relative',
    width: '100%',
    marginBottom: 12,
  },
  otpBoxesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  transparentOverlayInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    opacity: 0,
    zIndex: 10,
    backgroundColor: 'transparent',
    color: 'transparent',
  },
  otpBox: {
    width: 62,
    height: 62,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpBoxFocused: {
    borderColor: '#FF5C5C',
    borderWidth: 2,
    backgroundColor: '#FFFFFF',
    shadowColor: '#FF5C5C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  otpBoxFilled: {
    borderColor: '#9CA3AF',
    backgroundColor: '#FFFFFF',
  },
  otpBoxDigit: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
  },
  resendRow: {
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 8,
  },
  cooldownText: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  resendLink: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '700',
  },
  termsContainer: {
    marginTop: 24,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  termsText: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 18,
  },
  termsLink: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '700',
  },

});
