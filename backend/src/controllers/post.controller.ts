import { Request, Response, NextFunction } from "express";
import * as postService from "../services/post.service";
import { CreatePostInput, FeedQueryInput, RecordViewDurationInput } from "../validators/schemas";
import { AuthenticatedRequest } from "../middleware/auth";

/**
 * POST /api/posts
 * Creates a new post with optional image array, tags, automated content moderation,
 * and trust-scoring security verification.
 */
export async function createPost(
  req: AuthenticatedRequest & { body: CreatePostInput & { sourceTags?: any } },
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authorId = req.user?.userId || req.body.authorId;
    const postData = {
      ...req.body,
      authorId,
      sourceTags: req.body.sourceTags,
    };

    const post = await postService.createPost(postData);

    res.status(201).json({
      success: true,
      message: post.isFlagged
        ? "Post published with content moderation adjustments (prohibited patterns masked)"
        : "Post created successfully",
      data: post,
    });
  } catch (error) {
    next(error);
  }
}


/**
 * GET /api/posts/feed
 * Returns a dynamically ranked, engagement-boosted feed of posts.
 * Sorting score: (savesCount * 5.0) + (likesCount * 2.0) + (commentsCount * 1.5) + (viewDuration / 60)
 */
export async function getFeed(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const feed = await postService.getPostFeed(req.query as unknown as FeedQueryInput);
    res.json({ success: true, ...feed });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/posts/:id
 * Returns a single post by ID with full engagement breakdown.
 */
export async function getPost(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const post = await postService.findPostById(req.params.id);
    if (!post) {
      res.status(404).json({ success: false, message: "Post not found" });
      return;
    }
    res.json({ success: true, data: post });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/posts/:id/view
 * Records dwell duration (in seconds) spent viewing this post.
 * Dynamically increments viewDuration and updates engagement score.
 */
export async function recordView(
  req: Request<{ id: string }, {}, RecordViewDurationInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const { durationSeconds } = req.body;

    const result = await postService.recordViewDuration(id, durationSeconds);
    res.json({
      success: true,
      message: "View duration recorded and engagement score updated",
      data: result,
    });
  } catch (error: any) {
    if (error?.code === "P2025" || error?.message?.includes("No Post found")) {
      res.status(404).json({ success: false, message: "Post not found" });
      return;
    }
    next(error);
  }
}

/**
 * POST /api/posts/:id/like
 * Toggles a like for the authenticated user and recalibrates the post's engagement score.
 */
export async function toggleLike(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id: postId } = req.params as { id: string };
    const userId = req.user?.userId || (req.body as any)?.userId || "cmvwiqmw20000macy9j8k6gwr";

    const result = await postService.toggleLike(postId, userId);
    res.json({
      success: true,
      message: result.liked ? "Post liked" : "Post unliked",
      data: result,
    });
  } catch (error: any) {
    if (error?.code === "P2025" || error?.message?.includes("No Post found")) {
      res.status(404).json({ success: false, message: "Post not found" });
      return;
    }
    next(error);
  }
}

/**
 * GET /api/posts/:id/related
 * Returns related posts sharing tags or aesthetic category, excluding current post,
 * ranked by dynamic engagement score (Infinite Rabbit Hole).
 */
export async function getRelatedPosts(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
    const posts = await postService.getRelatedPosts(id, limit);
    res.json({
      success: true,
      data: posts,
    });
  } catch (error) {
    next(error);
  }
}

