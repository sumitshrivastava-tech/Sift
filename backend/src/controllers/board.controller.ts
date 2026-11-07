import { Request, Response, NextFunction } from "express";
import * as boardService from "../services/board.service";
import { AuthenticatedRequest } from "../middleware/auth";

/**
 * POST /api/boards
 * Creates a new canvas board.
 * Body: { name: string, isPrivate?: boolean, description?: string, ownerId?: string }
 */
export async function createBoard(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { name, isPrivate, description } = req.body;
    // Derive ownerId from auth token or body fallback
    const ownerId = req.user?.userId || req.body.ownerId || "cmvwiqmw20000macy9j8k6gwr";

    if (!name || typeof name !== "string" || !name.trim()) {
      res.status(400).json({
        success: false,
        message: "Board name is required and cannot be empty.",
      });
      return;
    }

    const board = await boardService.createBoard({
      name: name.trim(),
      isPrivate: isPrivate !== undefined ? Boolean(isPrivate) : true,
      description: description ? String(description).trim() : undefined,
      ownerId,
    });

    res.status(201).json({
      success: true,
      message: "Board created successfully",
      data: board,
    });
  } catch (error: any) {
    if (error.status) {
      res.status(error.status).json({ success: false, message: error.message });
      return;
    }
    next(error);
  }
}

/**
 * POST /api/boards/:id/collaborators
 * Invites a user to a board as a collaborator by @username.
 * Params: id (boardId)
 * Body: { username: string, role?: string }
 */
export async function addCollaborator(
  req: Request<{ id: string }, {}, { username: string; role?: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const boardId = req.params.id;
    const { username, role = "editor" } = req.body;

    if (!boardId) {
      res.status(400).json({ success: false, message: "Board ID is required." });
      return;
    }

    if (!username || typeof username !== "string" || !username.trim()) {
      res.status(400).json({
        success: false,
        message: "Username is required to invite a collaborator.",
      });
      return;
    }

    const result = await boardService.addCollaborator({
      boardId,
      username,
      role,
    });

    res.status(201).json({
      success: true,
      message: result.message,
      data: result.collaborator,
    });
  } catch (error: any) {
    if (error.status) {
      res.status(error.status).json({
        success: false,
        message: error.message,
      });
      return;
    }
    next(error);
  }
}

/**
 * GET /api/boards/user/:userId
 * Retrieves all boards belonging to or shared with a user.
 */
export async function getUserBoards(
  req: Request<{ userId: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { userId } = req.params;
    const boards = await boardService.getUserBoards(userId);
    res.json({
      success: true,
      data: boards,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/boards/:id
 * Retrieves a single board by ID with all saves and collaborator details.
 */
export async function getBoardById(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const board = await boardService.getBoardById(req.params.id);
    res.json({
      success: true,
      data: board,
    });
  } catch (error: any) {
    if (error.status) {
      res.status(error.status).json({
        success: false,
        message: error.message,
      });
      return;
    }
    next(error);
  }
}

