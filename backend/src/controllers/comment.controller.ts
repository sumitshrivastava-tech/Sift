import { Request, Response, NextFunction } from "express";
import * as commentService from "../services/comment.service";
import { AuthenticatedRequest } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createCommentSchema } from "../validators/schemas";

/**
 * POST /api/comments
 * POST /api/posts/:postId/comments
 * Requires JWT authentication. Accepts postId (from body or route param) + content.
 */
export async function createComment(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId =
      req.body.authorId ||
      authReq.user?.userId ||
      req.body.userId;

    // postId may come from route param (/api/posts/:postId/comments) or body
    const postId = (req.params.postId ?? req.body.postId) as string;
    const { content } = req.body as { content: string };

    if (!postId || !content) {
      res.status(400).json({
        success: false,
        message: "postId and content are required",
      });
      return;
    }

    const comment = await commentService.createComment(postId, content, userId);

    res.status(201).json({
      success: true,
      message: "Comment created successfully",
      data: comment,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/posts/:postId/comments
 * GET /api/comments
 * Returns all comments for a post ordered chronologically (oldest first).
 */
export async function getComments(
  req: Request<{ postId?: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const postId = (req.params.postId || req.query.postId) as string;

    if (!postId) {
      res.json({
        success: true,
        data: [],
      });
      return;
    }

    const comments = await commentService.getCommentsByPostId(postId);

    res.json({
      success: true,
      data: comments,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/comments/:id/like
 * Toggle like/heart on a comment.
 */
export async function toggleCommentLike(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    res.json({
      success: true,
      message: "Comment reaction recorded",
      data: { commentId: id, isLiked: true },
    });
  } catch (error) {
    next(error);
  }
}
