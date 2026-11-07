import { Router } from "express";
import { getSettings, updateSettings } from "../controllers/settings.controller";
import { authenticateToken } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { updateSettingsSchema } from "../validators/schemas";

const router = Router();

/**
 * @route   GET /api/settings
 * @desc    Get preferences & privacy settings for authenticated user
 * @access  Private / Authenticated
 */
router.get("/", authenticateToken, getSettings);

/**
 * @route   PATCH /api/settings
 * @desc    Update preferences & privacy settings for authenticated user
 * @access  Private / Authenticated
 */
router.patch("/", authenticateToken, validate(updateSettingsSchema), updateSettings);

/**
 * @route   GET /api/settings/:userId
 * @desc    Get settings by explicit user ID
 * @access  Private / Authenticated
 */
router.get("/:userId", authenticateToken, getSettings);

/**
 * @route   PATCH /api/settings/:userId
 * @desc    Update settings by explicit user ID
 * @access  Private / Authenticated
 */
router.patch("/:userId", authenticateToken, validate(updateSettingsSchema), updateSettings);

export default router;

