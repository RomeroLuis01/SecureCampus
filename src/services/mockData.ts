// Servicios de datos simulados para SecureCampus
// Basado en el esquema relacional institucional y roles académicos

export interface StudentProfile {
  id: string
  matricula: string
  curp: string
  nombre: string
  apellidos: string
  email: string
  telefono: string
  direccion: string
  fechaNacimiento: string
  genero: string
  carrera: string
  planEstudios: string
  semestre: string
  turno: string
  campus: string
  promedioGeneral: number
  creditosAcumulados: number
  creditosTotales: number
  estado: 'REGULAR' | 'CONDICIONAL' | 'BAJA'
  contactoEmergencia: {
    nombre: string
    parentesco: string
    telefono: string
  }
}

export interface EnrolledSubject {
  codigo: string
  nombre: string
  profesor: string
  aula: string
  horario: string
  creditos: number
  asistencia: number
  parcial1: number
  parcial2: number
  parcial3?: number
  promedioActual: number
  estado: 'success' | 'warning' | 'danger'
}

export interface AcademicRequest {
  id: string
  folio: string
  tipo: string
  fechaSolicitud: string
  estado: 'APROBADA' | 'EN_REVISION' | 'RECHAZADA'
  detalles: string
  descargable: boolean
}

export interface KardexPeriod {
  periodo: string
  esActivo: boolean
  promedioPeriodo: number
  creditosAprobados: number
  materias: {
    codigo: string
    asignatura: string
    profesor: string
    creditos: number
    tipoEvaluacion: 'ORDINARIO' | 'EXTRAORDINARIO'
    calificacionFinal: number
    estado: 'APROBADA' | 'REPROBADA'
  }[]
}

export interface SystemUser {
  id: string
  identificador: string
  nombre: string
  email: string
  rol: 'Estudiante' | 'Profesor' | 'Administrador' | 'Jefe de Carrera'
  estatus: 'ACTIVO' | 'SUSPENDIDO' | 'BLOQUEADO'
  mfaHabilitado: boolean
  ultimoAcceso: string
}

export interface AuditLog {
  id: string
  timestamp: string
  usuario: string
  rol: string
  accion: string
  ip: string
  nivel: 'INFO' | 'WARNING' | 'CRITICAL'
}

// 1. Estudiante Mock
export const mockStudentProfile: StudentProfile = {
  id: 'est-001',
  matricula: '202301042',
  curp: 'MORV030514HDFRLA02',
  nombre: 'Valeria Sofía',
  apellidos: 'Morales Rivas',
  email: 'v.morales@securecampus.edu',
  telefono: '+52 (55) 8492-1049',
  direccion: 'Av. Politécnico Nacional 1240, Col. San Pedro, CDMX',
  fechaNacimiento: '14 de Mayo de 2003',
  genero: 'Femenino',
  carrera: 'Ingeniería en Ciberseguridad y Redes',
  planEstudios: 'PLAN-CIBER-2022',
  semestre: '6to Semestre',
  turno: 'Matutino',
  campus: 'Campus Central / Edificio de Tecnologías',
  promedioGeneral: 9.48,
  creditosAcumulados: 184,
  creditosTotales: 260,
  estado: 'REGULAR',
  contactoEmergencia: {
    nombre: 'Elena Rivas Sandoval',
    parentesco: 'Madre',
    telefono: '+52 (55) 7731-9920',
  },
}

// 2. Asignaturas Cursadas Actualmente
export const mockCurrentSubjects: EnrolledSubject[] = [
  {
    codigo: 'CS-601',
    nombre: 'Seguridad en Aplicaciones Web y DevSecOps',
    profesor: 'Dr. Alejandro Méndez Rosas',
    aula: 'Lab Redes 3',
    horario: 'Lun, Mié 07:00 - 09:00',
    creditos: 8,
    asistencia: 96,
    parcial1: 9.8,
    parcial2: 9.5,
    promedioActual: 9.65,
    estado: 'success',
  },
  {
    codigo: 'CS-602',
    nombre: 'Criptografía Aplicada y PKI',
    profesor: 'Mtra. Daniela Fuentes Silva',
    aula: 'Aula Magna 102',
    horario: 'Mar, Jue 09:00 - 11:00',
    creditos: 8,
    asistencia: 92,
    parcial1: 9.2,
    parcial2: 9.0,
    promedioActual: 9.1,
    estado: 'success',
  },
  {
    codigo: 'CS-603',
    nombre: 'Análisis Forense y Respuesta a Incidentes',
    profesor: 'Ing. Carlos Beltrán Orozco',
    aula: 'Lab Ciberforense 1',
    horario: 'Vie 07:00 - 11:00',
    creditos: 8,
    asistencia: 88,
    parcial1: 8.5,
    parcial2: 8.0,
    promedioActual: 8.25,
    estado: 'success',
  },
  {
    codigo: 'CS-604',
    nombre: 'Auditoría de Redes y Ethical Hacking',
    profesor: 'Dr. Rodrigo Salazar Vega',
    aula: 'Lab Redes 2',
    horario: 'Lun, Mié 11:00 - 13:00',
    creditos: 8,
    asistencia: 94,
    parcial1: 9.9,
    parcial2: 9.7,
    promedioActual: 9.8,
    estado: 'success',
  },
  {
    codigo: 'CS-605',
    nombre: 'Gobernanza y Cumplimiento Normativo (ISO 27001)',
    profesor: 'Lic. Claudia Nava Jiménez',
    aula: 'Aula 204-B',
    horario: 'Mar, Jue 11:00 - 13:00',
    creditos: 6,
    asistencia: 80,
    parcial1: 7.5,
    parcial2: 7.2,
    promedioActual: 7.35,
    estado: 'warning',
  },
]

