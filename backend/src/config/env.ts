import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

// Canonical location: always <project_root>/.env regardless of CWD
// backend/src/config -> .. (src) -> .. (backend) -> .. (project root)
// backend/dist/config -> .. (dist) -> .. (backend) -> .. (project root)
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(currentDir, '..', '..', '..');
const canonicalEnvPath = path.join(rootDir, '.env');

// Single deterministic dotenv invocation without scanning parent/user home directories
dotenv.config({ path: canonicalEnvPath });

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
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required')
    .refine((val) => {
      try {
        const parsed = new URL(val);
        return parsed.protocol === 'postgres:' || parsed.protocol === 'postgresql:';
      } catch {
        return false;
      }
    }, 'DATABASE_URL must be a valid PostgreSQL connection URL (postgres:// or postgresql://)')
    .refine((val) => {
      try {
        const parsed = new URL(val);
        return parsed.username === 'securecampus_app';
      } catch {
        return false;
      }
    }, "DATABASE_URL must connect exclusively using the role 'securecampus_app'")
    .refine((val) => {
      try {
        const parsed = new URL(val);
        const dbName = parsed.pathname.replace(/^\//, '');
        return dbName === 'securecampus';
      } catch {
        return false;
      }
    }, "DATABASE_URL database name must be non-empty and exactly 'securecampus'"),
  DB_POOL_MAX: z
    .coerce
    .number()
    .int('DB_POOL_MAX must be an integer')
    .min(1, 'DB_POOL_MAX must be at least 1')
    .max(100, 'DB_POOL_MAX cannot exceed 100')
    .default(10),
  DB_CONNECTION_TIMEOUT_MS: z
    .coerce
    .number()
    .int('DB_CONNECTION_TIMEOUT_MS must be an integer')
    .min(500, 'DB_CONNECTION_TIMEOUT_MS must be at least 500')
    .max(60000, 'DB_CONNECTION_TIMEOUT_MS cannot exceed 60000')
    .default(5000),
  DB_IDLE_TIMEOUT_MS: z
    .coerce
    .number()
    .int('DB_IDLE_TIMEOUT_MS must be an integer')
    .min(1000, 'DB_IDLE_TIMEOUT_MS must be at least 1000')
    .max(300000, 'DB_IDLE_TIMEOUT_MS cannot exceed 300000')
    .default(30000),
  SESSION_COOKIE_NAME: z
    .string()
    .min(1, 'SESSION_COOKIE_NAME cannot be empty')
    .default('sc_session'),
  SESSION_TTL_HOURS: z
    .coerce
    .number()
    .int('SESSION_TTL_HOURS must be an integer')
    .min(1, 'SESSION_TTL_HOURS must be at least 1')
    .max(168, 'SESSION_TTL_HOURS cannot exceed 168')
    .default(8),
  SESSION_IDLE_TIMEOUT_MINUTES: z
    .coerce
    .number()
    .int('SESSION_IDLE_TIMEOUT_MINUTES must be an integer')
    .min(5, 'SESSION_IDLE_TIMEOUT_MINUTES must be at least 5')
    .max(1440, 'SESSION_IDLE_TIMEOUT_MINUTES cannot exceed 1440')
    .default(60),
  ARGON2_MEMORY_COST: z
    .coerce
    .number()
    .int('ARGON2_MEMORY_COST must be an integer')
    .min(4096, 'ARGON2_MEMORY_COST must be at least 4096 KiB')
    .default(19456),
  ARGON2_TIME_COST: z
    .coerce
    .number()
    .int('ARGON2_TIME_COST must be an integer')
    .min(1, 'ARGON2_TIME_COST must be at least 1')
    .default(2),
  ARGON2_PARALLELISM: z
    .coerce
    .number()
    .int('ARGON2_PARALLELISM must be an integer')
    .min(1, 'ARGON2_PARALLELISM must be at least 1')
    .default(1),
});

export type RawEnv = z.infer<typeof envSchema>;

export interface EnvConfig {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  CORS_ORIGIN: string;
  corsOrigins: string[];
  DATABASE_URL: string;
  DB_POOL_MAX: number;
  DB_CONNECTION_TIMEOUT_MS: number;
  DB_IDLE_TIMEOUT_MS: number;
  SESSION_COOKIE_NAME: string;
  SESSION_TTL_HOURS: number;
  SESSION_IDLE_TIMEOUT_MINUTES: number;
  ARGON2_MEMORY_COST: number;
  ARGON2_TIME_COST: number;
  ARGON2_PARALLELISM: number;
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

  // In production under HTTPS, recommend __Host- prefix if default name was used
  let sessionCookieName = parsed.data.SESSION_COOKIE_NAME;
  if (parsed.data.NODE_ENV === 'production' && sessionCookieName === 'sc_session') {
    sessionCookieName = '__Host-sc_session';
  }

  return {
    NODE_ENV: parsed.data.NODE_ENV,
    PORT: parsed.data.PORT,
    CORS_ORIGIN: parsed.data.CORS_ORIGIN,
    corsOrigins,
    DATABASE_URL: parsed.data.DATABASE_URL,
    DB_POOL_MAX: parsed.data.DB_POOL_MAX,
    DB_CONNECTION_TIMEOUT_MS: parsed.data.DB_CONNECTION_TIMEOUT_MS,
    DB_IDLE_TIMEOUT_MS: parsed.data.DB_IDLE_TIMEOUT_MS,
    SESSION_COOKIE_NAME: sessionCookieName,
    SESSION_TTL_HOURS: parsed.data.SESSION_TTL_HOURS,
    SESSION_IDLE_TIMEOUT_MINUTES: parsed.data.SESSION_IDLE_TIMEOUT_MINUTES,
    ARGON2_MEMORY_COST: parsed.data.ARGON2_MEMORY_COST,
    ARGON2_TIME_COST: parsed.data.ARGON2_TIME_COST,
    ARGON2_PARALLELISM: parsed.data.ARGON2_PARALLELISM,
  };
}

export const config: EnvConfig = validateEnv();
