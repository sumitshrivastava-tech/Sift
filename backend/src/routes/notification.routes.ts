import { Router } from "express";
import { getNotifications, markAsRead } from "../controllers/notification.controller";
import { authenticateToken } from "../middleware/auth";

const router = Router();

/**
 * @route  GET /api/notifications
 * @desc   Fetch user notifications with optional ?type= filter (ALL, FOLLOWERS, SAVES, COMMENTS)
 * @access Authenticated / Public fallback
 */
router.get("/", authenticateToken, getNotifications);

/**
 * @route  PATCH /api/notifications/read
 * @desc   Mark notifications as read to clear unread badge dot
 * @access Authenticated / Public fallback
 */
router.patch("/read", authenticateToken, markAsRead);

export default router;