// 3. Solicitudes y Trámites
export const mockRequests: AcademicRequest[] = [
  {
    id: 'req-1',
    folio: 'SOL-2026-8841',
    tipo: 'Constancia de Estudios con Calificaciones',
    fechaSolicitud: '18 Sep 2026',
    estado: 'APROBADA',
    detalles: 'Documento expedido y firmado con sello criptográfico digital.',
    descargable: true,
  },
  {
    id: 'req-2',
    folio: 'SOL-2026-8910',
    tipo: 'Carta de Asignación de Servicio Social',
    fechaSolicitud: '20 Sep 2026',
    estado: 'EN_REVISION',
    detalles: 'En validación por la Dirección de Vinculación Universitaria.',
    descargable: false,
  },
]

// 4. Historial Completo de Kárdex
export const mockKardexHistory: KardexPeriod[] = [
  {
    periodo: 'Periodo 2026-B (Actual)',
    esActivo: true,
    promedioPeriodo: 9.48,
    creditosAprobados: 38,
    materias: [
      {
        codigo: 'CS-601',
        asignatura: 'Seguridad en Aplicaciones Web y DevSecOps',
        profesor: 'Dr. Alejandro Méndez Rosas',
        creditos: 8,
        tipoEvaluacion: 'ORDINARIO',
        calificacionFinal: 9.65,
        estado: 'APROBADA',
      },
      {
        codigo: 'CS-602',
        asignatura: 'Criptografía Aplicada y PKI',
        profesor: 'Mtra. Daniela Fuentes Silva',
        creditos: 8,
        tipoEvaluacion: 'ORDINARIO',
        calificacionFinal: 9.1,
        estado: 'APROBADA',
      },
      {
        codigo: 'CS-603',
        asignatura: 'Análisis Forense y Respuesta a Incidentes',
        profesor: 'Ing. Carlos Beltrán Orozco',
        creditos: 8,
        tipoEvaluacion: 'ORDINARIO',
        calificacionFinal: 8.25,
        estado: 'APROBADA',
      },
      {
        codigo: 'CS-604',
        asignatura: 'Auditoría de Redes y Ethical Hacking',
        profesor: 'Dr. Rodrigo Salazar Vega',
        creditos: 8,
        tipoEvaluacion: 'ORDINARIO',
        calificacionFinal: 9.8,
        estado: 'APROBADA',
      },
      {
        codigo: 'CS-605',
        asignatura: 'Gobernanza y Cumplimiento Normativo',
        profesor: 'Lic. Claudia Nava Jiménez',
        creditos: 6,
        tipoEvaluacion: 'ORDINARIO',
        calificacionFinal: 7.35,
        estado: 'APROBADA',
      },
    ],
  },
  {
    periodo: 'Periodo 2026-A',
    esActivo: false,
    promedioPeriodo: 9.6,
    creditosAprobados: 40,
    materias: [
      {
        codigo: 'CS-501',
        asignatura: 'Arquitectura de Redes Empresariales',
        profesor: 'Mtro. Héctor Godínez',
        creditos: 8,
        tipoEvaluacion: 'ORDINARIO',
        calificacionFinal: 10.0,
        estado: 'APROBADA',
      },
      {
        codigo: 'CS-502',
        asignatura: 'Sistemas Operativos y Kernel Hardening',
        profesor: 'Dr. Fernando Larios',
        creditos: 8,
        tipoEvaluacion: 'ORDINARIO',
        calificacionFinal: 9.5,
        estado: 'APROBADA',
      },
      {
        codigo: 'CS-503',
        asignatura: 'Bases de Datos Seguras y SQL Hardening',
        profesor: 'Dra. Rebeca Montero',
        creditos: 8,
        tipoEvaluacion: 'ORDINARIO',
        calificacionFinal: 9.8,
        estado: 'APROBADA',
      },
      {
        codigo: 'CS-504',
        asignatura: 'Programación en C/C++ y Análisis de Binarios',
        profesor: 'Ing. Manuel Tamayo',
        creditos: 8,
        tipoEvaluacion: 'ORDINARIO',
        calificacionFinal: 9.1,
        estado: 'APROBADA',
      },
      {
        codigo: 'CS-505',
        asignatura: 'Ética y Legislación en Tecnologías Digitales',
        profesor: 'Mtro. Jorge Paredes',
        creditos: 8,
        tipoEvaluacion: 'ORDINARIO',
        calificacionFinal: 9.6,
        estado: 'APROBADA',
      },
    ],
  },
  {
    periodo: 'Periodo 2025-B',
    esActivo: false,
    promedioPeriodo: 9.35,
    creditosAprobados: 36,
    materias: [
      {
        codigo: 'CS-401',
        asignatura: 'Estructuras de Datos y Algoritmos',
        profesor: 'Dr. Óscar Villegas',
        creditos: 8,
        tipoEvaluacion: 'ORDINARIO',
        calificacionFinal: 9.4,
        estado: 'APROBADA',
      },
      {
        codigo: 'CS-402',
        asignatura: 'Probabilidad, Estadística e Inferencia',
        profesor: 'Mtra. Laura Esquivel',
        creditos: 8,
        tipoEvaluacion: 'ORDINARIO',
        calificacionFinal: 9.0,
        estado: 'APROBADA',
      },
      {
        codigo: 'CS-403',
        asignatura: 'Fundamentos de Conectividad TCP/IP',
        profesor: 'Ing. Carlos Beltrán',
        creditos: 8,
        tipoEvaluacion: 'ORDINARIO',
        calificacionFinal: 9.7,
        estado: 'APROBADA',
      },
    ],
  },
]

