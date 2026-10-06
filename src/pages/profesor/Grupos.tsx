import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Users,
  Calendar,
  MapPin,
  Clock,
  ArrowRight,
  FileSpreadsheet,
  Download,
} from 'lucide-react'
import {
  Card,
  CardBody,
  Button,
  Badge,
  Modal,
  Table,
} from '../../components'
import type { Column } from '../../components'
import { mockTeacherGroups } from '../../services/mockData'
import type { TeacherGroup, StudentGradeEntry } from '../../services/mockData'

export const TeacherGroupsView: React.FC = () => {
  const [selectedGroup, setSelectedGroup] = useState<TeacherGroup | null>(null)
  const [isRosterModalOpen, setIsRosterModalOpen] = useState(false)

  const handleOpenRoster = (group: TeacherGroup) => {
    setSelectedGroup(group)
    setIsRosterModalOpen(true)
  }

  const rosterColumns: Column<StudentGradeEntry>[] = [
    {
      key: 'matricula',
      title: 'Matrícula',
      isNumeric: true,
      width: '120px',
      render: (s) => (
        <span className="font-mono text-xs font-semibold text-secondary bg-surface-canvas px-1.5 py-0.5 rounded border border-border-subtle">
          {s.matricula}
        </span>
      ),
    },
    {
      key: 'nombre',
      title: 'Nombre del Estudiante',
      render: (s) => <span className="font-medium text-secondary">{s.nombre}</span>,
    },
    {
      key: 'asistencia',
      title: 'Asistencia',
      isNumeric: true,
      align: 'center',
      width: '100px',
      render: (s) => (
        <span className="font-mono tabular-nums text-secondary font-semibold">
          {s.asistencia}%
        </span>
      ),
    },
    {
      key: 'estado',
      title: 'Estatus',
      align: 'center',
      width: '120px',
      render: (s) => (
        <Badge
          variant={s.estado === 'APROBADO' ? 'success' : s.estado === 'REPROBADO' ? 'danger' : 'warning'}
          dot
          size="sm"
        >
          {s.estado}
        </Badge>
      ),
    },
  ]

  return (
    <div className="space-y-6 font-sans">
      {/* 1. Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold text-secondary tracking-tight">
              Grupos Asignados y Carga Académica
            </h1>
          </div>
          <p className="text-xs text-secondary-slate">
            Control de asistencia, listas oficiales y programación de horarios • Periodo 2026-B
          </p>
        </div>

        <Link to="/profesor/calificaciones">
          <Button variant="primary" size="md" rightIcon={<ArrowRight className="w-4 h-4" />}>
            Ir a Captura de Calificaciones
          </Button>
        </Link>
      </div>

      {/* 2. Listado de Grupos en Tarjetas Maestras */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mockTeacherGroups.map((grp) => (
          <Card key={grp.id} variant="elevated" className="border-border flex flex-col justify-between">
            <div className="p-5 border-b border-border-subtle bg-surface-lowest">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-mono font-bold text-primary bg-surface-canvas px-2 py-0.5 rounded border border-border-subtle">
                  {grp.clave} • Grupo {grp.grupo}
                </span>
                <Badge
                  variant={
                    grp.estatusActa === 'CERRADA_FIRMADA'
                      ? 'success'
                      : grp.estatusActa === 'EN_CAPTURA'
                      ? 'warning'
                      : 'info'
                  }
                  size="sm"
                  dot
                >
                  {grp.estatusActa === 'CERRADA_FIRMADA'
                    ? 'FIRMADA'
                    : grp.estatusActa === 'EN_CAPTURA'
                    ? 'EN CAPTURA'
                    : 'ABIERTA'}
                </Badge>
              </div>

              <h2 className="text-base font-bold text-secondary tracking-tight leading-snug">
                {grp.materia}
              </h2>
              <p className="text-xs text-secondary-slate mt-1">{grp.semestre}</p>
            </div>

            <CardBody className="p-5 space-y-3 text-xs text-secondary-slate flex-1">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary shrink-0" />
                <span>Aula: <strong className="text-secondary">{grp.aula}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary shrink-0" />
                <span>Horario: <strong className="text-secondary">{grp.horario}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary shrink-0" />
                <span>Límite de Captura: <strong className="text-secondary">{grp.fechaLimite}</strong></span>
              </div>

              <div className="pt-2 border-t border-border-subtle flex items-center justify-between">
                <span>Alumnos Registrados</span>
                <span className="font-mono text-xs font-bold text-secondary tabular-nums">
                  {grp.alumnosInscritos} / {grp.cupoMaximo} cupos
                </span>
              </div>
            </CardBody>

            <div className="p-4 bg-surface-canvas border-t border-border-subtle flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="flex-1"
                leftIcon={<FileSpreadsheet className="w-3.5 h-3.5" />}
                onClick={() => handleOpenRoster(grp)}
              >
                Ver Lista
              </Button>
              <Link to="/profesor/calificaciones" className="flex-1">
                <Button variant="primary" size="sm" className="w-full">
                  Evaluar
                </Button>
              </Link>
            </div>
          </Card>
        ))}
      </div>

      {/* Modal de Lista de Asistencia y Padrón */}
      <Modal
        isOpen={isRosterModalOpen}
        onClose={() => setIsRosterModalOpen(false)}
        size="lg"
        title={selectedGroup ? `Lista Oficial: ${selectedGroup.materia}` : 'Lista Oficial'}
        description={
          selectedGroup
            ? `Grupo ${selectedGroup.grupo} • ${selectedGroup.semestre} • Aula: ${selectedGroup.aula}`
            : ''
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsRosterModalOpen(false)}>
              Cerrar
            </Button>
            <Button
              variant="primary"
              leftIcon={<Download className="w-4 h-4" />}
              onClick={() => alert('Descargando lista oficial en PDF con folios autorizados.')}
            >
              Descargar Lista PDF
            </Button>
          </>
        }
      >
        {selectedGroup && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-secondary-slate bg-surface-canvas p-3 rounded border border-border">
              <span>Total Alumnos en Lista: <strong className="text-secondary">{selectedGroup.estudiantes.length}</strong></span>
              <span>Periodo: <strong className="text-secondary">{selectedGroup.periodo}</strong></span>
            </div>

            <Table
              columns={rosterColumns}
              data={selectedGroup.estudiantes}
              rowKey={(s) => s.id}
              emptyMessage="No hay alumnos registrados en este grupo."
            />
          </div>
        )}
      </Modal>
    </div>
  )
}
