import cors from 'cors';
import express from 'express';
import type { Express } from 'express';
import { loadConfig } from './config';
import type { AppConfig } from './config';
import { errorHandler, notFoundHandler } from './middleware/errors';
import { apiRouter } from './routes';

/**
 * Builds the Express application. No file-system access and no evaluation of user input as code:
 * the API only parses JSON, validates it with Zod and calls the shared pure engines in @cw/core.
 */
export function createApp(config: AppConfig = loadConfig()): Express {
  const app = express();
  app.disable('x-powered-by');

  app.use(
    cors({
      origin(origin, callback) {
        // Same-origin and non-browser clients send no Origin header.
        if (!origin || config.corsOrigins.includes(origin)) callback(null, true);
        else callback(null, false);
      },
      methods: ['GET', 'POST', 'OPTIONS'],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: config.bodyLimit }));

  app.use('/api', apiRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