// 5. Usuarios Administrativos
export const mockAdminUsers: SystemUser[] = [
  {
    id: 'usr-001',
    identificador: '202301042',
    nombre: 'Valeria Sofía Morales Rivas',
    email: 'v.morales@securecampus.edu',
    rol: 'Estudiante',
    estatus: 'ACTIVO',
    mfaHabilitado: true,
    ultimoAcceso: 'Hoy a las 14:32',
  },
  {
    id: 'usr-002',
    identificador: 'DOC-8821',
    nombre: 'Dr. Alejandro Méndez Rosas',
    email: 'a.mendez@securecampus.edu',
    rol: 'Profesor',
    estatus: 'ACTIVO',
    mfaHabilitado: true,
    ultimoAcceso: 'Hoy a las 12:15',
  },
  {
    id: 'usr-003',
    identificador: 'ADM-001',
    nombre: 'Mtro. Roberto Morales Salazar',
    email: 'r.morales@securecampus.edu',
    rol: 'Administrador',
    estatus: 'ACTIVO',
    mfaHabilitado: true,
    ultimoAcceso: 'En línea',
  },
  {
    id: 'usr-004',
    identificador: 'JEF-004',
    nombre: 'Dra. Gabriela Solís Garza',
    email: 'g.solis@securecampus.edu',
    rol: 'Jefe de Carrera',
    estatus: 'ACTIVO',
    mfaHabilitado: true,
    ultimoAcceso: 'Ayer a las 18:40',
  },
  {
    id: 'usr-005',
    identificador: '202102004',
    nombre: 'Carlos Eduardo Ramírez Peña',
    email: 'c.ramirez@securecampus.edu',
    rol: 'Estudiante',
    estatus: 'SUSPENDIDO',
    mfaHabilitado: false,
    ultimoAcceso: 'Hace 3 días',
  },
  {
    id: 'usr-006',
    identificador: 'DOC-9012',
    nombre: 'Mtra. Daniela Fuentes Silva',
    email: 'd.fuentes@securecampus.edu',
    rol: 'Profesor',
    estatus: 'ACTIVO',
    mfaHabilitado: true,
    ultimoAcceso: 'Hoy a las 09:10',
  },
]

