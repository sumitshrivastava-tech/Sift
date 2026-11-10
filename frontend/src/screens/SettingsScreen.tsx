import React, { useState, useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { safeHaptics, Haptics } from '../utils/haptics';
import { Toast } from '../components/Toast';
import { EditProfileModal } from '../components/EditProfileModal';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
}

const INDIAN_LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English (India)', nativeName: 'English' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी' },
];

/**
 * Native iOS-styled Settings Row with icon, label, optional value / switch / chevron
 */
interface SettingsRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconBgColor: string;
  label: string;
  value?: string;
  isSwitch?: boolean;
  switchValue?: boolean;
  onSwitchChange?: (val: boolean) => void;
  onPress?: () => void;
  isDestructive?: boolean;
  isLast?: boolean;
}

const SettingsRow: React.FC<SettingsRowProps> = memo(
  ({
    icon,
    iconBgColor,
    label,
    value,
    isSwitch,
    switchValue,
    onSwitchChange,
    onPress,
    isDestructive,
    isLast,
  }) => {
    const { colors } = useTheme();

    return (
      <Pressable
        onPress={isSwitch ? undefined : onPress}
        disabled={isSwitch}
        style={({ pressed }) => [
          styles.rowContainer,
          pressed && !isSwitch && styles.rowPressed,
        ]}
        accessibilityRole={isSwitch ? 'switch' : 'button'}
        accessibilityLabel={label}
      >
        <View style={styles.rowInner}>
          {/* iOS SF-style colored rounded square icon */}
          <View style={[styles.iconBox, { backgroundColor: iconBgColor }]}>
            <Ionicons name={icon} size={18} color="#FFFFFF" />
          </View>

          {/* Row Content */}
          <View style={[styles.rowBody, { borderBottomColor: colors.border }, isLast && styles.rowBodyLast]}>
            <Text
              style={[
                styles.rowLabel,
                { color: isDestructive ? '#FF3B30' : colors.text },
                isDestructive && styles.destructiveLabel,
              ]}
              numberOfLines={1}
            >
              {label}
            </Text>

            <View style={styles.rowRight}>
              {value && <Text style={[styles.rowValue, { color: colors.textSecondary }]}>{value}</Text>}

              {isSwitch ? (
                <Switch
                  value={switchValue}
                  onValueChange={(val) => {
                    safeHaptics.selectionAsync();
                    onSwitchChange?.(val);
                  }}
                  trackColor={{ false: colors.border, true: colors.accent }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor={colors.border}
                />
              ) : (
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.textMuted}
                  style={styles.chevron}
                />
              )}
            </View>
          </View>
        </View>
      </Pressable>
    );
  }
);

