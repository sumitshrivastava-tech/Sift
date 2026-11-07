import { Request, Response, NextFunction } from "express";

/**
 * Central error-handling middleware.
 * Must be registered LAST in the Express app.
 */
export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error("[ErrorHandler]", err);

  // Custom application errors (e.g. AuthError) with HTTP status codes
  const customError = err as unknown as { statusCode?: number };
  if (customError.statusCode) {
    res.status(customError.statusCode).json({
      success: false,
      message: err.message,
    });
    return;
  }

  // Prisma unique constraint violation
  if ((err as { code?: string }).code === "P2002") {
    res.status(409).json({
      success: false,
      message: "A record with those unique fields already exists.",
    });
    return;
  }

  // Prisma record not found
  if ((err as { code?: string }).code === "P2025") {
    res.status(404).json({
      success: false,
      message: "The requested record was not found.",
    });
    return;
  }

  res.status(500).json({
    success: false,
    message:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message,
  });
};

/**
 * 404 handler – catches any unmatched routes.
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
};