// 6. Bitácora de Auditoría de Seguridad
export const mockAuditLogs: AuditLog[] = [
  {
    id: 'log-1',
    timestamp: '2026-09-21 03:32:10',
    usuario: 'Mtro. Roberto Morales (ADM-001)',
    rol: 'Administrador',
    accion: 'Cierre y firma digital de acta ordinaria Grupo CS601-A',
    ip: '192.168.10.45',
    nivel: 'INFO',
  },
  {
    id: 'log-2',
    timestamp: '2026-09-21 03:15:02',
    usuario: 'Dr. Alejandro Méndez (DOC-8821)',
    rol: 'Profesor',
    accion: 'Captura de calificaciones Parcial 2 - 28 registros',
    ip: '192.168.10.88',
    nivel: 'INFO',
  },
  {
    id: 'log-3',
    timestamp: '2026-09-20 22:50:18',
    usuario: 'Carlos Ramírez (202102004)',
    rol: 'Estudiante',
    accion: 'Intento de acceso con credenciales incorrectas (3 fallos)',
    ip: '201.144.92.11',
    nivel: 'WARNING',
  },
  {
    id: 'log-4',
    timestamp: '2026-09-20 21:05:44',
    usuario: 'Sistema Central (Cron Daemon)',
    rol: 'Sistema',
    accion: 'Copia de seguridad criptográfica de base de datos exitosa',
    ip: '127.0.0.1',
    nivel: 'INFO',
  },
]

// 7. Módulo Profesor: Interfaces y Datos
export interface TeacherProfile {
  id: string
  nomina: string
  nombre: string
  apellidos: string
  email: string
  telefono: string
  departamento: string
  categoria: string
  cubículo: string
  horasSemanales: number
  gruposActivos: number
}

export interface StudentGradeEntry {
  id: string
  matricula: string
  nombre: string
  asistencia: number
  parcial1?: number | null
  parcial2?: number | null
  parcial3?: number | null
  parcial4?: number | null
  parcial5?: number | null
  parcial6?: number | null
  proyecto?: number | null
  parciales?: Record<number, number | null>
  final: number | null
  estado: 'APROBADO' | 'REPROBADO' | 'PENDIENTE'
}

export interface TeacherGroup {
  id: string
  clave: string
  materia: string
  grupo: string
  semestre: string
  aula: string
  horario: string
  alumnosInscritos: number
  cupoMaximo: number
  numeroParciales: number
  periodo: string
  estatusActa: 'ABIERTA' | 'EN_CAPTURA' | 'CERRADA_FIRMADA'
  fechaLimite: string
  estudiantes: StudentGradeEntry[]
}

export const mockTeacherProfile: TeacherProfile = {
  id: 'doc-8821',
  nomina: 'DOC-8821',
  nombre: 'Alejandro',
  apellidos: 'Méndez Rosas',
  email: 'a.mendez@securecampus.edu',
  telefono: '+52 (55) 5729-6000 ext. 5412',
  departamento: 'Seguridad en Tecnologías de Información y Computación',
  categoria: 'Profesor Titular C - Tiempo Completo',
  cubículo: 'Edificio B, Nivel 3, Cubículo 308',
  horasSemanales: 20,
  gruposActivos: 3,
}

