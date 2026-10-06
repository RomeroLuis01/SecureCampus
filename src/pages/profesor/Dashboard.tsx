import React from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen,
  Users,
  Clock,
  FileCheck2,
  Calendar,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
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
import { mockTeacherProfile, mockTeacherGroups } from '../../services/mockData'

export const TeacherDashboard: React.FC = () => {
  const teacher = mockTeacherProfile
  const groups = mockTeacherGroups

  const totalStudents = groups.reduce((acc, g) => acc + g.alumnosInscritos, 0)
  const pendingActs = groups.filter((g) => g.estatusActa !== 'CERRADA_FIRMADA').length

  return (
    <div className="space-y-6 font-sans">
      {/* 1. Header de Bienvenida Institucional */}
      <div className="bg-surface-lowest border border-border rounded-lg p-6 shadow-layer-1 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-primary text-white flex items-center justify-center font-bold text-lg shrink-0 shadow-sm border-2 border-border-subtle">
            {teacher.nombre[0]}
            {teacher.apellidos[0]}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-xl font-bold text-secondary tracking-tight">
                {teacher.nombre} {teacher.apellidos}
              </h1>
              <Badge variant="success" dot size="sm">
                {teacher.categoria}
              </Badge>
              <span className="text-xs font-mono font-medium text-secondary-slate bg-surface-canvas px-2 py-0.5 rounded border border-border-subtle">
                Nómina: {teacher.nomina}
              </span>
            </div>
            <p className="text-xs text-secondary-slate">
              {teacher.departamento} • {teacher.cubículo}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Link to="/profesor/grupos">
            <Button variant="secondary" size="md">
              Ver Horario y Grupos
            </Button>
          </Link>
          <Link to="/profesor/calificaciones">
            <Button variant="primary" size="md" rightIcon={<ArrowRight className="w-4 h-4 shrink-0" />}>
              Capturar Calificaciones
            </Button>
          </Link>
        </div>
      </div>

      {/* 2. Tarjetas de Resumen Docente (KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Grupos Asignados */}
        <Card>
          <CardBody className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-secondary-slate">Grupos Asignados</p>
              <h3 className="text-2xl font-bold text-secondary mt-1 tabular-nums">
                {groups.length} <span className="text-xs font-normal text-secondary-slate">grupos</span>
              </h3>
              <p className="text-[11px] text-primary font-medium mt-1">Periodo 2026-B</p>
            </div>
            <div className="w-10 h-10 rounded bg-blue-50 text-primary flex items-center justify-center border border-blue-100">
              <BookOpen className="w-5 h-5" />
            </div>
          </CardBody>
        </Card>

        {/* Alumnos a Cargo */}
        <Card>
          <CardBody className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-secondary-slate">Alumnos Inscritos</p>
              <h3 className="text-2xl font-bold text-secondary mt-1 tabular-nums">
                {totalStudents} <span className="text-xs font-normal text-secondary-slate">alumnos</span>
              </h3>
              <p className="text-[11px] text-academic-success-text font-medium mt-1">
                Matrículas validadas
              </p>
            </div>
            <div className="w-10 h-10 rounded bg-emerald-50 text-academic-success flex items-center justify-center border border-emerald-100">
              <Users className="w-5 h-5" />
            </div>
          </CardBody>
        </Card>

        {/* Horas Semanales */}
        <Card>
          <CardBody className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-secondary-slate">Carga Académica</p>
              <h3 className="text-2xl font-bold text-secondary mt-1 tabular-nums">
                {teacher.horasSemanales} <span className="text-xs font-normal text-secondary-slate">hrs/sem</span>
              </h3>
              <p className="text-[11px] text-secondary-slate mt-1">Frente a grupo</p>
            </div>
            <div className="w-10 h-10 rounded bg-surface-canvas text-secondary-muted flex items-center justify-center border border-border">
              <Clock className="w-5 h-5" />
            </div>
          </CardBody>
        </Card>

        {/* Estado de Actas */}
        <Card>
          <CardBody className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-secondary-slate">Actas Pendientes</p>
              <h3 className="text-2xl font-bold text-secondary mt-1 tabular-nums">
                {pendingActs} <span className="text-xs font-normal text-secondary-slate">actas</span>
              </h3>
              <p className="text-[11px] text-academic-warning-text font-medium mt-1">
                Límite: 28 Sep 2026
              </p>
            </div>
            <div className="w-10 h-10 rounded bg-amber-50 text-academic-warning flex items-center justify-center border border-amber-100">
              <FileCheck2 className="w-5 h-5" />
            </div>
          </CardBody>
        </Card>
      </div>

      {/* 3. Carga Docente Actual y Grupos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-secondary">
              Grupos en Impartición • Ciclo 2026-B
            </h2>
            <Link
              to="/profesor/grupos"
              className="text-xs text-primary hover:underline font-medium"
            >
              Ver detalles de horarios
            </Link>
          </div>

          <div className="space-y-3">
            {groups.map((grp) => (
              <Card key={grp.id} className="hover:border-border-strong transition">
                <CardBody className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border-subtle">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-primary bg-surface-canvas px-2 py-0.5 rounded border border-border-subtle">
                          {grp.clave} • Grupo {grp.grupo}
                        </span>
                        <h3 className="text-sm font-bold text-secondary">
                          {grp.materia}
                        </h3>
                      </div>
                      <p className="text-xs text-secondary-slate mt-1">
                        {grp.aula} • {grp.horario} • {grp.semestre}
                      </p>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <Badge
                        variant={
                          grp.estatusActa === 'CERRADA_FIRMADA'
                            ? 'success'
                            : grp.estatusActa === 'EN_CAPTURA'
                            ? 'warning'
                            : 'info'
                        }
                        dot
                        size="sm"
                      >
                        {grp.estatusActa === 'CERRADA_FIRMADA'
                          ? 'ACTA CERRADA'
                          : grp.estatusActa === 'EN_CAPTURA'
                          ? 'EN CAPTURA'
                          : 'ABIERTA'}
                      </Badge>
                    </div>
                  </div>

                  <div className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="text-secondary-slate">
                      Inscritos:{' '}
                      <strong className="text-secondary font-mono">{grp.alumnosInscritos}</strong> de{' '}
                      <span className="font-mono">{grp.cupoMaximo}</span> cupos • Límite de captura:{' '}
                      <span className="font-medium text-secondary">{grp.fechaLimite}</span>
                    </div>

                    <Link to="/profesor/calificaciones">
                      <Button
                        variant={grp.estatusActa === 'CERRADA_FIRMADA' ? 'secondary' : 'primary'}
                        size="sm"
                      >
                        {grp.estatusActa === 'CERRADA_FIRMADA' ? 'Consultar Acta' : 'Capturar Notas'}
                      </Button>
                    </Link>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </div>

        {/* 4. Columna Lateral: Normativa y Seguridad de Actas */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Normativa de Evaluación</CardTitle>
              <CardDescription>Lineamientos de captura y cierre</CardDescription>
            </CardHeader>
            <CardBody className="p-4 space-y-3 text-xs text-secondary">
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-academic-warning shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed text-amber-900">
                  El cierre de actas del segundo parcial concluye el <strong>28 de septiembre</strong>. Posterior a esta fecha, cualquier rectificación requerirá aprobación de la Jefatura de Carrera.
                </p>
              </div>

              <div className="p-3 bg-surface-canvas border border-border rounded flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed text-secondary-slate">
                  Al formalizar el acta definitiva, se generará una firma digital RSA con sellado de tiempo para auditoría de integridad académica.
                </p>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fechas Clave del Periodo</CardTitle>
              <CardDescription>Calendario oficial 2026-B</CardDescription>
            </CardHeader>
            <CardBody className="p-4 space-y-2.5 text-xs text-secondary-slate">
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                <span>21 - 28 Sep: Captura Parcial 2</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                <span>12 - 19 Nov: Evaluaciones Finales</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                <span>25 Nov: Cierre Definitivo de Semestre</span>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}
