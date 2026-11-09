import { Router } from "express";
import { createComment, getComments, toggleCommentLike } from "../controllers/comment.controller";

const router = Router();

router.get("/:postId", getComments);
router.get("/", getComments);
router.post("/:id/like", toggleCommentLike);
router.post("/:id/react", toggleCommentLike);
router.post("/", createComment);

export default router;
