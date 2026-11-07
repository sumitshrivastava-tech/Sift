import { Router } from "express";
import {
  createBoard,
  addCollaborator,
  getUserBoards,
  getBoardById,
} from "../controllers/board.controller";
import { authenticateToken } from "../middleware/auth";

const router = Router();

/**
 * @route   POST /api/boards
 * @desc    Create a new canvas board
 * @access  Protected / Authenticated
 */
router.post("/", authenticateToken, createBoard);

/**
 * @route   POST /api/boards/:id/collaborators
 * @desc    Invite a user by @username to collaborate on a board
 * @access  Protected / Authenticated
 */
router.post("/:id/collaborators", authenticateToken, addCollaborator);

/**
 * @route   GET /api/boards/user/:userId
 * @desc    Get all boards owned by or shared with a user
 * @access  Public
 */
router.get("/user/:userId", getUserBoards);

/**
 * @route   GET /api/boards/:id
 * @desc    Get a single board with its saves and collaborators
 * @access  Public
 */
router.get("/:id", getBoardById);

export default router;