export const SettingsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { currentUser, logout, updateProfile } = useAuth();

  // ─── Preferences State & Dynamic Theme ───────────────────────────────────────
  const { isDark: darkMode, setDarkMode, colors } = useTheme();
  const [pushNotifications, setPushNotifications] = useState(true);
  const [autoplayVideos, setAutoplayVideos] = useState(true);
  const [hapticFeedback, setHapticFeedback] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageOption>(
    INDIAN_LANGUAGES[0]
  );
  const [isLanguageModalVisible, setIsLanguageModalVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [cacheSize, setCacheSize] = useState('34.8 MB');

  const avatarUrl =
    currentUser.avatar ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      currentUser.username || 'User'
    )}&background=111827&color=fff&size=200`;

  // ─── Handlers ────────────────────────────────────────────────────────────────
  const handleBack = () => {
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.goBack();
  };

  const handleClearCache = () => {
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Clear Cache',
      `Are you sure you want to clear ${cacheSize} of cached images and preview data?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            setCacheSize('0.0 MB');
            setToastMessage('Cache cleared successfully');
            safeHaptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out of your Sift account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            await logout();
            navigation.reset({
              index: 0,
              routes: [{ name: 'Auth' }],
            });
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      'Delete Account',
      'This action is irreversible. All your saved posts, comments, and profile data will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await logout();
            navigation.reset({
              index: 0,
              routes: [{ name: 'Auth' }],
            });
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      {/* iOS Styled Navigation Bar */}
      <View style={[styles.navBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Pressable
          onPress={handleBack}
          hitSlop={10}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
          <Text style={[styles.backButtonText, { color: colors.text }]}>Profile</Text>
        </Pressable>

        <Text style={[styles.navTitle, { color: colors.text }]}>Settings</Text>

        <View style={styles.navRightPlaceholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Profile Mini Card (Account Hero) ─────────────────────────────────── */}
        <Pressable
          onPress={() => {
            safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setIsEditModalVisible(true);
          }}
          style={({ pressed }) => [
            styles.profileCard,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
            pressed && styles.profileCardPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Edit Profile"
        >
          <Image
            source={avatarUrl}
            style={styles.profileAvatar}
            contentFit="cover"
            transition={150}
          />
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: colors.text }]} numberOfLines={1}>
              {currentUser.fullName || currentUser.username}
            </Text>
            <Text style={[styles.profileUsername, { color: colors.textMuted }]} numberOfLines={1}>
              @{currentUser.username} • {currentUser.phone || 'Phone verified'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>

        {/* ─── Section 1: Account ─────────────────────────────────────────────── */}
        <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>ACCOUNT</Text>
        <View style={[styles.groupCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <SettingsRow
            icon="person"
            iconBgColor="#007AFF"
            label="Edit Profile"
            onPress={() => {
              safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setIsEditModalVisible(true);
            }}
          />
          <SettingsRow
            icon="call"
            iconBgColor="#34C759"
            label="Phone Number"
            value={currentUser.phone || '+91 ••••• •••••'}
            onPress={() => {
              Alert.alert('Phone Verified', `Linked phone number: ${currentUser.phone || 'None'}`);
            }}
          />
          <SettingsRow
            icon="ribbon"
            iconBgColor="#AF52DE"
            label="Creator Status"
            value="Active"
            onPress={() => {
              Alert.alert('Creator Badge', 'You have full verified creator privileges on Sift.');
            }}
          />
          <SettingsRow
            icon="bookmark"
            iconBgColor="#FF9500"
            label="Saved Boards & Collections"
            isLast
            onPress={() => {
              safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.goBack();
            }}
          />
        </View>

        {/* ─── Section 2: Preferences ─────────────────────────────────────────── */}
        <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>PREFERENCES</Text>
        <View style={[styles.groupCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <SettingsRow
            icon="moon"
            iconBgColor="#5856D6"
            label="Dark Mode"
            isSwitch
            switchValue={darkMode}
            onSwitchChange={(val) => {
              setDarkMode(val);
              setToastMessage(val ? 'Dark Mode preview enabled' : 'Light Mode restored');
            }}
          />
          <SettingsRow
            icon="notifications"
            iconBgColor="#FF3B30"
            label="Push Notifications"
            isSwitch
            switchValue={pushNotifications}
            onSwitchChange={(val) => {
              setPushNotifications(val);
              setToastMessage(val ? 'Push notifications on' : 'Notifications paused');
            }}
          />
          <SettingsRow
            icon="language"
            iconBgColor="#007AFF"
            label="Vernacular / Language"
            value={selectedLanguage.nativeName}
            onPress={() => {
              safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setIsLanguageModalVisible(true);
            }}
          />
          <SettingsRow
            icon="play-circle"
            iconBgColor="#34C759"
            label="Autoplay Videos"
            isSwitch
            switchValue={autoplayVideos}
            onSwitchChange={(val) => {
              setAutoplayVideos(val);
            }}
          />
          <SettingsRow
            icon="finger-print"
            iconBgColor="#FF9500"
            label="Haptic Feedback"
            isSwitch
            switchValue={hapticFeedback}
            isLast
            onSwitchChange={(val) => {
              setHapticFeedback(val);
            }}
          />
        </View>

        {/* ─── Section 3: Security & Privacy ──────────────────────────────────── */}
        <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>SECURITY & PRIVACY</Text>
        <View style={[styles.groupCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <SettingsRow
            icon="shield-checkmark"
            iconBgColor="#34C759"
            label="Phone OTP Authentication"
            value="Verified ✓"
            onPress={() => {
              Alert.alert('Security Check', 'Your account is secured with verified Phone OTP authentication.');
            }}
          />
          <SettingsRow
            icon="lock-closed"
            iconBgColor="#5856D6"
            label="Private Profile"
            isSwitch
            switchValue={false}
            onSwitchChange={() => {
              setToastMessage('Profile visibility updated');
            }}
          />
          <SettingsRow
            icon="server-outline"
            iconBgColor="#64748B"
            label="Clear Image Cache"
            value={cacheSize}
            isLast
            onPress={handleClearCache}
          />
        </View>

        {/* ─── Section 4: About & App Info ─────────────────────────────────────── */}
        <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>ABOUT</Text>
        <View style={[styles.groupCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <SettingsRow
            icon="star"
            iconBgColor="#FFCC00"
            label="Rate Sift on the App Store"
            onPress={() => {
              safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              Alert.alert('Thank You!', 'We appreciate your support and design feedback.');
            }}
          />
          <SettingsRow
            icon="document-text"
            iconBgColor="#8E8E93"
            label="Terms of Service"
            onPress={() => {
              Alert.alert('Terms of Service', 'Standard terms apply for user-generated architecture and interior design content.');
            }}
          />
          <SettingsRow
            icon="shield"
            iconBgColor="#007AFF"
            label="Privacy Policy"
            onPress={() => {
              Alert.alert('Privacy Policy', 'Your personal data is encrypted and never sold to third parties.');
            }}
          />
          <SettingsRow
            icon="information-circle"
            iconBgColor="#8E8E93"
            label="App Version"
            value="v1.2.0 (Build 384)"
            isLast
            onPress={() => {
              Alert.alert('Sift for Mobile', 'Version 1.2.0 (Build 384)\nMade with ❤️ for Architects & Interior Designers.');
            }}
          />
        </View>

        {/* ─── Section 5: Account Actions (Danger Zone) ────────────────────────── */}
        <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>SESSION</Text>
        <View style={[styles.groupCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <SettingsRow
            icon="log-out"
            iconBgColor="#EF4444"
            label="Log Out"
            isDestructive
            onPress={handleLogout}
          />
          <SettingsRow
            icon="trash"
            iconBgColor="#DC2626"
            label="Delete Account"
            isDestructive
            isLast
            onPress={handleDeleteAccount}
          />
        </View>

        {/* Footer Brand Info */}
        <View style={styles.footerContainer}>
          <Text style={styles.footerBrand}>SIFT</Text>
          <Text style={styles.footerCopyright}>
            Visual Discovery Engine • Made in India 🇮🇳
          </Text>
        </View>
      </ScrollView>

      {/* ─── Vernacular / Language Selector Modal ────────────────────────────── */}
      <Modal
        visible={isLanguageModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsLanguageModalVisible(false)}
      >
        <View style={styles.langModalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setIsLanguageModalVisible(false)}
          />

          <View
            style={[
              styles.langModalCard,
              { paddingBottom: Math.max(insets.bottom, 20) + 10 },
            ]}
          >
            <View style={styles.langModalHeader}>
              <Text style={styles.langModalTitle}>Select Language / भाषा</Text>
              <Pressable
                onPress={() => setIsLanguageModalVisible(false)}
                hitSlop={10}
                style={styles.langModalCloseButton}
              >
                <Ionicons name="close" size={20} color="#4B5563" />
              </Pressable>
            </View>

            <ScrollView style={styles.langList} bounces={false}>
              {INDIAN_LANGUAGES.map((lang, index) => {
                const isSelected = selectedLanguage.code === lang.code;
                return (
                  <Pressable
                    key={`lang-${lang.code}`}
                    onPress={() => {
                      safeHaptics.selectionAsync();
                      setSelectedLanguage(lang);
                      setIsLanguageModalVisible(false);
                      setToastMessage(`Language changed to ${lang.name}`);
                    }}
                    style={({ pressed }) => [
                      styles.langOptionItem,
                      index === INDIAN_LANGUAGES.length - 1 && styles.langOptionLast,
                      pressed && styles.langOptionPressed,
                    ]}
                  >
                    <View>
                      <Text style={[styles.langNativeName, isSelected && styles.langTextSelected]}>
                        {lang.nativeName}
                      </Text>
                      <Text style={styles.langEnglishName}>{lang.name}</Text>
                    </View>

                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={22} color="#111827" />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── Edit Profile Modal ──────────────────────────────────────────────── */}
      <EditProfileModal
        visible={isEditModalVisible}
        currentUsername={currentUser.username}
        currentFullName={currentUser.fullName}
        currentPhone={currentUser.phone}
        currentBio={currentUser.bio}
        currentAvatar={currentUser.avatar}
        onClose={() => setIsEditModalVisible(false)}
        onSave={async (data) => {
          await updateProfile(data);
          setToastMessage('Profile updated successfully');
        }}
      />

      {/* Feedback Toast */}
      <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7', // Native iOS grouped background
  },
  navBar: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: -4,
  },
  backButtonText: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '600',
    marginLeft: 2,
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.3,
  },
  navRightPlaceholder: {
    width: 60,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  profileCardPressed: {
    opacity: 0.85,
  },
  profileAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#E5E7EB',
    marginRight: 14,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  profileUsername: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6E6E73',
    letterSpacing: 0.4,
    marginBottom: 8,
    marginLeft: 12,
  },
  groupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  rowContainer: {
    backgroundColor: '#FFFFFF',
  },
  rowPressed: {
    backgroundColor: '#F3F4F6',
  },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
  },
  iconBox: {
    width: 30,
    height: 30,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingRight: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  rowBodyLast: {
    borderBottomWidth: 0,
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  destructiveLabel: {
    color: '#EF4444',
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowValue: {
    fontSize: 15,
    color: '#8E8E93',
  },
  chevron: {
    marginLeft: 2,
  },
  footerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 4,
  },
  footerBrand: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2,
    color: '#9CA3AF',
  },
  footerCopyright: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  langModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  langModalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    paddingHorizontal: 20,
    maxHeight: '75%',
  },
  langModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  langModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  langModalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  langList: {
    paddingVertical: 8,
  },
  langOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  langOptionLast: {
    borderBottomWidth: 0,
  },
  langOptionPressed: {
    backgroundColor: '#F9FAFB',
  },
  langNativeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  langEnglishName: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  langTextSelected: {
    fontWeight: '700',
    color: '#111827',
  },
});

