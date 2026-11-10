import axios, { InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// ─── Axios Instance ───────────────────────────────────────────────────────────

export const API_BASE_URL = 'https://sift-backend-i6cr.onrender.com';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60_000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// ─── Secure Token & User Storage & Axios Interceptor ─────────────────────────

export const TOKEN_STORAGE_KEY = 'sift_jwt_token';
export const USER_STORAGE_KEY = 'sift_current_user';
let cachedToken: string | null = null;
let cachedUser: any | null = null;

export async function setStoredUser(user: any | null): Promise<void> {
  cachedUser = user;
  try {
    if (user) {
      const json = JSON.stringify(user);
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(USER_STORAGE_KEY, json);
        }
      } else {
        await SecureStore.setItemAsync(USER_STORAGE_KEY, json);
      }
    } else {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(USER_STORAGE_KEY);
        }
      } else {
        await SecureStore.deleteItemAsync(USER_STORAGE_KEY);
      }
    }
  } catch (error) {
    console.warn('[SecureStore] Failed to persist user:', error);
  }
}

export async function getStoredUser(): Promise<any | null> {
  if (cachedUser) return cachedUser;
  try {
    let json: string | null = null;
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        json = window.localStorage.getItem(USER_STORAGE_KEY);
      }
    } else {
      json = await SecureStore.getItemAsync(USER_STORAGE_KEY);
    }
    if (json) {
      cachedUser = JSON.parse(json);
      return cachedUser;
    }
    return null;
  } catch (error) {
    console.warn('[SecureStore] Failed to retrieve user:', error);
    return null;
  }
}

/**
 * Saves or clears the JWT token in secure storage and updates the Axios default header.
 */
export async function setAuthToken(token: string | null): Promise<void> {
  cachedToken = token;
  try {
    if (token) {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
        }
      } else {
        await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, token);
      }
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(TOKEN_STORAGE_KEY);
        }
      } else {
        await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);
      }
      delete api.defaults.headers.common['Authorization'];
    }
  } catch (error) {
    console.warn('[SecureStore] Failed to persist auth token:', error);
  }
}

/**
 * Retrieves the stored JWT token (from cache or SecureStore).
 */
export async function getStoredAuthToken(): Promise<string | null> {
  if (cachedToken) {
    return cachedToken;
  }

  try {
    let token: string | null = null;
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        token = window.localStorage.getItem(TOKEN_STORAGE_KEY);
      }
    } else {
      token = await SecureStore.getItemAsync(TOKEN_STORAGE_KEY);
    }

    if (token) {
      cachedToken = token;
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    return token;
  } catch (error) {
    console.warn('[SecureStore] Failed to retrieve auth token:', error);
    return null;
  }
}

// Attach Authorization Bearer token to every outgoing request via interceptor
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = cachedToken || (await getStoredAuthToken());
    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Auth API Types & Endpoints ───────────────────────────────────────────────

export interface SendOtpPayload {
  phone: string;
}

export interface SendOtpResponse {
  success: boolean;
  message: string;
  data: {
    phone: string;
    expiresInSeconds: number;
    previewCode?: string;
  };
}

export interface VerifyOtpPayload {
  phone: string;
  code: string;
}

export interface AuthUserData {
  id: string;
  username: string;
  phone: string;
  avatar: string | null;
}

export interface VerifyOtpResponse {
  success: boolean;
  message: string;
  data: {
    token: string;
    isNewUser: boolean;
    user: AuthUserData;
  };
}

/**
 * POST /api/auth/send-otp
 * Triggers a 4-digit code generation on backend and logs mock SMS.
 */
export async function sendOtpApi(phone: string): Promise<SendOtpResponse> {
  const { data } = await api.post<SendOtpResponse>('/api/auth/send-otp', { phone });
  return data;
}

/**
 * POST /api/auth/verify-otp
 * Validates the 4-digit code and issues the JWT token.
 */
export async function verifyOtpApi(phone: string, code: string): Promise<VerifyOtpResponse> {
  const { data } = await api.post<VerifyOtpResponse>('/api/auth/verify-otp', { phone, code });
  return data;
}

export interface EmailAuthResponse {
  success: boolean;
  message: string;
  data: {
    token: string;
    isNewUser: boolean;
    user: AuthUserData;
  };
}

/**
 * POST /api/auth/email-login
 * Signs in or creates an account with email and password.
 */
export async function emailLoginApi(
  email: string,
  password: string,
  isSignUp = false
): Promise<EmailAuthResponse> {
  const { data } = await api.post<EmailAuthResponse>('/api/auth/email-login', {
    email,
    password,
    isSignUp,
  });
  return data;
}

