import { Request, Response, NextFunction } from "express";
import * as saveService from "../services/save.service";

/**
 * POST /api/saves
 * Saves a post for a user (optionally into a canvas board).
 * Body: { userId: string, postId: string, boardId?: string }
 */
export async function savePost(
  req: Request<{}, {}, { userId: string; postId: string; boardId?: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { userId, postId, boardId } = req.body;
    const save = await saveService.savePost(userId, postId, boardId);
    res.status(201).json({
      success: true,
      message: "Post saved successfully",
      data: save,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/saves
 * Removes a saved post for a user.
 * Body: { userId: string, postId: string, boardId?: string }
 */
export async function unsavePost(
  req: Request<{}, {}, { userId: string; postId: string; boardId?: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { userId, postId, boardId } = req.body;
    await saveService.unsavePost(userId, postId, boardId);
    res.json({ success: true, message: "Post unsaved successfully" });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/saves/user/:userId
 * Returns all saved posts for a given user.
 */
export async function getUserSaves(
  req: Request<{ userId: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const saves = await saveService.getUserSaves(req.params.userId);
    res.json({ success: true, data: saves });
  } catch (error) {
    next(error);
  }
}
