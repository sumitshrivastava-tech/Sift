import { Request, Response, NextFunction } from "express";
import * as userService from "../services/user.service";
import { CreateUserInput, UpdateUserInput } from "../validators/schemas";

/**
 * POST /api/users
 * Creates a new user account.
 */
export async function createUser(
  req: Request<{}, {}, CreateUserInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = await userService.createUser(req.body);
    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: user,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/users/:id
 * Fetches a single user by ID.
 */
export async function getUser(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = await userService.findUserById(req.params.id);
    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/users/:id
 * Updates an existing user's profile details.
 */
export async function updateUser(
  req: Request<{ id: string }, {}, UpdateUserInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = await userService.updateUser(req.params.id, req.body);
    res.json({
      success: true,
      message: "Profile updated successfully",
      data: user,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/users/check-username/:username
 * Checks live username availability.
 */
export async function checkUsername(
  req: Request<{ username: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { username } = req.params;
    const excludeUserId = req.query.excludeUserId as string | undefined;
    const available = await userService.isUsernameAvailable(username, excludeUserId);
    res.json({
      success: true,
      data: {
        username,
        available,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/users/:id/follow
 * Follow or unfollow a user and update their followers count.
 */
export async function followUser(
  req: Request<{ id: string }, {}, { action?: 'follow' | 'unfollow' }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const { action } = req.body;
    const result = await userService.toggleFollowUser(id, action);
    res.json({
      success: true,
      message: result.isFollowing ? "User followed" : "User unfollowed",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}


