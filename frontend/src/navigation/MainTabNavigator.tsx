import React from 'react';
import { View, StyleSheet, Pressable, Platform, Text, Alert } from 'react-native';
import { createBottomTabNavigator, BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
} from 'react-native-reanimated';
import { safeHaptics, Haptics } from '../utils/haptics';

import { MainTabParamList } from '../types/navigation';
import { HomeScreen } from '../screens/HomeScreen';
import { SearchScreen } from '../screens/SearchScreen';
import { CreatePostScreen } from '../screens/CreatePostScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { useTheme, ACCENT_COLOR } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

const Tab = createBottomTabNavigator<MainTabParamList>();

/**
 * Custom prominent circular button for the 'Create' tab.
 * Lemon8 aesthetic: central "+" action button styled with global accent color (#FF5C5C)
 * When tapped: checks permissions, launches image picker with 4:5 aspect ratio & quality: 0.7,
 * and immediately slides up the Compose Screen.
 */
const CreateTabBarButton: React.FC<BottomTabBarButtonProps> = () => {
  const { isDark } = useTheme();
  const navigation = useNavigation<any>();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = async () => {
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // 60FPS spring micro-interaction
    scale.value = withSequence(
      withSpring(0.88, { damping: 10, stiffness: 350 }),
      withSpring(1, { damping: 14, stiffness: 220 })
    );

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Photo Library Access Required',
          'Please allow media library access to select architectural photos for your drop.'
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

        navigation.navigate('CreatePost', {
          imageUri: asset.uri,
          imageBase64: asset.base64,
          width: asset.width,
          height: asset.height,
        });
      }
    } catch (err) {
      console.warn('Image picker error on central + tap:', err);
      navigation.navigate('CreatePost');
    }
  };

  return (
    <View style={styles.createButtonWrapper}>
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          styles.createButtonContainer,
          pressed && styles.createButtonPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Create Post"
      >
        <Animated.View
          style={[
            styles.createButtonInner,
            { backgroundColor: ACCENT_COLOR },
            animatedStyle,
          ]}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </Animated.View>
      </Pressable>
    </View>
  );
};

export const MainTabNavigator: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { hasUnreadNotifications } = useAuth();

  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: colors.activeTab,
        tabBarInactiveTintColor: colors.inactiveTab,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarStyle: [
          styles.tabBar,
          {
            backgroundColor: colors.tabBar,
            borderTopColor: colors.tabBarBorder,
            height: Platform.OS === 'ios' ? 56 + insets.bottom : 64,
            paddingBottom: Platform.OS === 'ios' ? insets.bottom : 8,
            paddingTop: 6,
          },
        ],
      }}
    >
      {/* 1. Home */}
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              size={size - 1}
              color={color}
            />
          ),
        }}
      />

      {/* 2. Search */}
      <Tab.Screen
        name="Search"
        component={SearchScreen}
        options={{
          tabBarLabel: 'Search',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? 'search' : 'search-outline'}
              size={size - 1}
              color={color}
            />
          ),
        }}
      />

      {/* 3. Create (Prominent Central "+" Button with Global Accent Color) */}
      <Tab.Screen
        name="Create"
        component={CreatePostScreen}
        options={{
          tabBarLabel: () => null, // Hidden label for distinct prominent button
          tabBarButton: (props) => <CreateTabBarButton {...props} />,
        }}
      />

      {/* 4. Notifications (Bell Icon replacing old Shopping Cart) */}
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          tabBarLabel: 'Inbox',
          tabBarIcon: ({ focused, color, size }) => (
            <View style={styles.iconWithBadgeWrapper}>
              <Ionicons
                name={focused ? 'notifications' : 'notifications-outline'}
                size={size - 1}
                color={color}
              />
              {/* Unread activity indicator dot */}
              {hasUnreadNotifications && (
                <View
                  style={[
                    styles.unreadBadgeDot,
                    { backgroundColor: ACCENT_COLOR, borderColor: colors.tabBar },
                  ]}
                />
              )}
            </View>
          ),
        }}
      />

      {/* 5. Profile */}
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? 'person' : 'person-outline'}
              size={size - 1}
              color={color}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 8,
  },
  tabBarLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    marginTop: -2,
  },
  createButtonWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -4,
  },
  createButtonContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButtonPressed: {
    opacity: 0.9,
  },
  createButtonInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ACCENT_COLOR,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
  },
  iconWithBadgeWrapper: {
    position: 'relative',
  },
  unreadBadgeDot: {
    position: 'absolute',
    top: -1,
    right: -2,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    borderWidth: 1.5,
  },
});
