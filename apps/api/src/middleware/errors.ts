import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';

/** Error with an HTTP status and a stable machine-readable code. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export interface ErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export const notFoundHandler: RequestHandler = (req, res) => {
  const body: ErrorBody = { error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}` } };
  res.status(404).json(body);
};

interface BodyParserError extends Error {
  type?: string;
  status?: number;
}

/** Central error handler: every failure leaves the API as the same JSON shape, with no stack traces. */
export const errorHandler: ErrorRequestHandler = (err: unknown, _req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  if (err instanceof HttpError) {
    const body: ErrorBody = { error: { code: err.code, message: err.message, details: err.details } };
    res.status(err.status).json(body);
    return;
  }
  if (err instanceof ZodError) {
    const body: ErrorBody = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'The request body is invalid.',
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    };
    res.status(400).json(body);
    return;
  }
  const bp = err as BodyParserError;
  if (bp.type === 'entity.too.large') {
    const body: ErrorBody = { error: { code: 'PAYLOAD_TOO_LARGE', message: 'The request body is too large.' } };
    res.status(413).json(body);
    return;
  }
  if (bp.type === 'entity.parse.failed') {
    const body: ErrorBody = { error: { code: 'INVALID_JSON', message: 'The request body is not valid JSON.' } };
    res.status(400).json(body);
    return;
  }
  console.error('Unhandled error:', err);
  const body: ErrorBody = { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } };
  res.status(500).json(body);
};
