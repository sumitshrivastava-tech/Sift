import { Router } from "express";
import { createUser, getUser, updateUser, checkUsername, followUser } from "../controllers/user.controller";
import { getSettings, updateSettings } from "../controllers/settings.controller";
import { validate } from "../middleware/validate";
import { createUserSchema, updateUserSchema, updateSettingsSchema } from "../validators/schemas";

const router = Router();

/**
 * @route  GET /api/users/check-username/:username
 * @desc   Check if a username is available
 * @access Public
 */
router.get("/check-username/:username", checkUsername);

/**
 * @route  POST /api/users/:id/follow
 * @desc   Follow or unfollow a creator
 * @access Public / Authenticated
 */
router.post("/:id/follow", followUser);


/**
 * @route  GET /api/users/:userId/settings
 * @desc   Get user preferences & privacy settings
 * @access Public / Authenticated
 */
router.get("/:userId/settings", getSettings);

/**
 * @route  PATCH /api/users/:userId/settings
 * @desc   Update user preferences & privacy settings
 * @access Public / Authenticated
 */
router.patch("/:userId/settings", validate(updateSettingsSchema), updateSettings);

/**
 * @route  POST /api/users
 * @desc   Create a new user
 * @access Public
 */
router.post("/", validate(createUserSchema), createUser);

/**
 * @route  GET /api/users/:id
 * @desc   Get a user by ID
 * @access Public
 */
router.get("/:id", getUser);

/**
 * @route  PATCH /api/users/:id
 * @desc   Update a user's profile
 * @access Public
 */
router.patch("/:id", validate(updateUserSchema), updateUser);

export default router;

