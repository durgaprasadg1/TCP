export interface AppConfig {
  port: number;
  /** Allowed browser origins for CORS. */
  corsOrigins: string[];
  /** Maximum JSON request body size accepted by Express. */
  bodyLimit: string;
}

const DEFAULT_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173', 'http://127.0.0.1:4173'];

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const port = Number(env.PORT ?? 4000);
  const origins = (env.CORS_ORIGIN ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    port: Number.isInteger(port) && port > 0 && port < 65536 ? port : 4000,
    corsOrigins: origins.length > 0 ? origins : DEFAULT_ORIGINS,
    bodyLimit: env.BODY_LIMIT ?? '256kb',
  };
}
