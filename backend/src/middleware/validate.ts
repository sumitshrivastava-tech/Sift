import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";

type RequestPart = "body" | "query" | "params";

/**
 * Generic Zod validation middleware factory.
 * @param schema - The Zod schema to validate against.
 * @param part - Which part of the request to validate ('body', 'query', 'params').
 */
export const validate =
  <T>(schema: ZodSchema<T>, part: RequestPart = "body") =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[part]);

    if (!result.success) {
      const errors = result.error.issues.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));

      _res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      });
      return;
    }

    // Attach the parsed (coerced + validated) data back onto the request
    try {
      (req as Request & { [key: string]: unknown })[part] = result.data;
    } catch {
      Object.defineProperty(req, part, {
        value: result.data,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }
    next();
  };