export const mockTeacherGroups: TeacherGroup[] = [
  {
    id: 'grp-601-a',
    clave: 'CS-601',
    materia: 'Seguridad en Aplicaciones Web y DevSecOps',
    grupo: '6CV1',
    semestre: '6to Semestre',
    aula: 'Lab Redes 3',
    horario: 'Lun, Mié 07:00 - 09:00',
    alumnosInscritos: 28,
    cupoMaximo: 30,
    numeroParciales: 3,
    periodo: '2026-B',
    estatusActa: 'EN_CAPTURA',
    fechaLimite: '28 de Septiembre de 2026',
    estudiantes: [
      {
        id: 'est-1',
        matricula: '202301042',
        nombre: 'Valeria Sofía Morales Rivas',
        parcial1: 95,
        parcial2: 95,
        parcial3: 100,
        parciales: { 1: 95, 2: 95, 3: 100 },
        final: 97,
        asistencia: 96,
        estado: 'APROBADO',
      },
      {
        id: 'est-2',
        matricula: '202203091',
        nombre: 'Diego Alejandro Torres Lozano',
        parcial1: 85,
        parcial2: 82,
        parcial3: 88,
        parciales: { 1: 85, 2: 82, 3: 88 },
        final: 85,
        asistencia: 90,
        estado: 'APROBADO',
      },
      {
        id: 'est-3',
        matricula: '202401118',
        nombre: 'Mariana Camila Ortiz Mendoza',
        parcial1: 72,
        parcial2: 70,
        parcial3: 75,
        parciales: { 1: 72, 2: 70, 3: 75 },
        final: 72,
        asistencia: 82,
        estado: 'APROBADO',
      },
      {
        id: 'est-4',
        matricula: '202102004',
        nombre: 'Carlos Eduardo Ramírez Peña',
        parcial1: 55,
        parcial2: 50,
        parcial3: 60,
        parciales: { 1: 55, 2: 50, 3: 60 },
        final: 55,
        asistencia: 74,
        estado: 'REPROBADO',
      },
      {
        id: 'est-5',
        matricula: '202302819',
        nombre: 'Sebastián Herrera Morales',
        parcial1: 90,
        parcial2: 92,
        parcial3: 95,
        parciales: { 1: 90, 2: 92, 3: 95 },
        final: 92,
        asistencia: 94,
        estado: 'APROBADO',
      },
    ],
  },
  {
    id: 'grp-604-a',
    clave: 'CS-604',
    materia: 'Auditoría de Redes y Ethical Hacking',
    grupo: '6CV2',
    semestre: '6to Semestre',
    aula: 'Lab Redes 2',
    horario: 'Lun, Mié 11:00 - 13:00',
    alumnosInscritos: 26,
    cupoMaximo: 30,
    numeroParciales: 4,
    periodo: '2026-B',
    estatusActa: 'ABIERTA',
    fechaLimite: '28 de Septiembre de 2026',
    estudiantes: [
      {
        id: 'est-6',
        matricula: '202309912',
        nombre: 'Emilio Aranda Campos',
        parcial1: 94,
        parcial2: 90,
        parcial3: 95,
        parcial4: 93,
        parciales: { 1: 94, 2: 90, 3: 95, 4: 93 },
        final: 93,
        asistencia: 95,
        estado: 'APROBADO',
      },
      {
        id: 'est-7',
        matricula: '202308119',
        nombre: 'Jimena Castro Villa',
        parcial1: 88,
        parcial2: 85,
        parcial3: 90,
        parcial4: 87,
        parciales: { 1: 88, 2: 85, 3: 90, 4: 87 },
        final: 88,
        asistencia: 92,
        estado: 'APROBADO',
      },
    ],
  },
  {
    id: 'grp-502-b',
    clave: 'CS-502',
    materia: 'Sistemas Operativos y Kernel Hardening',
    grupo: '5CV1',
    semestre: '5to Semestre',
    aula: 'Lab Cómputo 1',
    horario: 'Mar, Jue 07:00 - 09:00',
    alumnosInscritos: 30,
    cupoMaximo: 30,
    numeroParciales: 2,
    periodo: '2026-B',
    estatusActa: 'CERRADA_FIRMADA',
    fechaLimite: 'Concluido',
    estudiantes: [
      {
        id: 'est-8',
        matricula: '202401882',
        nombre: 'Santiago Gómez Cruz',
        parcial1: 90,
        parcial2: 95,
        parciales: { 1: 90, 2: 95 },
        final: 93,
        asistencia: 98,
        estado: 'APROBADO',
      },
    ],
  },
]

// 8. Módulo Jefe de Carrera e Interfaces Extendidas
export interface StaffTeacher {
  id: string
  numeroNomina: string
  nombreCompleto: string
  rfc: string
  curp: string
  cedulaDgp: string
  gradoAcademico: string
  tipoPlaza: 'TIEMPO_COMPLETO' | 'ASIGNATURA' | 'MEDIO_TIEMPO'
  horasSemanales: number
  materiasAsignadas: string[]
  estado: 'VIGENTE' | 'SABATICO' | 'LICENCIA' | 'INACTIVO'
  cubiculo: string
  correoInstitucional: string
}

export interface CurricularGroup {
  id: string
  claveMateria: string
  nombreMateria: string
  codigoGrupo: string
  semestre: number
  turno: 'MATUTINO' | 'VESPERTINO'
  docenteTitular: string
  docenteNomina: string
  aula: string
  edificio: string
  tipoEspacio: 'AULA_REGULAR' | 'LABORATORIO_ESPECIALIZADO'
  horario: string
  dias: string
  inscritos: number
  capacidadMaxima: number
  numeroParciales: number
  sobrecuposEmitidos: number
  estado: 'ABIERTO' | 'CERRADO' | 'PLANIFICADO'
}

export interface JefeCareerProfile {
  id: string
  cct: string
  carrera: string
  clavePrograma: string
  titularNombre: string
  titularGrado: string
  nombramiento: string
  fechaNombramiento: string
  vigenciaNombramiento: string
  email: string
  telefono: string
  extension: string
  oficina: string
  periodoActivo: string
  matriculaTotal: number
  gruposTotales: number
  docentesAdscritos: number
  sobrecuposMaximos: number
  sobrecuposUtilizados: number
  eficienciaTerminal: number
  facultadesEstatutarias: string[]
}

export interface DetailedStudentRequest {
  id: string
  folio: string
  tipo: 'CONSTANCIA_ESTUDIOS' | 'KARDEX_CERTIFICADO' | 'BAJA_TEMPORAL' | 'EXAMEN_EXTRAORDINARIO' | 'SOBRECUPO'
  titulo: string
  solicitante: string
  matricula: string
  carrera: string
  fechaSolicitud: string
  fechaResolucion?: string
  estado: 'APROBADA' | 'EN_REVISION' | 'RECHAZADA'
  observaciones: string
  periodo: string
  documentoDescargable?: string
}

