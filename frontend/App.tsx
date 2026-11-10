import './global.css';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { SplashScreen } from './src/screens/SplashScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { MainTabNavigator } from './src/navigation/MainTabNavigator';
import { PostDetailScreen } from './src/screens/PostDetailScreen';
import { PublicCreatorProfileScreen } from './src/screens/PublicCreatorProfileScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { NotificationsScreen } from './src/screens/NotificationsScreen';
import { CreatePostScreen } from './src/screens/CreatePostScreen';
import { RootStackParamList } from './src/types/navigation';
import { AuthProvider } from './src/context/AuthContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';

const Stack = createNativeStackNavigator<RootStackParamList>();

function AppNavigator() {
  const { colors, isDark } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Splash"
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
            animation: 'slide_from_right',
          }}
        >
          {/* Performant 60fps Splash / Onboarding Animation Screen */}
          <Stack.Screen name="Splash" component={SplashScreen} />

          {/* Authentication flow */}
          <Stack.Screen name="Auth" component={AuthScreen} />

          {/* First-time User Onboarding Profile Screen */}
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />

          {/* Modal Compose Screen for Creating Drops */}
          <Stack.Screen
            name="CreatePost"
            component={CreatePostScreen}
            options={{
              presentation: 'modal',
              animation: 'slide_from_bottom',
              headerShown: false,
            }}
          />

          {/* Main Application with 5-tab bottom navigation */}
          <Stack.Screen name="MainTabs" component={MainTabNavigator} />

          {/* Backwards compatibility alias for Home -> MainTabs */}
          <Stack.Screen name="Home" component={MainTabNavigator} />

          {/* Detail screen pushed on top of the tab bar (hides the tab bar) */}
          <Stack.Screen
            name="PostDetail"
            component={PostDetailScreen}
            options={{
              animation: 'slide_from_right',
            }}
          />

          {/* Public Creator Profile Screen */}
          <Stack.Screen
            name="PublicCreatorProfile"
            component={PublicCreatorProfileScreen}
            options={{
              animation: 'slide_from_right',
            }}
          />

          {/* Dedicated iOS-styled Settings Screen */}
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{
              animation: 'slide_from_right',
            }}
          />

          {/* Notifications Hub Screen */}
          <Stack.Screen
            name="Notifications"
            component={NotificationsScreen}
            options={{
              animation: 'slide_from_right',
            }}
          />

          {/* Activity Feed Alias */}
          <Stack.Screen
            name="Activity"
            component={NotificationsScreen}
            options={{
              animation: 'slide_from_right',
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider style={styles.container}>
      <ThemeProvider>
        <AuthProvider>
          <AppNavigator />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
