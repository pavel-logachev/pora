import { z } from 'zod';

import type { AppConfig } from './app.js';

const environmentSchema = z.object({
  APP_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_ISSUER: z.string().min(1).default('pora-api'),
  JWT_AUDIENCE: z.string().min(1).default('pora-mobile'),
  ACCESS_TOKEN_TTL: z.string().regex(/^\d+[smh]$/).default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  CORS_ORIGINS: z.string().default(''),
});

export interface RuntimeConfig {
  host: string;
  port: number;
  databaseUrl: string;
  app: AppConfig;
}

export function loadConfig(
  environment: NodeJS.ProcessEnv = process.env,
): RuntimeConfig {
  const parsed = environmentSchema.parse(environment);
  return {
    host: parsed.HOST,
    port: parsed.PORT,
    databaseUrl: parsed.DATABASE_URL,
    app: {
      appEnv: parsed.APP_ENV,
      jwtSecret: parsed.JWT_SECRET,
      jwtIssuer: parsed.JWT_ISSUER,
      jwtAudience: parsed.JWT_AUDIENCE,
      accessTokenTtl: parsed.ACCESS_TOKEN_TTL,
      refreshTokenTtlDays: parsed.REFRESH_TOKEN_TTL_DAYS,
      corsOrigins: parsed.CORS_ORIGINS.split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    },
  };
}