// 9. Mock Data para Planta Docente (Jefatura)
export const mockStaffTeachers: StaffTeacher[] = [
  {
    id: 'doc-001',
    numeroNomina: 'DOC-8821',
    nombreCompleto: 'Dr. Alejandro Méndez Rosas',
    rfc: 'MERA720914HY2',
    curp: 'MERA720914HDFRN09',
    cedulaDgp: '4892104-DGP',
    gradoAcademico: 'Doctorado en Ciencias de la Computación (CINVESTAV)',
    tipoPlaza: 'TIEMPO_COMPLETO',
    horasSemanales: 20,
    materiasAsignadas: ['Seguridad en Aplicaciones Web', 'Auditoría de Redes'],
    estado: 'VIGENTE',
    cubiculo: 'Edificio B, Cubículo 308',
    correoInstitucional: 'a.mendez@securecampus.edu',
  },
  {
    id: 'doc-002',
    numeroNomina: 'DOC-9012',
    nombreCompleto: 'Mtra. Daniela Fuentes Silva',
    rfc: 'FUSD810411KC8',
    curp: 'FUSD810411MDFLN04',
    cedulaDgp: '5219483-DGP',
    gradoAcademico: 'Maestría en Seguridad Informática (UNAM)',
    tipoPlaza: 'TIEMPO_COMPLETO',
    horasSemanales: 18,
    materiasAsignadas: ['Criptografía Aplicada y PKI', 'Fundamentos de Redes'],
    estado: 'VIGENTE',
    cubiculo: 'Edificio B, Cubículo 302',
    correoInstitucional: 'd.fuentes@securecampus.edu',
  },
  {
    id: 'doc-003',
    numeroNomina: 'DOC-7411',
    nombreCompleto: 'Dr. Ricardo Salinas Vega',
    rfc: 'SAVR690320LP1',
    curp: 'SAVR690320HDFRV01',
    cedulaDgp: '3419082-DGP',
    gradoAcademico: 'Doctorado en Telecomunicaciones (Politécnico de Madrid)',
    tipoPlaza: 'TIEMPO_COMPLETO',
    horasSemanales: 22,
    materiasAsignadas: ['Arquitectura de Redes Seguras', 'Ciberdefensa Activa'],
    estado: 'VIGENTE',
    cubiculo: 'Edificio Central, Cubículo 114',
    correoInstitucional: 'r.salinas@securecampus.edu',
  },
  {
    id: 'doc-004',
    numeroNomina: 'DOC-6290',
    nombreCompleto: 'Ing. Carlos Mendoza Alarcón',
    rfc: 'MEAC751102TY4',
    curp: 'MEAC751102HDFNX02',
    cedulaDgp: '2981043-DGP',
    gradoAcademico: 'Especialidad en Seguridad Operacional',
    tipoPlaza: 'ASIGNATURA',
    horasSemanales: 12,
    materiasAsignadas: ['Forense Digital y Cadena de Custodia'],
    estado: 'VIGENTE',
    cubiculo: 'Área Docente Asignatura A-2',
    correoInstitucional: 'c.mendoza@securecampus.edu',
  },
  {
    id: 'doc-005',
    numeroNomina: 'DOC-5519',
    nombreCompleto: 'Dra. Beatriz Lorena Morales Pineda',
    rfc: 'MOPB780615RT9',
    curp: 'MOPB780615MDFRN07',
    cedulaDgp: '4091823-DGP',
    gradoAcademico: 'Doctorado en Inteligencia Artificial y Ciberseguridad',
    tipoPlaza: 'TIEMPO_COMPLETO',
    horasSemanales: 0,
    materiasAsignadas: [],
    estado: 'SABATICO',
    cubiculo: 'Edificio B, Cubículo 310',
    correoInstitucional: 'b.morales@securecampus.edu',
  },
  {
    id: 'doc-006',
    numeroNomina: 'DOC-8114',
    nombreCompleto: 'Mtro. Fernando Trejo Cárdenas',
    rfc: 'TRCF831201GH3',
    curp: 'TRCF831201HDFRD08',
    cedulaDgp: '5871239-DGP',
    gradoAcademico: 'Maestría en Tecnologías de Información',
    tipoPlaza: 'ASIGNATURA',
    horasSemanales: 8,
    materiasAsignadas: ['Gestión de Riesgos y Cumplimiento ISO 27001'],
    estado: 'VIGENTE',
    cubiculo: 'Área Docente Asignatura A-4',
    correoInstitucional: 'f.trejo@securecampus.edu',
  },
]

