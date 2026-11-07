import { Router } from "express";
import { visualSearch } from "../controllers/search.controller";
import { validate } from "../middleware/validate";
import { visualSearchSchema } from "../validators/schemas";

const router = Router();

/**
 * @route  POST /api/search/visual
 * @desc   Reverse Visual Search by image (base64 or URL)
 * @access Public
 */
router.post("/visual", validate(visualSearchSchema), visualSearch);

export default router;

