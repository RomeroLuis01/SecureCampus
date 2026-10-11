import dotenv from 'dotenv';
import path from 'node:path';
import { z } from 'zod';

// Load environment variables from .env if present
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') });

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z
    .coerce
    .number()
    .int('PORT must be an integer')
    .min(1, 'PORT must be between 1 and 65535')
    .max(65535, 'PORT must be between 1 and 65535')
    .default(4000),
  CORS_ORIGIN: z
    .string()
    .min(1, 'CORS_ORIGIN cannot be empty')
    .default('http://localhost:5173'),
});

export type RawEnv = z.infer<typeof envSchema>;

export interface EnvConfig {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  CORS_ORIGIN: string;
  corsOrigins: string[];
}

export function validateEnv(source: Record<string, unknown> = process.env): EnvConfig {
  const parsed = envSchema.safeParse(source);

  if (!parsed.success) {
    const errorDetails = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || 'root'}: ${issue.message}`)
      .join('\n');

    throw new Error(
      `[Config Error] Invalid environment configuration:\n${errorDetails}`
    );
  }

  const corsOrigins = parsed.data.CORS_ORIGIN
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return {
    NODE_ENV: parsed.data.NODE_ENV,
    PORT: parsed.data.PORT,
    CORS_ORIGIN: parsed.data.CORS_ORIGIN,
    corsOrigins,
  };
}

export const config: EnvConfig = validateEnv();