// 10. Mock Data para Oferta Curricular y Grupos (Jefatura)
export const mockCurricularGroups: CurricularGroup[] = [
  {
    id: 'grp-cur-601',
    claveMateria: 'CS-601',
    nombreMateria: 'Seguridad en Aplicaciones Web y DevSecOps',
    codigoGrupo: '6CV1',
    semestre: 6,
    turno: 'MATUTINO',
    docenteTitular: 'Dr. Alejandro Méndez Rosas',
    docenteNomina: 'DOC-8821',
    aula: 'Lab Redes 3',
    edificio: 'Edificio Tecnologías Nivel 2',
    tipoEspacio: 'LABORATORIO_ESPECIALIZADO',
    horario: '07:00 - 09:00',
    dias: 'Lun, Mié',
    inscritos: 28,
    capacidadMaxima: 30,
    numeroParciales: 3,
    sobrecuposEmitidos: 2,
    estado: 'ABIERTO',
  },
  {
    id: 'grp-cur-602',
    claveMateria: 'CS-602',
    nombreMateria: 'Criptografía Aplicada y PKI',
    codigoGrupo: '6CV2',
    semestre: 6,
    turno: 'MATUTINO',
    docenteTitular: 'Mtra. Daniela Fuentes Silva',
    docenteNomina: 'DOC-9012',
    aula: 'Aula Magna 102',
    edificio: 'Edificio A Nivel 1',
    tipoEspacio: 'AULA_REGULAR',
    horario: '09:00 - 11:00',
    dias: 'Mar, Jue',
    inscritos: 29,
    capacidadMaxima: 30,
    numeroParciales: 4,
    sobrecuposEmitidos: 1,
    estado: 'ABIERTO',
  },
  {
    id: 'grp-cur-603',
    claveMateria: 'CS-603',
    nombreMateria: 'Gestión de Identidades, RBAC y Privacidad OIDC',
    codigoGrupo: '6CV1',
    semestre: 6,
    turno: 'MATUTINO',
    docenteTitular: 'Mtro. Roberto Morales Salazar',
    docenteNomina: 'ADM-001',
    aula: 'Lab Cómputo 2',
    edificio: 'Edificio Tecnologías Nivel 1',
    tipoEspacio: 'LABORATORIO_ESPECIALIZADO',
    horario: '11:00 - 13:00',
    dias: 'Vie',
    inscritos: 27,
    capacidadMaxima: 30,
    numeroParciales: 2,
    sobrecuposEmitidos: 0,
    estado: 'ABIERTO',
  },
  {
    id: 'grp-cur-604',
    claveMateria: 'CS-604',
    nombreMateria: 'Auditoría de Redes y Ethical Hacking',
    codigoGrupo: '6CV2',
    semestre: 6,
    turno: 'VESPERTINO',
    docenteTitular: 'Dr. Alejandro Méndez Rosas',
    docenteNomina: 'DOC-8821',
    aula: 'Lab Redes 2',
    edificio: 'Edificio Tecnologías Nivel 2',
    tipoEspacio: 'LABORATORIO_ESPECIALIZADO',
    horario: '14:00 - 16:00',
    dias: 'Lun, Mié',
    inscritos: 26,
    capacidadMaxima: 30,
    numeroParciales: 3,
    sobrecuposEmitidos: 0,
    estado: 'ABIERTO',
  },
  {
    id: 'grp-cur-501',
    claveMateria: 'CS-501',
    nombreMateria: 'Arquitectura de Redes Seguras y Firewalls',
    codigoGrupo: '5CV1',
    semestre: 5,
    turno: 'MATUTINO',
    docenteTitular: 'Dr. Ricardo Salinas Vega',
    docenteNomina: 'DOC-7411',
    aula: 'Aula 204',
    edificio: 'Edificio B Nivel 2',
    tipoEspacio: 'AULA_REGULAR',
    horario: '07:00 - 09:00',
    dias: 'Mar, Jue',
    inscritos: 30,
    capacidadMaxima: 30,
    numeroParciales: 3,
    sobrecuposEmitidos: 3,
    estado: 'CERRADO',
  },
  {
    id: 'grp-cur-701',
    claveMateria: 'CS-701',
    nombreMateria: 'Forense Digital y Respuesta a Incidentes (IR)',
    codigoGrupo: '7CV1',
    semestre: 7,
    turno: 'VESPERTINO',
    docenteTitular: 'Ing. Carlos Mendoza Alarcón',
    docenteNomina: 'DOC-6290',
    aula: 'Lab Cómputo Forense',
    edificio: 'Edificio Tecnologías Nivel 3',
    tipoEspacio: 'LABORATORIO_ESPECIALIZADO',
    horario: '16:00 - 18:00',
    dias: 'Mar, Jue',
    inscritos: 22,
    capacidadMaxima: 25,
    numeroParciales: 3,
    sobrecuposEmitidos: 0,
    estado: 'ABIERTO',
  },
]