/**
 * POST /api/auth/forgot-password
 * Sends password reset instructions.
 */
export async function forgotPasswordApi(email: string): Promise<{ success: boolean; message: string }> {
  const { data } = await api.post<{ success: boolean; message: string }>('/api/auth/forgot-password', {
    email,
  });
  return data;
}

// ─── Backend Post & Feed Response Types ────────────────────────────────────────

/** Matches the `author` sub-object returned by the API. */
export interface ApiAuthor {
  id: string;
  username: string;
  fullName?: string | null;
  avatar: string | null;
}

/** Raw post shape returned by GET /api/posts/feed.
 *  `images` and `tags` arrive as JSON strings from SQLite. */
export interface ApiPost {
  id: string;
  title: string;
  content: string;
  /** JSON string or array e.g. '["https://...","https://..."]' */
  images: string | string[];
  /** JSON string or array e.g. '["travel","food"]' */
  tags: string | string[];
  sourceTags?: string | any[];
  authorId: string;
  author: ApiAuthor;
  likesCount?: number;
  createdAt: string;
  updatedAt: string;
  _count: {
    saves: number;
    comments?: number;
    likes?: number;
  };
}


export interface FeedMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface FeedResponse {
  success: boolean;
  data: ApiPost[];
  meta: FeedMeta;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Safely parses a JSON string into a string array.
 * Returns an empty array on any parse failure.
 */
export function parseJsonArray(raw: string | string[]): string[] {
  if (Array.isArray(raw)) return raw; // already parsed upstream
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ─── Feed & Post API Functions ────────────────────────────────────────────────

export interface GetFeedParams {
  page?: number;
  limit?: number;
  tag?: string;
  q?: string;
  authorId?: string;
  authorIds?: string;
}

/**
 * GET /api/posts/feed
 * Returns paginated posts ordered by most saves.
 */
export async function getFeed(params: GetFeedParams = {}): Promise<FeedResponse> {
  const { data } = await api.get<FeedResponse>('/api/posts/feed', { params });
  return data;
}

/**
 * GET /api/posts/following
 * Returns posts created by authors the current user follows from the live database.
 */
export async function getFollowingFeedApi(params: GetFeedParams = {}): Promise<FeedResponse> {
  try {
    const { data } = await api.get<FeedResponse>('/api/posts/following', { params });
    return data;
  } catch {
    // Graceful fallback to feed with authorIds filter
    const { data } = await api.get<FeedResponse>('/api/posts/feed', { params });
    return data;
  }
}

export interface PostDetailResponse {
  success: boolean;
  data: ApiPost;
}

/**
 * GET /api/posts/:id
 * Returns a single post by ID.
 */
export async function getPostById(id: string): Promise<PostDetailResponse> {
  const { data } = await api.get<PostDetailResponse>(`/api/posts/${id}`);
  return data;
}

export interface RelatedPostsResponse {
  success: boolean;
  data: ApiPost[];
}

/**
 * GET /api/posts/:id/related
 * Fetches related posts sharing tags/category, sorted by engagement score (Infinite Rabbit Hole).
 */
export async function getRelatedPostsApi(
  postId: string,
  limit = 10
): Promise<RelatedPostsResponse> {
  const { data } = await api.get<RelatedPostsResponse>(`/api/posts/${postId}/related`, {
    params: { limit },
  });
  return data;
}

/**
 * POST /api/saves
 * Saves a post for a user.
 */
export async function savePostApi(userId: string, postId: string): Promise<{ success: boolean }> {
  const { data } = await api.post('/api/saves', { userId, postId });
  return data;
}

/**
 * DELETE /api/saves
 * Unsaves a post for a user.
 */
export async function unsavePostApi(userId: string, postId: string): Promise<{ success: boolean }> {
  const { data } = await api.delete('/api/saves', { data: { userId, postId } });
  return data;
}

export interface UserSaveRecord {
  id: string;
  userId: string;
  postId: string;
  createdAt: string;
  post: ApiPost;
}

export interface UserSavesResponse {
  success: boolean;
  data: UserSaveRecord[];
}

/**
 * GET /api/saves/user/:userId
 * Returns all saved posts for a given user.
 */
export async function getUserSavesApi(userId: string): Promise<UserSavesResponse> {
  const { data } = await api.get<UserSavesResponse>(`/api/saves/user/${userId}`);
  return data;
}

// ─── Comments API & Types ───────────────────────────────────────────────────

export interface ApiCommentAuthor {
  id: string;
  username: string;
  avatar: string | null;
}

export interface ApiComment {
  id: string;
  content: string;
  postId: string;
  authorId: string;
  createdAt: string;
  updatedAt?: string;
  author: ApiCommentAuthor;
}

export interface CommentsResponse {
  success: boolean;
  data: ApiComment[];
}

export interface CreateCommentResponse {
  success: boolean;
  message?: string;
  data: ApiComment;
}

/**
 * GET /api/posts/:postId/comments
 * Fetches all comments for a post in chronological order.
 */
export async function getCommentsApi(postId: string): Promise<CommentsResponse> {
  const { data } = await api.get<CommentsResponse>(`/api/posts/${postId}/comments`);
  return data;
}

/**
 * POST /api/posts/:postId/comments
 * Posts a new comment to a post.
 */
export async function createCommentApi(
  postId: string,
  content: string,
  authorId?: string
): Promise<CreateCommentResponse> {
  const { data } = await api.post<CreateCommentResponse>(`/api/posts/${postId}/comments`, {
    content,
    postId,
    authorId,
  });
  return data;
}

/**
 * POST /api/comments/:commentId/like
 * Toggles like / reaction on a comment.
 */
export async function toggleCommentLikeApi(
  commentId: string
): Promise<{ success: boolean; data?: any }> {
  try {
    const { data } = await api.post(`/api/comments/${commentId}/like`);
    return data;
  } catch {
    // Graceful fallback for optimistic client UI
    return { success: true };
  }
}

// ─── User Profile API ────────────────────────────────────────────────────────

export interface CheckUsernameResponse {
  success: boolean;
  data: {
    username: string;
    available: boolean;
  };
}

/**
 * GET /api/users/check-username/:username
 * Live check whether a username is available.
 */
export async function checkUsernameAvailableApi(
  username: string,
  excludeUserId?: string
): Promise<CheckUsernameResponse> {
  const { data } = await api.get<CheckUsernameResponse>(
    `/api/users/check-username/${encodeURIComponent(username.trim().toLowerCase())}`,
    { params: excludeUserId ? { excludeUserId } : undefined }
  );
  return data;
}

export interface UpdateUserData {
  username?: string;
  fullName?: string;
  phone?: string;
  bio?: string;
  avatar?: string;
  followersCount?: number;
}

export interface UpdateUserResponse {
  success: boolean;
  message?: string;
  data: {
    id: string;
    username: string;
    fullName?: string | null;
    phone: string;
    avatar: string | null;
    bio: string | null;
    followersCount?: number;
    createdAt: string;
  };
}

/**
 * PATCH /api/users/:id
 * Updates user profile details (username, bio, avatar).
 */
export async function updateUserApi(
  id: string,
  updates: UpdateUserData
): Promise<UpdateUserResponse> {
  const { data } = await api.patch<UpdateUserResponse>(`/api/users/${id}`, updates);
  return data;
}

// ─── Visual Search API ───────────────────────────────────────────────────────

export interface ApiVisualMatchPost extends ApiPost {
  isVisualMatch: true;
  similarityScore: number;
  matchReason?: string;
}

export interface VisualSearchApiResponse {
  success: boolean;
  message: string;
  data: ApiVisualMatchPost[];
  meta: {
    queryPreview?: string;
    totalMatches: number;
    confidence: number;
    model: string;
    dominantPalette: string[];
    detectedFeatures: string[];
  };
}

/**
 * POST /api/search/visual
 * Reverse Visual Search: Sends an image base64 or URL to retrieve aesthetically matched posts.
 */
export async function searchVisualApi(
  image: string,
  limit: number = 12
): Promise<VisualSearchApiResponse> {
  const { data } = await api.post<VisualSearchApiResponse>('/api/search/visual', {
    image,
    limit,
  });
  return data;
}

// ─── Collaborative Canvas Boards API ──────────────────────────────────────────

export interface BoardCollaboratorUser {
  id: string;
  username: string;
  fullName?: string | null;
  avatar?: string | null;
}

export interface BoardCollaboratorItem {
  id: string;
  role: string;
  user: BoardCollaboratorUser;
}

export interface BoardSavePreview {
  post: {
    id: string;
    title: string;
    images: string;
  };
}

export interface BoardData {
  id: string;
  name: string;
  description?: string | null;
  isPrivate: boolean;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  owner: BoardCollaboratorUser;
  collaborators: BoardCollaboratorItem[];
  saves?: BoardSavePreview[];
  _count?: {
    saves: number;
    collaborators: number;
  };
}

export interface CreateBoardPayload {
  name: string;
  isPrivate?: boolean;
  description?: string;
  ownerId?: string;
}

export interface AddCollaboratorPayload {
  username: string;
  role?: string;
}

/**
 * POST /api/boards
 * Creates a new collaborative board.
 */
export async function createBoardApi(
  payload: CreateBoardPayload
): Promise<{ success: boolean; data: BoardData; message?: string }> {
  const { data } = await api.post('/api/boards', payload);
  return data;
}

/**
 * POST /api/boards/:id/collaborators
 * Invites a collaborator by their @username handle.
 */
export async function addCollaboratorApi(
  boardId: string,
  payload: AddCollaboratorPayload
): Promise<{ success: boolean; data: BoardCollaboratorItem; message?: string }> {
  const { data } = await api.post(`/api/boards/${boardId}/collaborators`, payload);
  return data;
}

/**
 * GET /api/boards/user/:userId
 * Retrieves all boards belonging to or shared with a user.
 */
export async function getUserBoardsApi(
  userId: string
): Promise<{ success: boolean; data: BoardData[] }> {
  const { data } = await api.get<{ success: boolean; data: BoardData[] }>(
    `/api/boards/user/${userId}`
  );
  return data;
}

/**
 * GET /api/boards/:id
 * Retrieves a single board by ID.
 */
export async function getBoardByIdApi(
  boardId: string
): Promise<{ success: boolean; data: BoardData }> {
  const { data } = await api.get<{ success: boolean; data: BoardData }>(
    `/api/boards/${boardId}`
  );
  return data;
}

/**
 * POST /api/saves (with board support)
 * Saves a post, optionally linking it directly into a specific board.
 */
export async function savePostToBoardApi(
  userId: string,
  postId: string,
  boardId?: string | null
): Promise<{ success: boolean; data?: any; message?: string }> {
  const { data } = await api.post('/api/saves', { userId, postId, boardId });
  return data;
}

/**
 * POST /api/users/:id/follow
 * Follow or unfollow a user.
 */
export async function followUserApi(
  targetUserId: string,
  action?: 'follow' | 'unfollow'
): Promise<{
  success: boolean;
  data: { isFollowing: boolean; followersCount: number };
  message?: string;
}> {
  const { data } = await api.post(`/api/users/${targetUserId}/follow`, { action });
  return data;
}

export interface CreatePostPayload {
  title?: string;
  content?: string;
  description?: string;
  imageUrl?: string;
  images?: string[];
  tags?: string[];
  sourceTags?: any[];
  authorId?: string;
  userId?: string;
}

export interface CreatePostResponse {
  success: boolean;
  message?: string;
  data: ApiPost;
}

/**
 * POST /api/posts
 * Publishes a new drop/post to the Sift feed.
 */
export async function createPostApi(payload: CreatePostPayload): Promise<CreatePostResponse> {
  const { data } = await api.post<CreatePostResponse>('/api/posts', payload);
  return data;
}

// ─── Notifications API ───────────────────────────────────────────────────────

export type NotificationCategory = 'ALL' | 'FOLLOWERS' | 'SAVES' | 'COMMENTS';

export interface ApiNotificationItem {
  id: string;
  type: 'NEW_FOLLOWER' | 'POST_SAVED' | 'NEW_COMMENT' | string;
  actor: {
    id: string;
    username: string;
    fullName?: string | null;
    avatar: string;
  };
  targetDetails?: {
    postId?: string;
    postTitle?: string;
    postThumbnail?: string;
    boardName?: string;
    commentText?: string;
  };
  timestamp: string;
  isUnread: boolean;
  createdAt: string;
}

export interface NotificationsResponse {
  success: boolean;
  data: ApiNotificationItem[];
  unreadCount: number;
}

/**
 * GET /api/notifications
 * Fetches notifications with optional ?type= filter
 */
export async function getNotificationsApi(type?: string): Promise<NotificationsResponse> {
  const query = type && type !== 'ALL' ? `?type=${encodeURIComponent(type)}` : '';
  const { data } = await api.get<NotificationsResponse>(`/api/notifications${query}`);
  return data;
}

/**
 * PATCH /api/notifications/read
 * Marks all notifications as read
 */
export async function markNotificationsReadApi(): Promise<{ success: boolean; unreadCount: number }> {
  const { data } = await api.patch<{ success: boolean; unreadCount: number }>('/api/notifications/read');
  return data;
}




