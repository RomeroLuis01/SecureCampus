import React, { useState } from 'react'
import {
  FileText,
  CheckCircle,
  Clock,
  PlusCircle,
  Download,
  Award,
  Search,
  Filter,
} from 'lucide-react'
import { Card, Button, Badge, Modal, Select, Table } from '../../components'
import type { Column } from '../../components'
import {
  mockStudentDetailedRequests,
} from '../../services/mockData'
import type { DetailedStudentRequest } from '../../services/mockData'

export const StudentRequestsView: React.FC = () => {
  const [requests, setRequests] = useState<DetailedStudentRequest[]>(
    mockStudentDetailedRequests,
  )
  const [filterType, setFilterType] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Modal Nueva Solicitud
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newRequestType, setNewRequestType] = useState<
    'CONSTANCIA_ESTUDIOS' | 'KARDEX_CERTIFICADO' | 'SOBRECUPO' | 'EXAMEN_EXTRAORDINARIO' | 'BAJA_TEMPORAL'
  >('CONSTANCIA_ESTUDIOS')
  const [newJustification, setNewJustification] = useState('')

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 4000)
  }

  const handleCreateRequest = (e: React.FormEvent) => {
    e.preventDefault()

    const titles: Record<string, string> = {
      CONSTANCIA_ESTUDIOS: 'Constancia de Estudios con Promedio y Horario',
      KARDEX_CERTIFICADO: 'Kárdex Oficial Certificado para Trámite Externo',
      SOBRECUPO: 'Autorización Especial de Sobrecupo',
      EXAMEN_EXTRAORDINARIO: 'Solicitud de Examen Extraordinario de Regularización',
      BAJA_TEMPORAL: 'Solicitud de Baja Temporal de Periodo',
    }

    const folioNum = Math.floor(1000 + Math.random() * 9000)
    const newReq: DetailedStudentRequest = {
      id: `req-${Date.now()}`,
      folio: `SOL-2026-${folioNum}`,
      tipo: newRequestType,
      titulo: titles[newRequestType] || 'Solicitud Académica',
      solicitante: 'Valeria Sofía Morales Rivas',
      matricula: '202301042',
      carrera: 'Ingeniería en Ciberseguridad y Redes',
      fechaSolicitud: 'Hoy',
      estado: 'EN_REVISION',
      observaciones: newJustification || 'Solicitud ingresada por el alumno a través del portal de autoservicio.',
      periodo: '2026-B',
    }

    setRequests([newReq, ...requests])
    setIsModalOpen(false)
    setNewJustification('')
    showToast(`Solicitud ${newReq.folio} registrada exitosamente. Turnada a Jefatura de Carrera y Control Escolar.`)
  }

  const filteredRequests = requests.filter((r) => {
    const matchesFilter = filterType === 'ALL' || r.tipo === filterType
    const matchesSearch =
      r.folio.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.titulo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.observaciones.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesFilter && matchesSearch
  })

  const aprobadasCount = requests.filter((r) => r.estado === 'APROBADA').length
  const revisionCount = requests.filter((r) => r.estado === 'EN_REVISION').length

  const requestColumns: Column<DetailedStudentRequest>[] = [
    {
      key: 'folio',
      title: 'Folio Oficial',
      render: (req) => <span className="font-mono font-bold text-xs text-primary">{req.folio}</span>,
    },
    {
      key: 'titulo',
      title: 'Trámite Solicitado',
      render: (req) => (
        <div className="space-y-0.5">
          <strong className="text-xs text-secondary block">{req.titulo}</strong>
          <span className="text-[10px] text-secondary-slate block font-mono">{req.tipo}</span>
        </div>
      ),
    },
    {
      key: 'fechaSolicitud',
      title: 'Fecha de Registro',
      render: (req) => <span className="text-xs text-secondary-slate">{req.fechaSolicitud}</span>,
    },
    {
      key: 'periodo',
      title: 'Periodo',
      render: (req) => <span className="font-mono text-xs text-secondary font-semibold">{req.periodo}</span>,
    },
    {
      key: 'estado',
      title: 'Estatus',
      render: (req) => (
        <Badge
          variant={
            req.estado === 'APROBADA'
              ? 'success'
              : req.estado === 'RECHAZADA'
              ? 'danger'
              : 'warning'
          }
          className="text-[10px]"
        >
          {req.estado === 'APROBADA' ? 'Aprobada' : req.estado === 'RECHAZADA' ? 'Rechazada' : 'En Revisión'}
        </Badge>
      ),
    },
    {
      key: 'observaciones',
      title: 'Dictamen / Observaciones',
      render: (req) => (
        <span className="text-xs text-secondary-slate truncate max-w-xs block" title={req.observaciones}>
          {req.observaciones}
        </span>
      ),
    },
    {
      key: 'acciones',
      title: 'Acción',
      render: (req) => (
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          {req.estado === 'APROBADA' ? (
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Download className="w-3.5 h-3.5 shrink-0 text-primary" />}
              onClick={() => alert(`Descargando documento oficial para folio ${req.folio} con sello QR institucional...`)}
            >
              Descargar PDF
            </Button>
          ) : (
            <span className="text-xs text-secondary-muted font-mono italic">En trámite</span>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Toast Notifier */}
      {toastMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-lg flex items-center gap-2 shadow-sm animate-fade-in text-sm">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Institucional */}
      <div className="space-y-2">
        <nav className="flex items-center gap-2 text-xs text-secondary-slate">
          <span>Portal del Alumno</span>
          <span>/</span>
          <span>Servicios Escolares</span>
          <span>/</span>
          <span className="text-primary font-semibold">Solicitudes y Trámites</span>
        </nav>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-surface-lowest p-6 rounded-lg border border-border shadow-sm">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold text-secondary tracking-tight">
                Gestión de Trámites y Solicitudes Académicas
              </h1>
              <Badge variant="info" className="text-xs uppercase font-bold">
                PERIODO 2026-B
              </Badge>
              <Badge variant="inactive" className="text-xs font-mono">
                AUTOSERVICIO SEGURO
              </Badge>
            </div>
            <p className="text-xs text-secondary-slate max-w-3xl">
              Genera solicitudes formales ante Control Escolar y Jefatura de Carrera. Todos los documentos emitidos cuentan con código QR y firma digital SHA-256 verificable.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="primary"
              size="md"
              leftIcon={<PlusCircle className="w-4 h-4 shrink-0" />}
              onClick={() => setIsModalOpen(true)}
              className="shadow-sm"
            >
              Nueva Solicitud de Trámite
            </Button>
          </div>
        </div>
      </div>

      {/* Bento Grid: 4 Métricas de Trámites */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <Card className="p-4 border border-border shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-secondary-slate uppercase tracking-wider">
              Solicitudes Totales
            </span>
            <div className="p-1.5 bg-blue-50 text-primary rounded">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-secondary font-mono">{requests.length}</span>
              <span className="text-xs text-secondary-slate">trámites</span>
            </div>
            <div className="w-full bg-surface-canvas rounded-full h-1.5 overflow-hidden mt-2 border border-border-subtle">
              <div className="bg-primary h-full rounded-full" style={{ width: '100%' }}></div>
            </div>
          </div>
          <span className="text-[11px] text-secondary-slate">Historial académico acumulado</span>
        </Card>

        {/* KPI 2 */}
        <Card className="p-4 border border-border shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-secondary-slate uppercase tracking-wider">
              Aprobadas y Concluidas
            </span>
            <div className="p-1.5 bg-emerald-50 text-emerald-700 rounded">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-emerald-700 font-mono">{aprobadasCount}</span>
              <span className="text-xs text-secondary-slate">con firma oficial</span>
            </div>
            <div className="w-full bg-surface-canvas rounded-full h-1.5 overflow-hidden mt-2 border border-border-subtle">
              <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${(aprobadasCount / requests.length) * 100}%` }}></div>
            </div>
          </div>
          <span className="text-[11px] text-emerald-700 font-semibold">Descargables con validez legal</span>
        </Card>

        {/* KPI 3 */}
        <Card className="p-4 border border-border shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-secondary-slate uppercase tracking-wider">
              En Revisión / Dictamen
            </span>
            <div className="p-1.5 bg-amber-50 text-amber-700 rounded">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-amber-700 font-mono">{revisionCount}</span>
              <span className="text-xs text-secondary-slate">en proceso</span>
            </div>
            <div className="w-full bg-surface-canvas rounded-full h-1.5 overflow-hidden mt-2 border border-border-subtle">
              <div className="bg-amber-500 h-full rounded-full" style={{ width: '40%' }}></div>
            </div>
          </div>
          <span className="text-[11px] text-secondary-slate">Respuesta en aprox. 48 hrs</span>
        </Card>

        {/* KPI 4 */}
        <Card className="p-4 border border-border shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-secondary-slate uppercase tracking-wider">
              Validador Digital
            </span>
            <div className="p-1.5 bg-blue-50 text-secondary rounded">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-primary font-mono">100%</span>
            </div>
            <div className="w-full bg-surface-canvas rounded-full h-1.5 overflow-hidden mt-2 border border-border-subtle">
              <div className="bg-primary h-full rounded-full" style={{ width: '100%' }}></div>
            </div>
          </div>
          <span className="text-[11px] text-secondary-slate">Estándar Criptográfico SHA-256</span>
        </Card>
      </div>

      {/* Tabla de Trámites y Solicitudes */}
      <Card className="border border-border shadow-sm">
        <div className="p-4 border-b border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold text-secondary">
              Historial de Trámites Registrados ({filteredRequests.length})
            </h2>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="text-xs bg-surface-canvas border border-border rounded px-2.5 py-1.5 text-secondary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">Todos los tipos</option>
              <option value="CONSTANCIA_ESTUDIOS">Constancia de Estudios</option>
              <option value="KARDEX_CERTIFICADO">Kárdex Certificado</option>
              <option value="SOBRECUPO">Sobrecupos</option>
              <option value="EXAMEN_EXTRAORDINARIO">Exámenes Extraordinarios</option>
            </select>

            <div className="relative flex items-center">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-secondary-slate pointer-events-none shrink-0" />
              <input
                type="text"
                placeholder="Buscar por folio o título..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-surface-canvas border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary w-56"
              />
            </div>
          </div>
        </div>

        <Table
          columns={requestColumns}
          data={filteredRequests}
          rowKey={(r) => r.id}
        />
      </Card>

      {/* Modal: Nueva Solicitud */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Crear Nueva Solicitud de Trámite Escolar"
      >
        <form onSubmit={handleCreateRequest} className="space-y-4">
          <p className="text-xs text-secondary-slate">
            Selecciona el tipo de trámite académico requerido. Tu solicitud será turnada a las autoridades correspondientes para su dictaminación.
          </p>

          <Select
            label="Tipo de Trámite Académico"
            value={newRequestType}
            onChange={(e) =>
              setNewRequestType(
                e.target.value as
                  | 'CONSTANCIA_ESTUDIOS'
                  | 'KARDEX_CERTIFICADO'
                  | 'SOBRECUPO'
                  | 'EXAMEN_EXTRAORDINARIO'
                  | 'BAJA_TEMPORAL',
              )
            }
            options={[
              { label: 'Constancia de Estudios con Promedio y Horario', value: 'CONSTANCIA_ESTUDIOS' },
              { label: 'Kárdex Oficial Certificado para Trámite Externo / Beca', value: 'KARDEX_CERTIFICADO' },
              { label: 'Autorización Especial de Sobrecupo en Asignatura', value: 'SOBRECUPO' },
              { label: 'Examen Extraordinario de Regularización', value: 'EXAMEN_EXTRAORDINARIO' },
              { label: 'Baja Temporal de Periodo Escolar', value: 'BAJA_TEMPORAL' },
            ]}
          />

          <div>
            <label className="block text-xs font-semibold text-secondary mb-1">
              Motivo o Justificación del Trámite
            </label>
            <textarea
              rows={3}
              value={newJustification}
              onChange={(e) => setNewJustification(e.target.value)}
              placeholder="Explica brevemente el motivo de tu solicitud o los detalles adicionales..."
              className="w-full text-xs bg-surface-canvas border border-border rounded p-2.5 text-secondary focus:outline-none focus:ring-1 focus:ring-primary"
              required
            />
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded text-xs text-primary flex items-start gap-2">
            <Award className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              La resolución del trámite quedará registrada en tu bitácora escolar con firma digital del Secretario Académico o Jefe de Carrera.
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
            <Button variant="ghost" type="button" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit">
              Enviar Solicitud Oficial
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
