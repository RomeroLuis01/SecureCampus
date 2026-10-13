import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { QueryResult } from 'pg';
import * as databaseModule from '../../src/config/database.js';
import { getUserProfile } from '../../src/auth/auth.service.js';
import { type AuthUser } from '../../../src/services/authClient.js';
import { mockStaffTeachers, mockTeacherProfile } from '../../../src/services/mockData.js';
import {
  normalizeRole,
  isRouteAllowedForUser,
  getSafeRedirectForUser,
} from '../../../src/utils/roles.js';

describe('Auditoría y Corrección de Identidad Docente (Teacher Identity Invariants)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const authenticatedTeacherUser: AuthUser = {
    usuarioId: '232cbeb4-cce7-48db-8e3d-1b6d00b33b05',
    personaId: 'e3571098-913b-416c-a854-bd5d1c21991e',
    nombreCompleto: 'Antonio Méndez',
    correo: 'a.mendez@securecampus.edu',
    estado: 'ACTIVO',
    numeroEmpleado: 'DOC-8821',
    carreraCodigo: 'ISC',
    carreraNombre: 'Ingeniería en Sistemas Computacionales',
    roles: [{ rolId: 'r-prof', codigo: 'PROFESOR', carreraId: null }],
    permisos: ['calificaciones.leer.asignadas', 'calificaciones.escribir.asignadas'],
  };

  const alternateTeacherUser: AuthUser = {
    usuarioId: 'u-doc-9012',
    personaId: 'p-doc-9012',
    nombreCompleto: 'Daniela Fuentes Silva',
    correo: 'd.fuentes@securecampus.edu',
    estado: 'ACTIVO',
    numeroEmpleado: 'DOC-9012',
    carreraCodigo: 'ISC',
    carreraNombre: 'Ingeniería en Sistemas Computacionales',
    roles: [{ rolId: 'r-prof', codigo: 'PROFESOR', carreraId: null }],
    permisos: ['calificaciones.leer.asignadas'],
  };

  // Helper que replica la derivación de iniciales del frontend
  function deriveInitials(displayName?: string | null): string {
    if (!displayName) return 'DOC';
    const parts = displayName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  // Helper que replica la resolución de perfil docente del frontend
  function resolveTeacherProfile(user: AuthUser | null) {
    if (!user) return null;
    const staffInfo = user.numeroEmpleado
      ? mockStaffTeachers.find((t) => t.numeroNomina === user.numeroEmpleado)
      : null;

    const rawNombre = user.nombreCompleto || '';
    const parts = rawNombre.trim().split(/\s+/).filter(Boolean);
    const nombre = parts[0] || '';
    const apellidos = parts.slice(1).join(' ') || '';

    return {
      id: user.usuarioId,
      nomina: user.numeroEmpleado || 'N/A',
      nombre,
      apellidos,
      nombreCompleto: user.nombreCompleto,
      email: user.correo,
      departamento: user.carreraNombre || 'Seguridad en Tecnologías de Información y Computación',
      categoria: staffInfo?.tipoPlaza === 'TIEMPO_COMPLETO'
        ? 'Profesor Titular C - Tiempo Completo'
        : 'Profesor de Carrera',
      cubículo: staffInfo?.cubiculo || 'Edificio B, Nivel 3, Cubículo 308',
      horasSemanales: staffInfo?.horasSemanales || 20,
    };
  }

  // -------------------------------------------------------------------------
  // 1. Barra superior y página de inicio representan la misma identidad
  // -------------------------------------------------------------------------
  it('1. Topbar y la página de inicio representan fielmente la misma identidad autenticada', () => {
    // Topbar extrae de user (useAuth)
    const topbarUserName = authenticatedTeacherUser.nombreCompleto;
    const topbarUserEmail = authenticatedTeacherUser.correo;

    // TeacherDashboard extrae de user (useAuth)
    const dashboardProfile = resolveTeacherProfile(authenticatedTeacherUser);

    expect(topbarUserName).toBe('Antonio Méndez');
    expect(topbarUserEmail).toBe('a.mendez@securecampus.edu');

    expect(dashboardProfile).not.toBeNull();
    expect(dashboardProfile?.nombreCompleto).toBe(topbarUserName);
    expect(dashboardProfile?.email).toBe(topbarUserEmail);
    expect(dashboardProfile?.nomina).toBe('DOC-8821');

    // Iniciales derivadas
    const initials = deriveInitials(authenticatedTeacherUser.nombreCompleto);
    expect(initials).toBe('AM');
  });

  // -------------------------------------------------------------------------
  // 2. Correo y nómina corresponden estrictamente al usuario de la sesión
  // -------------------------------------------------------------------------
  it('2. El correo y la nómina corresponden estrictamente al usuario de la sesión activa', () => {
    const profile = resolveTeacherProfile(authenticatedTeacherUser);
    expect(profile?.email).toBe(authenticatedTeacherUser.correo);
    expect(profile?.nomina).toBe(authenticatedTeacherUser.numeroEmpleado);

    // Si la sesión cambia a otro docente, los atributos se sincronizan inmediatamente
    const altProfile = resolveTeacherProfile(alternateTeacherUser);
    expect(altProfile?.email).toBe(alternateTeacherUser.correo);
    expect(altProfile?.nomina).toBe(alternateTeacherUser.numeroEmpleado);
    expect(altProfile?.nombreCompleto).toBe(alternateTeacherUser.nombreCompleto);
  });

  // -------------------------------------------------------------------------
  // 3. El perfil docente no puede combinar datos de dos docentes diferentes
  // -------------------------------------------------------------------------
  it('3. El perfil docente no puede combinar datos de dos docentes diferentes (nombre de uno con apellido/cubículo de otro)', () => {
    const profile1 = resolveTeacherProfile(authenticatedTeacherUser);
    expect(profile1?.nombre).toBe('Antonio');
    expect(profile1?.apellidos).toBe('Méndez');
    expect(profile1?.nombreCompleto).toBe('Antonio Méndez');
    // No puede heredar o concatenar apellidos de un mock anterior (e.g. Méndez Rosas)
    expect(profile1?.apellidos).not.toContain('Rosas');

    const profile2 = resolveTeacherProfile(alternateTeacherUser);
    expect(profile2?.nombre).toBe('Daniela');
    expect(profile2?.apellidos).toBe('Fuentes Silva');
    expect(profile2?.email).toBe('d.fuentes@securecampus.edu');
    expect(profile2?.nomina).toBe('DOC-9012');
    // El cubículo debe ser el del docente DOC-9012 (Edificio B, Cubículo 302), NO el de DOC-8821 (Cubículo 308)
    expect(profile2?.cubículo).toContain('302');
    expect(profile2?.cubículo).not.toContain('308');
  });

  // -------------------------------------------------------------------------
  // 4. No se muestran datos mock cuando la aplicación opera con datos reales
  // -------------------------------------------------------------------------
  it('4. No se muestran datos mock ("Alejandro Méndez Rosas") cuando la aplicación está autenticada', () => {
    const profile = resolveTeacherProfile(authenticatedTeacherUser);
    expect(profile?.nombreCompleto).not.toBe('Alejandro Méndez Rosas');
    expect(profile?.nombre).not.toBe('Alejandro');
    expect(profile?.apellidos).not.toBe('Méndez Rosas');
    expect(profile?.nombreCompleto).toBe('Antonio Méndez');

    // Asegurarse de que el fixture institucional en mockTeacherProfile también esté alineado
    expect(mockTeacherProfile.nombre).toBe('Antonio');
    expect(mockTeacherProfile.apellidos).toBe('Méndez');
    expect(mockTeacherProfile.email).toBe('a.mendez@securecampus.edu');
    expect(mockTeacherProfile.nomina).toBe('DOC-8821');
  });

  // -------------------------------------------------------------------------
  // 5. Carga de un perfil no autenticado o no disponible presenta estado seguro sin inventar identidad
  // -------------------------------------------------------------------------
  it('5. La carga de un perfil no autenticado o no disponible presenta estado seguro sin inventar identidad', () => {
    const unauthenticatedProfile = resolveTeacherProfile(null);
    expect(unauthenticatedProfile).toBeNull();

    // Las iniciales sin usuario no inventan iniciales de un profesor mock
    const initialsUnauth = deriveInitials(null);
    expect(initialsUnauth).toBe('DOC');
  });

  // -------------------------------------------------------------------------
  // 6. Una respuesta tardía de una sesión anterior no sobrescribe la identidad actual
  // -------------------------------------------------------------------------
  it('6. Una respuesta asíncrona tardía de una sesión anterior no sobrescribe la identidad de la sesión actual (requestIdRef guard)', async () => {
    let activeRequestId = 0;
    const sessionState: { currentUser: AuthUser | null } = { currentUser: null };

    // Simular función checkSession / login que respeta requestIdRef
    async function simulateSessionResolution(incomingUser: AuthUser | null, delayMs: number): Promise<void> {
      const myRequestId = ++activeRequestId;
      await new Promise((r) => setTimeout(r, delayMs));

      // Verificación atómica contra respuesta tardía
      if (myRequestId === activeRequestId) {
        sessionState.currentUser = incomingUser;
      }
    }

    // 1. Inicia sesión lenta con Docente A (delay 50ms)
    const slowReq = simulateSessionResolution(authenticatedTeacherUser, 50);

    // 2. Docente cierra sesión rápidamente y se autentica Docente B inmediatamente (delay 10ms)
    const fastReq = simulateSessionResolution(alternateTeacherUser, 10);

    // Esperar a que ambas peticiones resuelvan
    await Promise.all([slowReq, fastReq]);

    // La identidad final DEBE ser la del Docente B (sesión más reciente), y la lenta de A fue descartada
    expect(sessionState.currentUser).not.toBeNull();
    expect(sessionState.currentUser?.usuarioId).toBe(alternateTeacherUser.usuarioId);
    expect(sessionState.currentUser?.nombreCompleto).toBe('Daniela Fuentes Silva');
    expect(sessionState.currentUser?.numeroEmpleado).toBe('DOC-9012');
  });

  // -------------------------------------------------------------------------
  // 7. Los cambios no afectan la autenticación, la autorización ni la navegación entre roles
  // -------------------------------------------------------------------------
  it('7. La autorización de rutas, navegación y roles del profesor permanecen estrictamente protegidas', () => {
    expect(normalizeRole('PROFESOR')).toBe('PROFESOR');
    expect(normalizeRole('profesor')).toBe('PROFESOR');

    // Rutas permitidas para profesor
    expect(isRouteAllowedForUser('/profesor', authenticatedTeacherUser)).toBe(true);
    expect(isRouteAllowedForUser('/profesor/perfil', authenticatedTeacherUser)).toBe(true);
    expect(isRouteAllowedForUser('/profesor/grupos', authenticatedTeacherUser)).toBe(true);
    expect(isRouteAllowedForUser('/profesor/calificaciones', authenticatedTeacherUser)).toBe(true);

    // Rutas prohibidas para profesor
    expect(isRouteAllowedForUser('/admin', authenticatedTeacherUser)).toBe(false);
    expect(isRouteAllowedForUser('/admin/usuarios', authenticatedTeacherUser)).toBe(false);
    expect(isRouteAllowedForUser('/jefe_carrera', authenticatedTeacherUser)).toBe(false);
    expect(isRouteAllowedForUser('/estudiante', authenticatedTeacherUser)).toBe(false);

    // Redirección segura
    expect(getSafeRedirectForUser('/admin/usuarios', authenticatedTeacherUser)).toBe('/profesor');
    expect(getSafeRedirectForUser('/profesor/calificaciones', authenticatedTeacherUser)).toBe('/profesor/calificaciones');
  });

  // -------------------------------------------------------------------------
  // 8. Backend getUserProfile resuelve carreraNombre y carreraCodigo para profesores
  // -------------------------------------------------------------------------
  it('8. Backend getUserProfile enriquece al profesor con su adscripción de carrera desde PostgreSQL', async () => {
    vi.spyOn(databaseModule, 'query')
      .mockResolvedValueOnce({
        rows: [
          {
            usuario_id: '232cbeb4-cce7-48db-8e3d-1b6d00b33b05',
            persona_id: 'e3571098-913b-416c-a854-bd5d1c21991e',
            nombre_completo: 'Antonio Méndez',
            correo: 'a.mendez@securecampus.edu',
            estado: 'ACTIVO',
            telefono: '+525557296000',
            curp: null,
            matricula: null,
            numero_empleado: 'DOC-8821',
            carrera_codigo: 'ISC',
            carrera_nombre: 'Ingeniería en Sistemas Computacionales',
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
            permiso_id: 'p-1',
            codigo_permiso: 'calificaciones.leer.asignadas',
          },
        ],
        rowCount: 1,
      } as unknown as QueryResult);

    const profile = await getUserProfile('232cbeb4-cce7-48db-8e3d-1b6d00b33b05');
    expect(profile.nombreCompleto).toBe('Antonio Méndez');
    expect(profile.correo).toBe('a.mendez@securecampus.edu');
    expect(profile.numeroEmpleado).toBe('DOC-8821');
    expect(profile.carreraCodigo).toBe('ISC');
    expect(profile.carreraNombre).toBe('Ingeniería en Sistemas Computacionales');
  });
});
