import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import * as settingsService from "../services/settings.service";
import { UpdateSettingsInput } from "../validators/schemas";

/**
 * GET /api/settings or GET /api/users/:userId/settings
 * Retrieves user preferences & privacy configurations.
 */
export async function getSettings(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const targetUserId =
      (req.params as { userId?: string }).userId ||
      req.user?.userId ||
      (req.query.userId as string);

    if (!targetUserId) {
      res.status(400).json({
        success: false,
        message: "User ID is required to retrieve settings",
      });
      return;
    }

    const settings = await settingsService.getSettingsByUserId(targetUserId);

    res.json({
      success: true,
      data: settings,
    });
  } catch (error: any) {
    if (error?.message?.includes("User not found")) {
      res.status(404).json({ success: false, message: error.message });
      return;
    }
    next(error);
  }
}

/**
 * PATCH /api/settings or PATCH /api/users/:userId/settings
 * Updates user preferences (pushNotifications, darkMode, language, profileVisibility).
 */
export async function updateSettings(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const targetUserId =
      (req.params as { userId?: string }).userId ||
      req.user?.userId ||
      (req.body as any).userId;

    if (!targetUserId) {
      res.status(400).json({
        success: false,
        message: "User ID is required to update settings",
      });
      return;
    }

    const updated = await settingsService.updateSettingsByUserId(
      targetUserId,
      req.body as UpdateSettingsInput
    );

    res.json({
      success: true,
      message: "Settings updated successfully",
      data: updated,
    });
  } catch (error: any) {
    if (error?.message?.includes("User not found")) {
      res.status(404).json({ success: false, message: error.message });
      return;
    }
    next(error);
  }
}

