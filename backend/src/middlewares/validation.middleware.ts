import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";

export function validate(schema: ZodSchema, source: "body" | "query" | "params" = "body") {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));
      console.error(`[Validation Error] ${req.method} ${req.originalUrl}`, JSON.stringify(details, null, 2));
      return res.status(400).json({
        success: false,
        error: "Validation error",
        details: details,
      });
    }
    req[source] = result.data;
    next();
  };
}
