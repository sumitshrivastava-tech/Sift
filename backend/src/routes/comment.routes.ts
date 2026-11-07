import { Router } from "express";
import { createComment, getComments } from "../controllers/comment.controller";

const router = Router();

router.get("/:postId", getComments);
router.get("/", getComments);
router.post("/", createComment);

export default router;
