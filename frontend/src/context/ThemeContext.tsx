import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';

export const ACCENT_COLOR = '#FF5C5C'; // Lemon8-inspired vibrant coral/red

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceMuted: string;
  card: string;
  cardBorder: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentLight: string;
  border: string;
  tabBar: string;
  tabBarBorder: string;
  activeTab: string;
  inactiveTab: string;
  heartActive: string;
  heartInactive: string;
  modalBackground: string;
  badgeBackground: string;
}

export const LIGHT_THEME: ThemeColors = {
  background: '#FFFFFF',
  surface: '#F9FAFB',
  surfaceMuted: '#F3F4F6',
  card: '#FFFFFF',
  cardBorder: '#F3F4F6',
  text: '#111827',
  textSecondary: '#4B5563',
  textMuted: '#9CA3AF',
  accent: ACCENT_COLOR,
  accentLight: '#FFF1F1',
  border: '#E5E7EB',
  tabBar: '#FFFFFF',
  tabBarBorder: '#E5E7EB',
  activeTab: '#111827',
  inactiveTab: '#9CA3AF',
  heartActive: ACCENT_COLOR,
  heartInactive: '#6B7280',
  modalBackground: '#FFFFFF',
  badgeBackground: 'rgba(0, 0, 0, 0.65)',
};

export const DARK_THEME: ThemeColors = {
  background: '#121212', // Deep architectural slate-grey
  surface: '#1A1A1A',
  surfaceMuted: '#242424',
  card: '#1A1A1A',
  cardBorder: '#262626',
  text: '#F9FAFB', // Off-white to prevent eye strain
  textSecondary: '#D1D5DB',
  textMuted: '#6B7280',
  accent: ACCENT_COLOR,
  accentLight: '#2D1616',
  border: '#262626',
  tabBar: '#161616',
  tabBarBorder: '#242424',
  activeTab: '#FFFFFF',
  inactiveTab: '#737373',
  heartActive: ACCENT_COLOR,
  heartInactive: '#9CA3AF',
  modalBackground: '#1C1C1E',
  badgeBackground: 'rgba(26, 26, 26, 0.85)',
};

interface ThemeContextType {
  isDark: boolean;
  colors: ThemeColors;
  toggleTheme: () => void;
  setDarkMode: (value: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemScheme = useColorScheme();
  const [isDark, setIsDark] = useState<boolean>(systemScheme === 'dark');

  const toggleTheme = () => setIsDark((prev) => !prev);
  const setDarkMode = (val: boolean) => setIsDark(val);

  const colors = useMemo(() => (isDark ? DARK_THEME : LIGHT_THEME), [isDark]);

  return (
    <ThemeContext.Provider value={{ isDark, colors, toggleTheme, setDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

