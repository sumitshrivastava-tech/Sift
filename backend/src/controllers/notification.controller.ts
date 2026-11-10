import { Request, Response, NextFunction } from "express";
import * as notificationService from "../services/notification.service";
import { AuthenticatedRequest } from "../middleware/auth";

/**
 * GET /api/notifications
 * Fetches notifications for authenticated user, with optional ?type= filter
 */
export async function getNotifications(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const recipientId =
      req.user?.userId ||
      (req.query.recipientId as string) ||
      (req.query.userId as string) ||
      "cmvwiqmw20000macy9j8k6gwr";

    const filterType = req.query.type as string | undefined;

    const notifications = await notificationService.getNotifications(
      recipientId,
      filterType
    );

    const unreadCount = notifications.filter((n) => n.isUnread).length;

    res.json({
      success: true,
      data: notifications,
      unreadCount,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/notifications/read
 * Marks notifications as read
 */
export async function markAsRead(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const recipientId =
      req.user?.userId ||
      req.body?.recipientId ||
      req.body?.userId ||
      (req.query.recipientId as string) ||
      "cmvwiqmw20000macy9j8k6gwr";

    const result = await notificationService.markNotificationsAsRead(recipientId);

    res.json({
      success: true,
      message: "Notifications marked as read",
      unreadCount: result.unreadCount,
    });
  } catch (error) {
    next(error);
  }
}

