import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import {
  savePostApi,
  unsavePostApi,
  getUserSavesApi,
  setAuthToken,
  getStoredAuthToken,
  setStoredUser,
  getStoredUser,
  updateUserApi,
  followUserApi,
  markNotificationsReadApi,
} from '../api';

const FOLLOWING_STORAGE_KEY = 'sift_following_ids';

export interface User {
  id: string;
  username: string;
  fullName?: string | null;
  avatar?: string | null;
  phone?: string;
  email?: string | null;
  bio?: string | null;
  followersCount?: number;
  followingCount?: number;
}

export const DEFAULT_USER: User = {
  id: 'cmvwiqmw20000macy9j8k6gwr',
  username: 'studioarchi',
  fullName: 'Elena Rostova',
  avatar:
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
  phone: '+919876543210',
  email: 'elena@sift.design',
  bio: 'Spatial designer & aesthetic curator.',
  followersCount: 1240,
  followingCount: 38,
};

interface AuthContextType {
  currentUser: User;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (updates: {
    username?: string;
    fullName?: string;
    phone?: string;
    bio?: string;
    avatar?: string;
    followersCount?: number;
    followingCount?: number;
  }) => Promise<void>;
  savedPostIds: Set<string>;
  isPostSaved: (postId: string) => boolean;
  toggleSave: (postId: string) => Promise<boolean>;
  refreshSaves: () => Promise<void>;
  isLoadingSaves: boolean;
  followingUserIds: Set<string>;
  followingCount: number;
  isFollowingUser: (userId: string) => boolean;
  toggleFollowUser: (userId: string) => Promise<boolean>;
  hasUnreadNotifications: boolean;
  setHasUnreadNotifications: (val: boolean) => void;
  markNotificationsRead: () => Promise<void>;
}


