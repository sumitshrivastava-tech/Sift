import axios from 'axios';
import { Platform } from 'react-native';

/**
 * Default base URL for backend:
 * - Android Emulator uses 10.0.2.2 to reach host machine localhost
 * - iOS Simulator and Web use localhost (127.0.0.1)
 * - Physical devices can override using EXPO_PUBLIC_API_URL env variable
 */
const DEFAULT_BASE_URL =
  Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || DEFAULT_BASE_URL;

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

/**
 * Robust JSON parser for SQLite/stringified array columns (e.g. images, tags)
 * Handles both stringified JSON '["..."]' and pre-parsed arrays cleanly.
 */
export function parseArrayField(field: unknown): string[] {
  if (Array.isArray(field)) {
    return field.filter((item): item is string => typeof item === 'string');
  }
  if (typeof field === 'string') {
    const trimmed = field.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === 'string');
      }
      return [trimmed];
    } catch {
      // In case of comma-separated string or bare string
      if (trimmed.includes(',')) {
        return trimmed.split(',').map((s) => s.trim()).filter(Boolean);
      }
      return [trimmed];
    }
  }
  return [];
}

export interface BackendAuthor {
  id: string;
  username: string;
  avatar: string | null;
}

export interface BackendPostRaw {
  id: string;
  title: string;
  content?: string;
  images: string | string[];
  tags: string | string[];
  createdAt?: string;
  updatedAt?: string;
  authorId?: string;
  author?: BackendAuthor;
  _count?: {
    saves?: number;
  };
}

export interface FeedResponse {
  success?: boolean;
  data: BackendPostRaw[];
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export default api;

