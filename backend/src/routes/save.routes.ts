import { Router } from "express";
import { savePost, unsavePost, getUserSaves } from "../controllers/save.controller";

const router = Router();

/**
 * @route  POST /api/saves
 * @desc   Save a post for a user
 * @body   { userId: string, postId: string }
 * @access Public
 */
router.post("/", savePost);

/**
 * @route  DELETE /api/saves
 * @desc   Unsave a post for a user
 * @body   { userId: string, postId: string }
 * @access Public
 */
router.delete("/", unsavePost);

/**
 * @route  GET /api/saves/user/:userId
 * @desc   Get all saved posts for a user
 * @access Public
 */
router.get("/user/:userId", getUserSaves);

export default router;