const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User>(DEFAULT_USER);
  const [token, setToken] = useState<string | null>(null);
  const [savedPostIds, setSavedPostIds] = useState<Set<string>>(new Set());
  const [followingUserIds, setFollowingUserIds] = useState<Set<string>>(new Set());
  const [isLoadingSaves, setIsLoadingSaves] = useState(true);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(true);

  // Helper to persist followed creator IDs
  const persistFollowing = async (ids: Set<string>) => {
    try {
      const json = JSON.stringify(Array.from(ids));
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(FOLLOWING_STORAGE_KEY, json);
        }
      } else {
        await SecureStore.setItemAsync(FOLLOWING_STORAGE_KEY, json);
      }
    } catch (e) {
      console.warn('Failed to persist following IDs:', e);
    }
  };

  // Initialize stored token, user, and following list on startup
  useEffect(() => {
    async function initAuth() {
      try {
        const [storedToken, storedUser] = await Promise.all([
          getStoredAuthToken(),
          getStoredUser(),
        ]);
        if (storedToken) {
          setToken(storedToken);
        }
        if (storedUser) {
          setCurrentUser(storedUser);
        }

        let rawFollowing: string | null = null;
        if (Platform.OS === 'web') {
          if (typeof window !== 'undefined' && window.localStorage) {
            rawFollowing = window.localStorage.getItem(FOLLOWING_STORAGE_KEY);
          }
        } else {
          rawFollowing = await SecureStore.getItemAsync(FOLLOWING_STORAGE_KEY);
        }
        if (rawFollowing) {
          const parsed = JSON.parse(rawFollowing);
          if (Array.isArray(parsed)) {
            setFollowingUserIds(new Set(parsed));
          }
        }
      } catch (err) {
        console.warn('Failed to restore auth session:', err);
      }
    }
    initAuth();
  }, []);

  // Fetch initial saved posts for currently authenticated user from backend
  const refreshSaves = useCallback(async () => {
    try {
      setIsLoadingSaves(true);
      const res = await getUserSavesApi(currentUser.id);
      if (res.success && Array.isArray(res.data)) {
        const ids = new Set<string>(res.data.map((item) => item.postId));
        setSavedPostIds(ids);
      }
    } catch (error) {
      console.warn('Could not load user saves from backend:', error);
    } finally {
      setIsLoadingSaves(false);
    }
  }, [currentUser.id]);

  useEffect(() => {
    if (currentUser?.id) {
      refreshSaves();
    }
  }, [currentUser?.id, refreshSaves]);

  const login = useCallback(async (newToken: string, newUser: User) => {
    await Promise.all([
      setAuthToken(newToken),
      setStoredUser(newUser),
    ]);
    setToken(newToken);
    setCurrentUser(newUser);
  }, []);

  const logout = useCallback(async () => {
    await Promise.all([
      setAuthToken(null),
      setStoredUser(null),
    ]);
    setToken(null);
    setCurrentUser(DEFAULT_USER);
    setSavedPostIds(new Set());
    setFollowingUserIds(new Set());
  }, []);


  const updateProfile = useCallback(
    async (updates: {
      username?: string;
      fullName?: string;
      phone?: string;
      bio?: string;
      avatar?: string;
      followersCount?: number;
    }): Promise<void> => {
      const updatedUser: User = {
        ...currentUser,
        ...(updates.username ? { username: updates.username.trim() } : {}),
        ...(updates.fullName !== undefined ? { fullName: updates.fullName?.trim() } : {}),
        ...(updates.phone !== undefined ? { phone: updates.phone?.trim() } : {}),
        ...(updates.bio !== undefined ? { bio: updates.bio?.trim() } : {}),
        ...(updates.avatar !== undefined ? { avatar: updates.avatar } : {}),
        ...(updates.followersCount !== undefined ? { followersCount: updates.followersCount } : {}),
      };

      // Previous state backup for rollback
      const previousUser = currentUser;

      // 1. Optimistic state & local storage update
      setCurrentUser(updatedUser);
      await setStoredUser(updatedUser);

      // 2. Real backend PATCH request
      try {
        if (currentUser.id) {
          const res = await updateUserApi(currentUser.id, {
            username: updates.username?.trim(),
            fullName: updates.fullName?.trim(),
            phone: updates.phone?.trim(),
            bio: updates.bio?.trim(),
            avatar: updates.avatar,
            followersCount: updates.followersCount,
          });
          if (res?.data) {
            const confirmedUser: User = {
              ...updatedUser,
              username: res.data.username || updatedUser.username,
              fullName: res.data.fullName ?? updatedUser.fullName,
              phone: res.data.phone || updatedUser.phone,
              bio: res.data.bio ?? updatedUser.bio,
              avatar: res.data.avatar ?? updatedUser.avatar,
              followersCount: res.data.followersCount ?? updatedUser.followersCount,
            };
            setCurrentUser(confirmedUser);
            await setStoredUser(confirmedUser);
          }
        }
      } catch (error: any) {
        // Rollback on conflict or failure
        setCurrentUser(previousUser);
        await setStoredUser(previousUser);
        console.warn('Backend update failed, rolled back profile update:', error?.response?.data || error);
        throw error;
      }
    },
    [currentUser]
  );

  const isPostSaved = useCallback(
    (postId: string) => savedPostIds.has(postId),
    [savedPostIds]
  );

  /**
   * Optimistically toggles save state:
   * 1. Updates UI state synchronously.
   * 2. Makes real POST / DELETE request to backend.
   * 3. Rolls back state if network request fails.
   */
  const toggleSave = useCallback(
    async (postId: string): Promise<boolean> => {
      const willSave = !savedPostIds.has(postId);

      // ─── 1. OPTIMISTIC UPDATE ───────────────────────────────────────────────
      setSavedPostIds((prev) => {
        const next = new Set(prev);
        if (willSave) {
          next.add(postId);
        } else {
          next.delete(postId);
        }
        return next;
      });

      // ─── 2. REAL BACKEND REQUEST ────────────────────────────────────────────
      try {
        if (willSave) {
          await savePostApi(currentUser.id, postId);
        } else {
          await unsavePostApi(currentUser.id, postId);
        }
        return willSave;
      } catch (error) {
        console.error('Save request failed, rolling back optimistic state:', error);

        // ─── 3. ROLLBACK ON FAILURE ───────────────────────────────────────────
        setSavedPostIds((prev) => {
          const rollback = new Set(prev);
          if (willSave) {
            rollback.delete(postId);
          } else {
            rollback.add(postId);
          }
          return rollback;
        });

        throw error;
      }
    },
    [currentUser.id, savedPostIds]
  );

  const isFollowingUser = useCallback(
    (userId: string) => followingUserIds.has(userId),
    [followingUserIds]
  );

  /**
   * Optimistically toggles follow state:
   * 1. Updates local followingUserIds Set and increments/decrements followingCount.
   * 2. Calls POST /api/users/:id/follow on backend.
   * 3. Persists to SecureStore / localStorage.
   */
  const toggleFollowUser = useCallback(
    async (userId: string): Promise<boolean> => {
      const willFollow = !followingUserIds.has(userId);

      // ─── 1. OPTIMISTIC UPDATE ─────────────────────────────────────────────
      setFollowingUserIds((prev) => {
        const next = new Set(prev);
        if (willFollow) {
          next.add(userId);
        } else {
          next.delete(userId);
        }
        persistFollowing(next);
        return next;
      });

      setCurrentUser((prev) => {
        const newCount = Math.max(0, (prev.followingCount ?? 38) + (willFollow ? 1 : -1));
        const updated = { ...prev, followingCount: newCount };
        setStoredUser(updated);
        return updated;
      });

      // ─── 2. REAL BACKEND REQUEST ──────────────────────────────────────────
      try {
        await followUserApi(userId, willFollow ? 'follow' : 'unfollow');
        return willFollow;
      } catch (error) {
        console.warn('Backend follow request failed, maintaining optimistic follow state:', error);
        return willFollow;
      }
    },
    [followingUserIds]
  );

  const markNotificationsRead = useCallback(async () => {
    setHasUnreadNotifications(false);
    try {
      await markNotificationsReadApi();
    } catch (e) {
      console.warn('Failed to mark notifications read:', e);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        token,
        isAuthenticated: !!token,
        login,
        logout,
        updateProfile,
        savedPostIds,
        isPostSaved,
        toggleSave,
        refreshSaves,
        isLoadingSaves,
        followingUserIds,
        followingCount: currentUser.followingCount ?? 38,
        isFollowingUser,
        toggleFollowUser,
        hasUnreadNotifications,
        setHasUnreadNotifications,
        markNotificationsRead,
      }}
    >
      {children}
    </AuthContext.Provider>
  );

};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