// 11. Mock Data para Perfil de Jefatura
export const mockJefeCareerProfile: JefeCareerProfile = {
  id: 'jef-001',
  cct: 'ING-SIS-09',
  carrera: 'Ingeniería en Sistemas Computacionales & Ciberseguridad',
  clavePrograma: 'ISC-2020-RET / CVE-PROG: 402213',
  titularNombre: 'Mtro. Alejandro Martínez Solís',
  titularGrado: 'Maestro en Ciencias en Computación y Ciberseguridad',
  nombramiento: 'Jefe de Carrera Titular por Consejo Técnico Consultivo',
  fechaNombramiento: '16 de Enero de 2024',
  vigenciaNombramiento: 'Enero 2024 - Enero 2027 (Periodo Estatutario Trienal)',
  email: 'a.martinez@securecampus.edu',
  telefono: '+52 (55) 5729-6000',
  extension: '5420 / 5421',
  oficina: 'Edificio de Gobierno, Ala Norte, Jefatura ISC Despacho 201',
  periodoActivo: '2026-B (AGO-DIC)',
  matriculaTotal: 958,
  gruposTotales: 48,
  docentesAdscritos: 24,
  sobrecuposMaximos: 25,
  sobrecuposUtilizados: 17,
  eficienciaTerminal: 89.4,
  facultadesEstatutarias: [
    'Autorización y revocación de adscripción departamental docente (profesores.crear, profesores.desactivar)',
    'Apertura, fusión y cierre de grupos académicos y asignación de horarios sin colisión (grupos.crear, horarios.asignar)',
    'Dictamen y emisión de sobrecupos con validez oficial conforme al límite reglamentario (inscripciones.sobrecupo)',
    'Validación formal de actas de calificaciones ordinarias y extraordinarias antes del cierre de periodo',
    'Resolución en primera instancia de solicitudes de trámites, equivalencias y bajas temporales',
  ],
}

// 12. Mock Data para Solicitudes Estudiantiles
export const mockStudentDetailedRequests: DetailedStudentRequest[] = [
  {
    id: 'req-001',
    folio: 'SOL-2026-0841',
    tipo: 'CONSTANCIA_ESTUDIOS',
    titulo: 'Constancia de Estudios con Promedio y Horario',
    solicitante: 'Valeria Sofía Morales Rivas',
    matricula: '202301042',
    carrera: 'Ingeniería en Ciberseguridad y Redes',
    fechaSolicitud: '12 de Septiembre de 2026',
    fechaResolucion: '14 de Septiembre de 2026',
    estado: 'APROBADA',
    observaciones: 'Documento expedido con sello digital SHA-256 y firma electrónica institucional verificada.',
    periodo: '2026-B',
    documentoDescargable: 'Constancia_Estudios_202301042_2026B.pdf',
  },
  {
    id: 'req-002',
    folio: 'SOL-2026-0912',
    tipo: 'SOBRECUPO',
    titulo: 'Autorización de Sobrecupo en CS-601 (6CV1)',
    solicitante: 'Valeria Sofía Morales Rivas',
    matricula: '202301042',
    carrera: 'Ingeniería en Ciberseguridad y Redes',
    fechaSolicitud: '18 de Septiembre de 2026',
    fechaResolucion: '19 de Septiembre de 2026',
    estado: 'APROBADA',
    observaciones: 'Dictamen favorable de Jefatura de Carrera. Capacidad de aula ampliada por laboratorio.',
    periodo: '2026-B',
  },
  {
    id: 'req-003',
    folio: 'SOL-2026-1044',
    tipo: 'KARDEX_CERTIFICADO',
    titulo: 'Kárdex Oficial Certificado para Beca de Excelencia',
    solicitante: 'Valeria Sofía Morales Rivas',
    matricula: '202301042',
    carrera: 'Ingeniería en Ciberseguridad y Redes',
    fechaSolicitud: '20 de Septiembre de 2026',
    estado: 'EN_REVISION',
    observaciones: 'En proceso de cotejo de firmas por el Departamento de Control Escolar Central.',
    periodo: '2026-B',
  },
  {
    id: 'req-004',
    folio: 'SOL-2026-0311',
    tipo: 'EXAMEN_EXTRAORDINARIO',
    titulo: 'Solicitud de Extraordinario Regularización',
    solicitante: 'Valeria Sofía Morales Rivas',
    matricula: '202301042',
    carrera: 'Ingeniería en Ciberseguridad y Redes',
    fechaSolicitud: '10 de Junio de 2026',
    fechaResolucion: '11 de Junio de 2026',
    estado: 'APROBADA',
    observaciones: 'Presentado y acreditado con 9.0 en acta ordinaria complementaria.',
    periodo: '2026-A',
    documentoDescargable: 'Acta_Extraordinario_CS402.pdf',
  },
]

