import React from 'react'
import { Link } from 'react-router-dom'
import {
  GraduationCap,
  BookOpen,
  FileText,
  ArrowUpRight,
  Download,
  Calendar,
  Sparkles,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  Button,
  Badge,
} from '../../components'
import {
  mockStudentProfile,
  mockCurrentSubjects,
  mockRequests,
} from '../../services/mockData'

export const StudentDashboard: React.FC = () => {
  const student = mockStudentProfile
  const subjects = mockCurrentSubjects
  const requests = mockRequests

  return (
    <div className="space-y-6">
      {/* 1. Banner Institucional de Bienvenida */}
      <div className="bg-surface-lowest border border-border rounded-lg p-6 shadow-layer-1 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-primary text-white flex items-center justify-center font-bold text-lg shrink-0 shadow-sm border-2 border-border-subtle">
            {student.nombre[0]}
            {student.apellidos[0]}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-xl font-bold text-secondary tracking-tight">
                {student.nombre} {student.apellidos}
              </h1>
              <Badge variant="success" dot size="sm">
                {student.estado}
              </Badge>
              <span className="text-xs font-mono font-medium text-secondary-slate bg-surface-canvas px-2 py-0.5 rounded border border-border-subtle">
                Matrícula: {student.matricula}
              </span>
            </div>
            <p className="text-xs text-secondary-slate">
              {student.carrera} • {student.semestre} • Plan: {student.planEstudios}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Link to="/estudiante/perfil">
            <Button variant="secondary" size="md">
              Ver Expediente Completo
            </Button>
          </Link>
          <Link to="/estudiante/calificaciones">
            <Button variant="primary" size="md" rightIcon={<ArrowUpRight className="w-4 h-4 shrink-0" />}>
              Kárdex Oficial
            </Button>
          </Link>
        </div>
      </div>

      {/* 2. Métricas Clave (Resumen Académico) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Materias Inscritas */}
        <Card>
          <CardBody className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-secondary-slate">Materias en Curso</p>
              <h3 className="text-2xl font-bold text-secondary mt-1 tabular-nums">
                {subjects.length}{' '}
                <span className="text-xs font-normal text-secondary-slate">asignaturas</span>
              </h3>
              <p className="text-[11px] text-primary font-medium mt-1">38 créditos inscritos</p>
            </div>
            <div className="w-10 h-10 rounded bg-blue-50 text-primary flex items-center justify-center border border-blue-100">
              <BookOpen className="w-5 h-5" />
            </div>
          </CardBody>
        </Card>

        {/* Promedio General */}
        <Card>
          <CardBody className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-secondary-slate">Promedio General (GPA)</p>
              <h3 className="text-2xl font-bold text-secondary mt-1 tabular-nums font-mono">
                {student.promedioGeneral.toFixed(2)}
              </h3>
              <p className="text-[11px] text-academic-success-text font-medium mt-1">
                Rendimiento sobresaliente
              </p>
            </div>
            <div className="w-10 h-10 rounded bg-emerald-50 text-academic-success flex items-center justify-center border border-emerald-100">
              <GraduationCap className="w-5 h-5" />
            </div>
          </CardBody>
        </Card>

        {/* Créditos Acumulados */}
        <Card>
          <CardBody className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-secondary-slate">Avance Curricular</p>
              <h3 className="text-2xl font-bold text-secondary mt-1 tabular-nums">
                {Math.round((student.creditosAcumulados / student.creditosTotales) * 100)}%
              </h3>
              <p className="text-[11px] text-secondary-slate mt-1 tabular-nums">
                {student.creditosAcumulados} de {student.creditosTotales} créditos
              </p>
            </div>
            <div className="w-10 h-10 rounded bg-surface-canvas text-secondary-muted flex items-center justify-center border border-border">
              <Sparkles className="w-5 h-5" />
            </div>
          </CardBody>
        </Card>

        {/* Solicitudes y Trámites */}
        <Card>
          <CardBody className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-secondary-slate">Trámites y Solicitudes</p>
              <h3 className="text-2xl font-bold text-secondary mt-1 tabular-nums">
                {requests.length}
              </h3>
              <p className="text-[11px] text-academic-warning-text font-medium mt-1">
                1 trámite en revisión
              </p>
            </div>
            <div className="w-10 h-10 rounded bg-amber-50 text-academic-warning flex items-center justify-center border border-amber-100">
              <FileText className="w-5 h-5" />
            </div>
          </CardBody>
        </Card>
      </div>

      {/* 3. Materias del Semestre Actual */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-secondary">
              Materias Activas • Periodo 2026-B
            </h2>
            <Link
              to="/estudiante/calificaciones"
              className="text-xs text-primary hover:underline font-medium flex items-center gap-1"
            >
              <span>Ver todas las notas</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-3">
            {subjects.map((subj) => (
              <Card key={subj.codigo} className="hover:border-border-strong transition">
                <CardBody className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border-subtle">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-primary bg-surface-canvas px-1.5 py-0.5 rounded border border-border-subtle">
                          {subj.codigo}
                        </span>
                        <h3 className="text-xs font-bold text-secondary leading-snug">
                          {subj.nombre}
                        </h3>
                      </div>
                      <p className="text-[11px] text-secondary-slate mt-0.5">
                        {subj.profesor} • {subj.aula} • {subj.horario}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[11px] text-secondary-slate block">Promedio Actual</span>
                      <span className="font-mono text-sm font-bold text-secondary tabular-nums">
                        {subj.promedioActual.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 flex flex-wrap items-center justify-between text-xs text-secondary-slate gap-2">
                    <div className="flex items-center gap-4">
                      <span>
                        Parcial 1: <strong className="text-secondary font-mono">{subj.parcial1}</strong>
                      </span>
                      <span>
                        Parcial 2: <strong className="text-secondary font-mono">{subj.parcial2}</strong>
                      </span>
                      <span>
                        Asistencia: <strong className="text-secondary font-mono">{subj.asistencia}%</strong>
                      </span>
                    </div>

                    <Badge variant={subj.estado} size="sm">
                      {subj.estado === 'success' ? 'Regular' : 'En Riesgo'}
                    </Badge>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </div>

        {/* 4. Columna Lateral: Solicitudes y Avisos */}
        <div className="space-y-6">
          {/* Trámites Recientes */}
          <Card>
            <CardHeader>
              <CardTitle>Trámites y Documentos</CardTitle>
              <CardDescription>Solicitudes expedidas con sello digital</CardDescription>
            </CardHeader>
            <CardBody className="p-4 space-y-3">
              {requests.map((req) => (
                <div
                  key={req.id}
                  className="p-3 bg-surface-canvas rounded border border-border text-xs space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-secondary leading-tight">{req.tipo}</p>
                      <span className="text-[10px] text-secondary-slate font-mono">
                        Folio: {req.folio}
                      </span>
                    </div>
                    <Badge
                      variant={req.estado === 'APROBADA' ? 'success' : 'warning'}
                      size="sm"
                    >
                      {req.estado}
                    </Badge>
                  </div>

                  <p className="text-[11px] text-secondary-slate leading-relaxed">
                    {req.detalles}
                  </p>

                  {req.descargable && (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full justify-center gap-1.5"
                      leftIcon={<Download className="w-3.5 h-3.5" />}
                    >
                      Descargar PDF Certificado
                    </Button>
                  )}
                </div>
              ))}
            </CardBody>
          </Card>

          {/* Avisos y Seguridad */}
          <Card>
            <CardHeader>
              <CardTitle>Avisos Institucionales</CardTitle>
              <CardDescription>Calendario y fechas críticas</CardDescription>
            </CardHeader>
            <CardBody className="p-4 space-y-3 text-xs">
              <div className="flex items-start gap-3 p-2.5 bg-blue-50/50 rounded border border-blue-100 text-secondary">
                <Calendar className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-primary">Cierre de Actas Parcial 2</p>
                  <p className="text-[11px] text-secondary-slate mt-0.5">
                    El periodo límite para revisión de notas con docentes concluye el 28 de septiembre.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-2.5 bg-surface-canvas rounded border border-border text-secondary">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Seguridad Criptográfica Activa</p>
                  <p className="text-[11px] text-secondary-slate mt-0.5">
                    Todas tus boletas cuentan con firma PKI verificable mediante código QR institucional.
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}
