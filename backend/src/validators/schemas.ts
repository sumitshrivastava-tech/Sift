import { z } from "zod";

// ─── User Schemas ─────────────────────────────────────────────────────────────

export const createUserSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must be at most 30 characters")
    .regex(
      /^[a-zA-Z0-9_]+$/,
      "Username can only contain letters, numbers, and underscores"
    ),
  fullName: z.string().max(80).optional(),
  phone: z
    .string()
    .regex(/^\+?[1-9]\d{6,14}$/, "Invalid phone number format"),
  email: z.string().email("Invalid email format").optional(),
  password: z.string().min(6).optional(),
  avatar: z.string().optional().nullable(),
  bio: z.string().max(500, "Bio must be at most 500 characters").optional().nullable(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must be at most 30 characters")
    .regex(
      /^[a-zA-Z0-9_]+$/,
      "Username can only contain letters, numbers, and underscores"
    )
    .optional(),
  fullName: z.string().max(100).optional().nullable(),
  phone: z
    .string()
    .regex(/^\+?[1-9]\d{6,14}$/, "Invalid phone number format")
    .optional()
    .nullable(),
  bio: z.string().max(500, "Bio must be at most 500 characters").optional().nullable(),
  avatar: z.string().optional().nullable(),
  followersCount: z.number().int().min(0).optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

// ─── Post Schemas ─────────────────────────────────────────────────────────────

export const createPostSchema = z.object({
  authorId: z.string().optional(),
  userId: z.string().optional(),
  title: z
    .string()
    .max(200, "Title must be at most 200 characters")
    .optional(),
  content: z
    .string()
    .max(10000, "Content must be at most 10,000 characters")
    .optional(),
  description: z
    .string()
    .max(10000, "Description must be at most 10,000 characters")
    .optional(),
  imageUrl: z.string().optional(),
  images: z
    .union([z.array(z.string()), z.string()])
    .transform((val) => (Array.isArray(val) ? val : val ? [val] : []))
    .default([]),
  tags: z
    .union([z.array(z.string()), z.string()])
    .transform((val) => {
      if (Array.isArray(val)) return val;
      if (typeof val === "string") {
        return val
          .split(",")
          .map((t) => t.trim().replace(/^#/, ""))
          .filter(Boolean);
      }
      return [];
    })
    .default([]),
  sourceTags: z
    .union([z.string(), z.array(z.any())])
    .optional()
    .default([]),
});


export type CreatePostInput = z.infer<typeof createPostSchema>;

// ─── Feed Query Schemas ───────────────────────────────────────────────────────

export const feedQuerySchema = z.object({
  page: z
    .union([z.string(), z.number()])
    .optional()
    .transform((val) => (val !== undefined ? (typeof val === "number" ? val : parseInt(val, 10)) : 1))
    .pipe(z.number().int().min(1, "Page must be at least 1")),
  limit: z
    .union([z.string(), z.number()])
    .optional()
    .transform((val) => (val !== undefined ? (typeof val === "number" ? val : parseInt(val, 10)) : 10))
    .pipe(z.number().int().min(1).max(100, "Limit must be at most 100")),
  tag: z.string().optional(),
  q: z.string().optional(),
  authorId: z.string().optional(),
  authorIds: z.string().optional(),
  following: z.string().optional(),
  sort: z.enum(["engagement", "recent", "saves"]).optional().default("engagement"),
});

export type FeedQueryInput = z.infer<typeof feedQuerySchema>;

// ─── Auth Schemas ─────────────────────────────────────────────────────────────

export const sendOtpSchema = z.object({
  phone: z
    .string()
    .regex(/^\+?[1-9]\d{6,14}$/, "Invalid phone number format"),
});

export type SendOtpInput = z.infer<typeof sendOtpSchema>;

export const verifyOtpSchema = z.object({
  phone: z
    .string()
    .regex(/^\+?[1-9]\d{6,14}$/, "Invalid phone number format"),
  code: z
    .string()
    .length(4, "OTP must be exactly 4 digits")
    .regex(/^\d{4}$/, "OTP must contain only digits"),
});

export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

export const emailAuthSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  isSignUp: z.boolean().optional(),
});

export type EmailAuthInput = z.infer<typeof emailAuthSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email format"),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

// ─── Comment Schemas ──────────────────────────────────────────────────────────

export const createCommentSchema = z.object({
  postId: z.string().cuid("Invalid post ID").optional(),
  authorId: z.string().optional(),
  content: z
    .string()
    .min(1, "Comment cannot be empty")
    .max(2000, "Comment must be at most 2,000 characters"),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;

// ─── Settings Schemas ─────────────────────────────────────────────────────────

export const updateSettingsSchema = z.object({
  pushNotifications: z.boolean().optional(),
  darkMode: z.boolean().optional(),
  language: z.string().min(2).max(10).optional(),
  profileVisibility: z.enum(["public", "private", "followers"]).optional(),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

// ─── View / Engagement Schemas ───────────────────────────────────────────────

export const recordViewDurationSchema = z.object({
  durationSeconds: z.number().min(0.1).max(86400, "View duration must be realistic"),
});

export type RecordViewDurationInput = z.infer<typeof recordViewDurationSchema>;

// ─── Visual Search Schema ─────────────────────────────────────────────────────

export const visualSearchSchema = z.object({
  image: z.string().min(1, "Image is required (base64 string or image URL)"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .default(12),
});

export type VisualSearchInput = z.infer<typeof visualSearchSchema>;


