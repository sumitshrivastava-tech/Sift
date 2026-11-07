import { Request, Response, NextFunction } from "express";
import * as searchService from "../services/search.service";
import { VisualSearchInput } from "../validators/schemas";

/**
 * POST /api/search/visual
 * Reverse Visual Search endpoint.
 * Accepts an image (base64 string or image URL) and returns aesthetically similar posts
 * tagged with `isVisualMatch: true` and similarity scores.
 */
export async function visualSearch(
  req: Request<{}, {}, VisualSearchInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { image, limit } = req.body;

    const result = await searchService.searchVisual(image, limit);

    res.json({
      success: true,
      message: "Visual search completed successfully",
      data: result.matches,
      meta: result.meta,
    });
  } catch (error) {
    next(error);
  }
}

