import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { QueryResult } from 'pg';
import { authenticate, resolveUserByIdentifier } from '../../src/auth/auth.service.js';
import * as databaseModule from '../../src/config/database.js';
import * as argon2Service from '../../src/auth/argon2.service.js';
import { AppClientError } from '../../src/middleware/errorHandler.js';

describe('auth.service (Unit Tests)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. resolveUserByIdentifier detects ambiguous matches when more than one candidate exists', async () => {
    vi.spyOn(databaseModule, 'query').mockResolvedValueOnce({
      rows: [
        { usuario_id: 'user-1', persona_id: 'p-1' },
        { usuario_id: 'user-2', persona_id: 'p-2' },
      ],
      rowCount: 2,
    } as unknown as QueryResult);

    const result = await resolveUserByIdentifier('12345');

    expect(result.isAmbiguous).toBe(true);
    expect(result.rows).toHaveLength(2);
  });

  it('2. authenticate executes verifyDummy and throws generic 401 when user is not found', async () => {
    vi.spyOn(databaseModule, 'query').mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
    } as unknown as QueryResult);

    const dummySpy = vi.spyOn(argon2Service, 'verifyDummy');

    await expect(
      authenticate({
        identifier: 'inexistente@securecampus.edu',
        password: 'PasswordInexistente123!',
      })
    ).rejects.toThrow(AppClientError);

    expect(dummySpy).toHaveBeenCalledWith('PasswordInexistente123!');
  });

  it('3. authenticate executes verifyDummy and throws 401 when account is temporarily locked', async () => {
    const lockedUntil = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes in the future
    const validUserId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

    vi.spyOn(databaseModule, 'query')
      .mockResolvedValueOnce({
        rows: [
          {
            usuario_id: validUserId,
            persona_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
            nombre_completo: 'Usuario Bloqueado',
            correo: 'bloqueado@securecampus.edu',
            estado_usuario: 'ACTIVO',
            password_hash: '$argon2id$v=19$m=19456,t=2,p=1$fakehash',
            estado_credencial: 'ACTIVO',
            intentos_fallidos: 5,
            bloqueado_hasta: lockedUntil,
          },
        ],
        rowCount: 1,
      } as unknown as QueryResult)
      .mockResolvedValueOnce({
        rows: [],
        rowCount: 1,
      } as unknown as QueryResult);

    const dummySpy = vi.spyOn(argon2Service, 'verifyDummy');

    await expect(
      authenticate({
        identifier: 'bloqueado@securecampus.edu',
        password: 'CualquierPassword!',
      })
    ).rejects.toThrow(AppClientError);

    expect(dummySpy).toHaveBeenCalledWith('CualquierPassword!');
  });

  it('4. authenticate handles concurrent lockout race: aborts session creation if success update matches 0 rows', async () => {
    // 1. Initial lookup finds user
    vi.spyOn(databaseModule, 'query')
      .mockResolvedValueOnce({
        rows: [
          {
            usuario_id: 'user-race-uuid',
            persona_id: 'persona-race-uuid',
            nombre_completo: 'Usuario Carrera',
            correo: 'carrera@securecampus.edu',
            estado_usuario: 'ACTIVO',
            password_hash: '$argon2id$v=19$m=19456,t=2,p=1$validhash',
            estado_credencial: 'ACTIVO',
            intentos_fallidos: 4,
            bloqueado_hasta: null,
          },
        ],
        rowCount: 1,
      } as unknown as QueryResult)
      // 2. Success reset returns rowCount 0 because another request locked it concurrently!
      .mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as unknown as QueryResult)
      // 3. Audit log call
      .mockResolvedValueOnce({
        rows: [],
        rowCount: 1,
      } as unknown as QueryResult);

    vi.spyOn(argon2Service, 'verifyPassword').mockResolvedValueOnce(true);

    await expect(
      authenticate({
        identifier: 'carrera@securecampus.edu',
        password: 'PasswordCorrecto!',
      })
    ).rejects.toThrow('Credenciales inválidas');
  });
});
