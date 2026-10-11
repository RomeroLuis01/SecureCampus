import argon2 from '@node-rs/argon2';
import { config } from '../config/env.js';

export interface Argon2Options {
  memoryCost: number;
  timeCost: number;
  parallelism: number;
}

const argon2Config: Argon2Options = {
  memoryCost: config.ARGON2_MEMORY_COST,
  timeCost: config.ARGON2_TIME_COST,
  parallelism: config.ARGON2_PARALLELISM,
};

/**
 * Pre-computed synthetic hash generated at module initialization with identical
 * Argon2id parameters (m, t, p) as genuine user credentials.
 * Used during authentication attempts for non-existent or locked accounts to ensure
 * constant-time CPU consumption and eliminate timing side-channel leaks.
 */
let dummyHashCache: string = '';

export async function initDummyHash(): Promise<string> {
  if (!dummyHashCache) {
    // Generate deterministic placeholder with current active parameters
    dummyHashCache = await argon2.hash('__SECURE_CAMPUS_SYNTHETIC_TIMING_DUMMY__', {
      algorithm: argon2.Algorithm.Argon2id,
      memoryCost: argon2Config.memoryCost,
      timeCost: argon2Config.timeCost,
      parallelism: argon2Config.parallelism,
    });
  }
  return dummyHashCache;
}

// Initialize dummy hash eagerly
await initDummyHash();

/**
 * Returns the currently cached dummy hash for verification in tests.
 */
export function getDummyHash(): string {
  return dummyHashCache;
}

/**
 * Hashes a plaintext password using Argon2id with institutional parameters.
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    algorithm: argon2.Algorithm.Argon2id,
    memoryCost: argon2Config.memoryCost,
    timeCost: argon2Config.timeCost,
    parallelism: argon2Config.parallelism,
  });
}

/**
 * Verifies a plaintext password against a stored PHC Argon2id hash.
 */
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

/**
 * Computes verification against the pre-generated synthetic dummy hash.
 * Always resolves to false while spending identical CPU cycles as a valid hash comparison.
 */
export async function verifyDummy(password: string): Promise<boolean> {
  try {
    await argon2.verify(dummyHashCache, password);
  } catch {
    // Suppress any errors from dummy verification
  }
  return false;
}
