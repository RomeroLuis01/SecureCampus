import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { QueryResult } from 'pg';
import {
  authenticate,
  resolveUserByIdentifier,
  getUserProfile,
  logout,
} from '../../src/auth/auth.service.js';
import * as databaseModule from '../../src/config/database.js';
import * as argon2Service from '../../src/auth/argon2.service.js';
import * as sessionService from '../../src/auth/session.service.js';
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

  it('5. authenticate succeeds with valid credentials and returns session token + profile', async () => {
    const validUserId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    const validPersonaId = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';

    // 1. resolveUserByIdentifier query
    vi.spyOn(databaseModule, 'query')
      .mockResolvedValueOnce({
        rows: [
          {
            usuario_id: validUserId,
            persona_id: validPersonaId,
            nombre_completo: 'Valeria Morales',
            correo: 'v.morales@securecampus.edu',
            estado_usuario: 'ACTIVO',
            password_hash: '$argon2id$v=19$m=19456,t=2,p=1$correcthash',
            estado_credencial: 'ACTIVO',
            intentos_fallidos: 0,
            bloqueado_hasta: null,
          },
        ],
        rowCount: 1,
      } as unknown as QueryResult)
      // 2. Success reset query
      .mockResolvedValueOnce({
        rows: [{ usuario_id: validUserId }],
        rowCount: 1,
      } as unknown as QueryResult)
      // 3. Audit log query (AUTH_LOGIN EXITO)
      .mockResolvedValueOnce({
        rows: [],
        rowCount: 1,
      } as unknown as QueryResult)
      // 4. getUserProfile -> user info query
      .mockResolvedValueOnce({
        rows: [
          {
            usuario_id: validUserId,
            persona_id: validPersonaId,
            nombre_completo: 'Valeria Morales',
            correo: 'v.morales@securecampus.edu',
            estado: 'ACTIVO',
            telefono: '5551234567',
            curp: 'MORV030514HDFRLA02',
            matricula: '202301042',
            numero_empleado: null,
            carrera_codigo: 'ISC',
            carrera_nombre: 'Ingeniería en Sistemas Computacionales',
          },
        ],
        rowCount: 1,
      } as unknown as QueryResult)
      // 5. getUserProfile -> permissions query
      .mockResolvedValueOnce({
        rows: [
          {
            rol_id: 'r-alumno',
            codigo_rol: 'ALUMNO',
            carrera_id: null,
            permiso_id: 'perm-1',
            codigo_permiso: 'perfil.leer.propio',
          },
        ],
        rowCount: 1,
      } as unknown as QueryResult);

    vi.spyOn(argon2Service, 'verifyPassword').mockResolvedValueOnce(true);
    vi.spyOn(sessionService, 'createSession').mockResolvedValueOnce({
      rawToken: 'mock-raw-token-123',
      sesionId: 's-123',
      expiraEn: new Date(Date.now() + 3600000),
    });

    const res = await authenticate({
      identifier: 'v.morales@securecampus.edu',
      password: 'ValidPassword123!',
    });

    expect(res.rawToken).toBe('mock-raw-token-123');
    expect(res.user.nombreCompleto).toBe('Valeria Morales');
    expect(res.user.matricula).toBe('202301042');
    expect(res.user.carreraNombre).toBe('Ingeniería en Sistemas Computacionales');
    expect(res.user.roles[0].codigo).toBe('ALUMNO');
  });

  it('6. authenticate with incorrect password increments failure count and throws 401', async () => {
    const validUserId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

    vi.spyOn(databaseModule, 'query')
      .mockResolvedValueOnce({
        rows: [
          {
            usuario_id: validUserId,
            persona_id: 'p-123',
            nombre_completo: 'Valeria Morales',
            correo: 'v.morales@securecampus.edu',
            estado_usuario: 'ACTIVO',
            password_hash: '$argon2id$v=19$m=19456,t=2,p=1$correcthash',
            estado_credencial: 'ACTIVO',
            intentos_fallidos: 1,
            bloqueado_hasta: null,
          },
        ],
        rowCount: 1,
      } as unknown as QueryResult)
      // Update failure count query
      .mockResolvedValueOnce({
        rows: [{ intentos_fallidos: 2, bloqueado_hasta: null }],
        rowCount: 1,
      } as unknown as QueryResult)
      // Audit log query
      .mockResolvedValueOnce({
        rows: [],
        rowCount: 1,
      } as unknown as QueryResult);

    vi.spyOn(argon2Service, 'verifyPassword').mockResolvedValueOnce(false);

    await expect(
      authenticate({
        identifier: 'v.morales@securecampus.edu',
        password: 'WrongPassword!',
      })
    ).rejects.toThrow('Credenciales inválidas');
  });

  it('7. authenticate rejects suspended or inactive user with generic 401 (enumeration defense)', async () => {
    vi.spyOn(databaseModule, 'query').mockResolvedValueOnce({
      rows: [
        {
          usuario_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          persona_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
          nombre_completo: 'Usuario Suspendido',
          correo: 'suspendido@securecampus.edu',
          estado_usuario: 'SUSPENDIDO',
          password_hash: '$argon2id$v=19$m=19456,t=2,p=1$somehash',
          estado_credencial: 'ACTIVO',
          intentos_fallidos: 0,
          bloqueado_hasta: null,
        },
      ],
      rowCount: 1,
    } as unknown as QueryResult);

    vi.spyOn(argon2Service, 'verifyDummy');

    await expect(
      authenticate({
        identifier: 'suspendido@securecampus.edu',
        password: 'AnyPassword!',
      })
    ).rejects.toThrow('Credenciales inválidas');
  });

  it('8. getUserProfile returns enriched student attributes from PostgreSQL', async () => {
    vi.spyOn(databaseModule, 'query')
      .mockResolvedValueOnce({
        rows: [
          {
            usuario_id: 'u-alu',
            persona_id: 'p-alu',
            nombre_completo: 'Valeria Morales',
            correo: 'v.morales@securecampus.edu',
            estado: 'ACTIVO',
            telefono: '5551234567',
            curp: 'MORV030514HDFRLA02',
            matricula: '202301042',
            numero_empleado: null,
            carrera_codigo: 'ISC',
            carrera_nombre: 'Ingeniería en Sistemas Computacionales',
          },
        ],
        rowCount: 1,
      } as unknown as QueryResult)
      .mockResolvedValueOnce({
        rows: [
          {
            rol_id: 'r-alu',
            codigo_rol: 'ALUMNO',
            carrera_id: null,
            permiso_id: 'p-1',
            codigo_permiso: 'perfil.leer.propio',
          },
        ],
        rowCount: 1,
      } as unknown as QueryResult);

    const profile = await getUserProfile('u-alu');
    expect(profile.matricula).toBe('202301042');
    expect(profile.numeroEmpleado).toBeNull();
    expect(profile.carreraNombre).toBe('Ingeniería en Sistemas Computacionales');
    expect(profile.telefono).toBe('5551234567');
    expect(profile.curp).toBe('MORV030514HDFRLA02');
    expect(profile.roles[0].codigo).toBe('ALUMNO');
  });

  it('9. getUserProfile returns enriched professor attributes from PostgreSQL', async () => {
    vi.spyOn(databaseModule, 'query')
      .mockResolvedValueOnce({
        rows: [
          {
            usuario_id: 'u-prof',
            persona_id: 'p-prof',
            nombre_completo: 'Antonio Méndez',
            correo: 'a.mendez@securecampus.edu',
            estado: 'ACTIVO',
            telefono: '5559876543',
            curp: null,
            matricula: null,
            numero_empleado: 'DOC-8821',
            carrera_codigo: null,
            carrera_nombre: null,
          },
        ],
        rowCount: 1,
      } as unknown as QueryResult)
      .mockResolvedValueOnce({
        rows: [
          {
            rol_id: 'r-prof',
            codigo_rol: 'PROFESOR',
            carrera_id: null,
            permiso_id: 'p-prof-1',
            codigo_permiso: 'calificaciones.leer.asignadas',
          },
        ],
        rowCount: 1,
      } as unknown as QueryResult);

    const profile = await getUserProfile('u-prof');
    expect(profile.numeroEmpleado).toBe('DOC-8821');
    expect(profile.matricula).toBeNull();
    expect(profile.roles[0].codigo).toBe('PROFESOR');
  });

  it('10. getUserProfile throws 404 when user is not found in database', async () => {
    vi.spyOn(databaseModule, 'query').mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
    } as unknown as QueryResult);

    await expect(getUserProfile('non-existent-user')).rejects.toThrow('Usuario no encontrado');
  });

  it('11. logout revokes session token and records audit event in database', async () => {
    const revokeSpy = vi.spyOn(sessionService, 'revokeSession').mockResolvedValueOnce();
    const querySpy = vi.spyOn(databaseModule, 'query').mockResolvedValueOnce({
      rows: [],
      rowCount: 1,
    } as unknown as QueryResult);

    await logout('session-token-to-revoke', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '127.0.0.1', 'Mozilla/5.0');

    expect(revokeSpy).toHaveBeenCalledWith('session-token-to-revoke');
    expect(querySpy).toHaveBeenCalledTimes(1);
  });
});
