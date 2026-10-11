import { describe, it, expect, vi } from 'vitest';
import argon2 from '@node-rs/argon2';
import {
  hashPassword,
  verifyPassword,
  verifyDummy,
  getDummyHash,
} from '../../src/auth/argon2.service.js';
import { config } from '../../src/config/env.js';

describe('argon2.service (Unit Tests)', () => {
  it('1. Generates a valid Argon2id PHC formatted hash with configured parameters', async () => {
    const rawPass = 'SuperClaveInstitucional2026!';
    const hash = await hashPassword(rawPass);

    expect(hash).toBeTypeOf('string');
    expect(hash.startsWith('$argon2id$v=19$')).toBe(true);
    expect(hash).toContain(`m=${config.ARGON2_MEMORY_COST}`);
    expect(hash).toContain(`t=${config.ARGON2_TIME_COST}`);
    expect(hash).toContain(`p=${config.ARGON2_PARALLELISM}`);
  });

  it('2. Successfully verifies matching password and rejects incorrect password', async () => {
    const rawPass = 'ContrasenaCorrecta123!';
    const hash = await hashPassword(rawPass);

    const matches = await verifyPassword(hash, rawPass);
    const doesNotMatch = await verifyPassword(hash, 'ContrasenaIncorrecta999!');

    expect(matches).toBe(true);
    expect(doesNotMatch).toBe(false);
  });

  it('3. Dummy hash is pre-initialized with identical Argon2id configuration', () => {
    const dummy = getDummyHash();

    expect(dummy).toBeTypeOf('string');
    expect(dummy.startsWith('$argon2id$v=19$')).toBe(true);
    expect(dummy).toContain(`m=${config.ARGON2_MEMORY_COST}`);
    expect(dummy).toContain(`t=${config.ARGON2_TIME_COST}`);
    expect(dummy).toContain(`p=${config.ARGON2_PARALLELISM}`);
  });

  it('4. verifyDummy always resolves to false while invoking argon2.verify', async () => {
    const verifySpy = vi.spyOn(argon2, 'verify');

    const result = await verifyDummy('claveCualquiera');

    expect(result).toBe(false);
    expect(verifySpy).toHaveBeenCalled();
    expect(verifySpy).toHaveBeenCalledWith(getDummyHash(), 'claveCualquiera');

    verifySpy.mockRestore();
  });
});
