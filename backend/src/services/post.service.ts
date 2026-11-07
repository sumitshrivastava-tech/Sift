import { prisma } from "../lib/prisma";
import { CreatePostInput, FeedQueryInput } from "../validators/schemas";
import { moderateText } from "../utils/contentModeration";

// ─── SQLite JSON helpers ──────────────────────────────────────────────────────
function serializeArray(arr: string[]): string {
  return JSON.stringify(arr);
}

function parseArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseJsonArray(raw?: string | null): any[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScoreBreakdown {
  savesScore: number;
  likesScore: number;
  commentsScore: number;
  viewDurationScore: number;
  totalScore: number;
}

/** Raw post row as returned by Prisma (images/tags/sourceTags are JSON strings). */
interface RawPostRow {
  id: string;
  title: string;
  content: string;
  images: string;   // JSON string e.g. '["url1","url2"]'
  tags: string;     // JSON string e.g. '["travel","food"]'
  sourceTags?: string;
  likesCount: number;
  viewDuration: number;
  engagementScore: number;
  isFlagged: boolean;
  createdAt: Date;
  updatedAt: Date;
  authorId: string;
  author: {
    id: string;
    username: string;
    avatar: string | null;
  };
  _count: {
    saves: number;
    comments: number;
    likes?: number;
  };
}

/** Post shape exposed to controllers/clients — arrays are already parsed. */
export interface PostWithSaveCount {
  id: string;
  title: string;
  content: string;
  images: string[];
  tags: string[];
  sourceTags?: any[];

  likesCount: number;
  viewDuration: number;
  engagementScore: number;
  scoreBreakdown?: ScoreBreakdown;
  isFlagged: boolean;
  createdAt: Date;
  updatedAt: Date;
  authorId: string;
  author: {
    id: string;
    username: string;
    avatar: string | null;
  };
  _count: {
    saves: number;
    comments: number;
    likes?: number;
  };
}

export interface PaginatedFeed {
  data: PostWithSaveCount[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    sort: string;
  };
}

// ─── Engagement Scoring Engine ────────────────────────────────────────────────

/**
 * Calculates the engagement score according to Sift's weighted formula:
 * score = (savesCount * 5.0) + (likesCount * 2.0) + (commentsCount * 1.5) + (viewDuration / 60)
 *
 * Weight rationale:
 * - Saves (x5.0): Highest user intent (curation & intent to purchase/revisit)
 * - Likes (x2.0): Direct positive reaction
 * - Comments (x1.5): Active community discourse
 * - View Duration (mins): Lingering dwell-time / visual inspection interest
 */
export function calculateEngagementScore(data: {
  savesCount: number;
  likesCount: number;
  commentsCount: number;
  viewDuration: number;
}): { score: number; breakdown: ScoreBreakdown } {
  const savesScore = (data.savesCount || 0) * 5.0;
  const likesScore = (data.likesCount || 0) * 2.0;
  const commentsScore = (data.commentsCount || 0) * 1.5;
  const viewDurationScore = (data.viewDuration || 0) / 60.0;
  const totalScore = savesScore + likesScore + commentsScore + viewDurationScore;
  const roundedTotal = Math.round(totalScore * 100) / 100;

  return {
    score: roundedTotal,
    breakdown: {
      savesScore: Math.round(savesScore * 100) / 100,
      likesScore: Math.round(likesScore * 100) / 100,
      commentsScore: Math.round(commentsScore * 100) / 100,
      viewDurationScore: Math.round(viewDurationScore * 100) / 100,
      totalScore: roundedTotal,
    },
  };
}

/** Deserialise a raw Prisma row into the public PostWithSaveCount shape. */
function deserializePost(raw: RawPostRow): PostWithSaveCount {
  const savesCount = raw._count?.saves ?? 0;
  const likesCount = (raw.likesCount || 0) + (raw._count?.likes ?? 0);
  const commentsCount = raw._count?.comments ?? 0;
  const viewDuration = raw.viewDuration || 0;

  const { score, breakdown } = calculateEngagementScore({
    savesCount,
    likesCount,
    commentsCount,
    viewDuration,
  });

  return {
    id: raw.id,
    title: raw.title,
    content: raw.content,
    images: parseArray(raw.images),
    tags: parseArray(raw.tags),
    sourceTags: raw.sourceTags ? parseJsonArray(raw.sourceTags) : [],
    likesCount,
    viewDuration,
    engagementScore: score,
    scoreBreakdown: breakdown,
    isFlagged: raw.isFlagged ?? false,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    authorId: raw.authorId,
    author: raw.author,
    _count: raw._count,
  };

}

// ─── Fuzzy Search Helper ──────────────────────────────────────────────────────

export function levenshteinDistance(a: string, b: string): number {
  const an = a ? a.length : 0;
  const bn = b ? b.length : 0;
  if (an === 0) return bn;
  if (bn === 0) return an;
  const matrix: number[][] = [];
  for (let i = 0; i <= bn; ++i) matrix[i] = [i];
  for (let j = 1; j <= an; ++j) matrix[0][j] = j;

  for (let i = 1; i <= bn; ++i) {
    for (let j = 1; j <= an; ++j) {
      if (b.charAt(i - 1).toLowerCase() === a.charAt(j - 1).toLowerCase()) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[bn][an];
}

export function isFuzzyMatch(query: string, target: string, maxDistance = 2): boolean {
  const q = query.trim().toLowerCase();
  const t = target.trim().toLowerCase();
  if (!q || !t) return false;
  if (t.includes(q) || q.includes(t)) return true;

  const words = t.split(/[\s,_\-]+/);
  for (const word of words) {
    if (word.includes(q) || q.includes(word)) return true;
    if (Math.abs(word.length - q.length) <= maxDistance) {
      if (levenshteinDistance(q, word) <= maxDistance) return true;
    }
  }
  return levenshteinDistance(q, t) <= maxDistance;
}

// ─── Service Functions ────────────────────────────────────────────────────────

/**
 * Creates a new post with automated content moderation and security filters.
 * Toxic words and spam links in title/content are masked.
 */
export async function createPost(
  data: CreatePostInput & { sourceTags?: any; authorId?: string }
): Promise<PostWithSaveCount> {
  // Verify author exists (or fallback gracefully to first existing user)
  let authorId = data.authorId;
  const user = authorId ? await prisma.user.findUnique({ where: { id: authorId } }) : null;
  if (!user) {
    const firstUser = await prisma.user.findFirst();
    if (firstUser) {
      authorId = firstUser.id;
    } else {
      throw new Error("Author not found");
    }
  }

  // Moderate text for spam links & toxic keywords
  const titleToUse = data.title || data.content.slice(0, 50).trim() || "Untitled Drop";
  const titleMod = moderateText(titleToUse);
  const contentMod = moderateText(data.content);
  const isFlagged = titleMod.isFlagged || contentMod.isFlagged;

  const raw = await prisma.post.create({
    data: {
      title: titleMod.cleanText,
      content: contentMod.cleanText,
      images: serializeArray(data.images || []),
      tags: serializeArray(data.tags || []),
      sourceTags:
        typeof data.sourceTags === "string"
          ? data.sourceTags
          : JSON.stringify(data.sourceTags || []),
      authorId: authorId!,
      likesCount: 0,
      viewDuration: 0,
      engagementScore: 0,
      isFlagged,
    },
    include: {
      author: { select: { id: true, username: true, avatar: true } },
      _count: { select: { saves: true, comments: true, likes: true } },
    },
  });

  return deserializePost(raw as unknown as RawPostRow);
}


/**
 * Returns an engagement-boosted feed of posts.
 *
 * Scoring algorithm:
 * score = (savesCount * 5.0) + (likesCount * 2.0) + (commentsCount * 1.5) + (viewDuration / 60)
 *
 * Posts with high active engagement are dynamically boosted to the top of the feed.
 */
export async function getPostFeed(query: FeedQueryInput): Promise<PaginatedFeed> {
  const { page, limit, tag, q, authorId, sort = "engagement" } = query;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (authorId) {
    where.authorId = authorId;
  }
  if (tag) {
    where.tags = { contains: `"${tag}"` };
  } else if (q) {
    where.OR = [
      { title: { contains: q } },
      { content: { contains: q } },
      { tags: { contains: q } },
    ];
  }

  // Fetch all candidate posts matching the filter to rank dynamically
  let rawPosts = await prisma.post.findMany({
    where,
    include: {
      author: { select: { id: true, username: true, avatar: true } },
      _count: { select: { saves: true, comments: true, likes: true } },
    },
  });

  let total = rawPosts.length;

  // Fuzzy matching fallback if 0 results
  if (total === 0 && (q || tag)) {
    const searchTerm = (q || tag)!.toLowerCase();
    const all = await prisma.post.findMany({
      where: authorId ? { authorId } : {},
      include: {
        author: { select: { id: true, username: true, avatar: true } },
        _count: { select: { saves: true, comments: true, likes: true } },
      },
    });

    rawPosts = all.filter((p) => {
      const titleMatch = isFuzzyMatch(searchTerm, p.title);
      const tagsList = parseArray(p.tags);
      const tagMatch = tagsList.some((t) => isFuzzyMatch(searchTerm, t));
      return titleMatch || tagMatch;
    });

    total = rawPosts.length;
  }

  // Deserialise and calculate engagement score for each post
  const parsedPosts = rawPosts.map((r) => deserializePost(r as unknown as RawPostRow));

  // Dynamic Multi-Factor Sorting
  if (sort === "engagement") {
    // Dynamic Engagement Boost:
    // Highest engagement score first, tie-breaker is recency
    parsedPosts.sort((a, b) => {
      if (b.engagementScore !== a.engagementScore) {
        return b.engagementScore - a.engagementScore;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  } else if (sort === "saves") {
    parsedPosts.sort((a, b) => b._count.saves - a._count.saves);
  } else if (sort === "recent") {
    parsedPosts.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  // Paginate ranked items
  const paginatedData = parsedPosts.slice(skip, skip + limit);
  const totalPages = Math.ceil(total / limit) || 1;

  return {
    data: paginatedData,
    meta: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      sort,
    },
  };
}

/**
 * Finds a single post by ID with full engagement scores.
 */
export async function findPostById(id: string): Promise<PostWithSaveCount | null> {
  const raw = await prisma.post.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, username: true, avatar: true } },
      _count: { select: { saves: true, comments: true, likes: true } },
    },
  });

  return raw ? deserializePost(raw as unknown as RawPostRow) : null;
}

/**
 * Records view duration (dwell time in seconds) spent by a user on a post.
 * Automatically recalculates and updates the post's dynamic engagement score.
 */
export async function recordViewDuration(
  postId: string,
  durationSeconds: number
): Promise<{ id: string; viewDuration: number; engagementScore: number }> {
  const post = await prisma.post.findUniqueOrThrow({
    where: { id: postId },
    include: {
      _count: { select: { saves: true, comments: true, likes: true } },
    },
  });

  const newViewDuration = (post.viewDuration || 0) + durationSeconds;
  const savesCount = post._count.saves;
  const likesCount = (post.likesCount || 0) + (post._count.likes || 0);
  const commentsCount = post._count.comments;

  const { score } = calculateEngagementScore({
    savesCount,
    likesCount,
    commentsCount,
    viewDuration: newViewDuration,
  });

  const updated = await prisma.post.update({
    where: { id: postId },
    data: {
      viewDuration: Math.round(newViewDuration * 10) / 10,
      engagementScore: score,
    },
    select: {
      id: true,
      viewDuration: true,
      engagementScore: true,
    },
  });

  return updated;
}

/**
 * Toggles a like for a user on a post, and updates the engagement score.
 */
export async function toggleLike(
  postId: string,
  userId: string
): Promise<{ liked: boolean; likesCount: number; engagementScore: number }> {
  // Check if like exists
  const existing = await prisma.like.findUnique({
    where: { userId_postId: { userId, postId } },
  });

  let liked = false;
  if (existing) {
    await prisma.like.delete({
      where: { id: existing.id },
    });
    liked = false;
  } else {
    await prisma.like.create({
      data: { userId, postId },
    });
    liked = true;
  }

  const post = await prisma.post.findUniqueOrThrow({
    where: { id: postId },
    include: {
      _count: { select: { saves: true, comments: true, likes: true } },
    },
  });

  const totalLikes = post._count.likes;
  const savesCount = post._count.saves;
  const commentsCount = post._count.comments;
  const viewDuration = post.viewDuration || 0;

  const { score } = calculateEngagementScore({
    savesCount,
    likesCount: totalLikes,
    commentsCount,
    viewDuration,
  });

  const updated = await prisma.post.update({
    where: { id: postId },
    data: {
      likesCount: totalLikes,
      engagementScore: score,
    },
    select: {
      id: true,
      likesCount: true,
      engagementScore: true,
    },
  });

  return {
    liked,
    likesCount: updated.likesCount,
    engagementScore: updated.engagementScore,
  };
}

/**
 * Infinite Rabbit Hole:
 * Fetches posts that share the same tags or category as the current post,
 * excluding the current post itself, sorted by the weighted engagement score.
 */
export async function getRelatedPosts(
  postId: string,
  limit: number = 10
): Promise<PostWithSaveCount[]> {
  // 1. Fetch current post to extract its tags
  const currentPost = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, tags: true, title: true },
  });

  if (!currentPost) {
    return [];
  }

  const tags = parseArray(currentPost.tags);

  // 2. Query posts that share at least one tag, excluding the current post
  const whereClause: any = {
    id: { not: postId },
  };

  if (tags.length > 0) {
    whereClause.OR = tags.map((t) => ({ tags: { contains: `"${t}"` } }));
  }

  let candidates = await prisma.post.findMany({
    where: whereClause,
    include: {
      author: { select: { id: true, username: true, avatar: true } },
      _count: { select: { saves: true, comments: true, likes: true } },
    },
  });

  // 3. Fallback: if fewer than 4 related posts found by tag, supplement with top engagement posts
  if (candidates.length < 4) {
    const existingIds = [postId, ...candidates.map((c) => c.id)];
    const supplemental = await prisma.post.findMany({
      where: {
        id: { notIn: existingIds },
      },
      take: limit,
      include: {
        author: { select: { id: true, username: true, avatar: true } },
        _count: { select: { saves: true, comments: true, likes: true } },
      },
    });
    candidates = [...candidates, ...supplemental];
  }

  // 4. Calculate dynamic engagement scores and deserialize
  const parsed = candidates.map((c) => deserializePost(c as unknown as RawPostRow));

  // 5. Sort by engagement score descending (with recency tie-breaker)
  parsed.sort((a, b) => {
    if (b.engagementScore !== a.engagementScore) {
      return b.engagementScore - a.engagementScore;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return parsed.slice(0, limit);
}

