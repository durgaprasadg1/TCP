import type { RequestHandler } from 'express';
import type { ZodType, ZodTypeDef } from 'zod';

/**
 * Parses req.body with a Zod schema. On success `req.body` is replaced by the parsed value
 * (defaults applied, transitions given ids); on failure the ZodError goes to the central error handler.
 */
export function validateBody<T>(schema: ZodType<T, ZodTypeDef, unknown>): RequestHandler {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      next(parsed.error);
      return;
    }
    req.body = parsed.data;
    next();
  };
}
