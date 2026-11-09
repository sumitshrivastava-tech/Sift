import { Router } from "express";
import {
  createPost,
  getFeed,
  getFollowingFeed,
  getPost,
  getRelatedPosts,
  recordView,
  toggleLike,
} from "../controllers/post.controller";
import { createComment, getComments, toggleCommentLike } from "../controllers/comment.controller";
import { validate } from "../middleware/validate";
import { authenticateToken } from "../middleware/auth";
import { restrictUntrustedUser } from "../middleware/contentModeration";
import {
  createPostSchema,
  feedQuerySchema,
  recordViewDurationSchema,
} from "../validators/schemas";

const router = Router();

/**
 * @route  GET /api/posts/feed
 * @desc   Get paginated feed of posts ordered by dynamic engagement score:
 *         score = (savesCount * 5.0) + (likesCount * 2.0) + (commentsCount * 1.5) + (viewDuration / 60)
 * @query  page, limit, tag, q, sort
 * @access Public
 */
router.get("/feed", validate(feedQuerySchema, "query"), getFeed);
router.get("/feed/following", validate(feedQuerySchema, "query"), getFollowingFeed);

/**
 * @route  GET /api/posts/following
 * @desc   Get real feed of posts from creators the user follows
 * @query  page, limit, authorIds
 * @access Public / Authenticated
 */
router.get("/following", validate(feedQuerySchema, "query"), getFollowingFeed);

/**
 * @route  POST /api/posts
 * @desc   Create a new post with automated content moderation and security trust gate
 * @access Authenticated (Phone verification & 50+ trust score required)
 */
router.post(
  "/",
  authenticateToken,
  restrictUntrustedUser,
  validate(createPostSchema),
  createPost
);

/**
 * @route  GET /api/posts/:id
 * @desc   Get a single post by ID with full engagement metrics
 * @access Public
 */
router.get("/:id", getPost);

/**
 * @route  GET /api/posts/:id/related
 * @desc   Get related posts sharing tags/category, sorted by engagement score (Infinite Rabbit Hole)
 * @access Public
 */
router.get("/:id/related", getRelatedPosts);

/**
 * @route  POST /api/posts/:id/view
 * @desc   Record dwell view duration in seconds and update engagement score
 * @access Public / Authenticated
 */
router.post("/:id/view", validate(recordViewDurationSchema), recordView);

/**
 * @route  POST /api/posts/:id/like
 * @desc   Toggle like for authenticated user and recalibrate score
 * @access Authenticated
 */
router.post("/:id/like", authenticateToken, toggleLike);

/**
 * @route  GET /api/posts/:postId/comments
 * @desc   Get comments for a post
 * @access Public
 */
router.get("/:postId/comments", getComments);

/**
 * @route  POST /api/posts/:postId/comments
 * @desc   Add a comment to a post (with automated spam/toxic content moderation)
 * @access Public / Authenticated
 */
router.post("/:postId/comments", authenticateToken, createComment);
router.post("/:postId/comments/:id/like", toggleCommentLike);

export default router;
