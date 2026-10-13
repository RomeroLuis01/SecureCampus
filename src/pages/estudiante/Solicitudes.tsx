import React, { useState, useEffect, useCallback } from 'react'
import {
  FileText,
  CheckCircle,
  Clock,
  PlusCircle,
  Download,
  Award,
  Search,
  Filter,
  AlertCircle,
  Lock,
  RefreshCw,
} from 'lucide-react'
import { Card, Button, Badge, Modal, Select, Table } from '../../components'
import type { Column } from '../../components'
import { useAuth } from '../../context/AuthContext'
import {
  getStudentAcademicStatus,
  getStudentDocumentRequests,
  createStudentDocumentRequest,
  type StudentAcademicStatus,
} from '../../services'
import {
  mockStudentDetailedRequests,
} from '../../services/mockData'
import type { DetailedStudentRequest } from '../../services/mockData'

export const StudentRequestsView: React.FC = () => {
  const { user } = useAuth()
  const [requests, setRequests] = useState<DetailedStudentRequest[]>(
    mockStudentDetailedRequests
  )
  const [academicStatus, setAcademicStatus] = useState<StudentAcademicStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [filterType, setFilterType] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Modal Nueva Solicitud
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newRequestType, setNewRequestType] = useState<string>('CONSTANCIA')
  const [newJustification, setNewJustification] = useState('')

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type })
    setTimeout(() => setToastMessage(null), 4500)
  }

  // Carga autoritativa del estado del alumno y solicitudes
  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      // 1. Consultar estado académico institucional autoritativo
      try {
        const status = await getStudentAcademicStatus()
        setAcademicStatus(status)
      } catch {
        // Fallback al estado del perfil de sesión si existe
        if (user) {
          const isActivo = user.estadoAlumno === 'ACTIVO' || user.estado === 'ACTIVO'
          setAcademicStatus({
            alumnoId: user.personaId,
            matricula: user.matricula || '202301042',
            estadoAlumno: (user.estadoAlumno as any) || 'ACTIVO',
            puedeSolicitar: isActivo,
          })
        }
      }

      // 2. Consultar solicitudes reales del estudiante
      try {
        const realRequests = await getStudentDocumentRequests()
        if (realRequests.length > 0) {
          const mapped: DetailedStudentRequest[] = realRequests.map((r) => ({
            id: r.solicitudId,
            folio: r.folio,
            tipo: (r.tipoCodigo as any) || 'CONSTANCIA_ESTUDIOS',
            titulo: r.tipoNombre,
            solicitante: user?.nombreCompleto || 'Estudiante',
            matricula: user?.matricula || '',
            carrera: user?.carreraNombre || 'Ingeniería',
            fechaSolicitud: new Date(r.solicitadaEn).toLocaleDateString('es-MX'),
            fechaResolucion: r.resueltaEn ? new Date(r.resueltaEn).toLocaleDateString('es-MX') : undefined,
            estado: (r.estado as any) || 'EN_REVISION',
            observaciones: r.observaciones || 'Trámite escolar institucional.',
            periodo: '2026-B',
          }))
          setRequests(mapped)
        }
      } catch {
        // Mantener solicitudes previas si la API está en modo mock o fuera de línea
      }
    } finally {
      setIsLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadData()
  }, [loadData])

  const puedeSolicitar = academicStatus ? academicStatus.puedeSolicitar : true
  const estadoAlumno = academicStatus?.estadoAlumno || user?.estadoAlumno || 'ACTIVO'

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault()

    // Control de cliente complementario (el servidor ejecuta la validación definitiva)
    if (!puedeSolicitar) {
      showToast(
        `Acceso restringido: Su estatus escolar es ${estadoAlumno}. Solo alumnos con estatus ACTIVO pueden generar solicitudes.`,
        'error'
      )
      setIsModalOpen(false)
      return
    }

    setIsSubmitting(true)
    try {
      const titles: Record<string, string> = {
        CONSTANCIA: 'Constancia de Estudios con Promedio y Horario',
        CARDEX: 'Kárdex Oficial Certificado para Trámite Externo',
        SOBRECUPO: 'Autorización Especial de Sobrecupo',
        EXAMEN_EXTRAORDINARIO: 'Solicitud de Examen Extraordinario de Regularización',
        BAJA_TEMPORAL: 'Solicitud de Baja Temporal de Periodo',
      }

      try {
        // Enviar al backend autoritativo
        const created = await createStudentDocumentRequest(newRequestType, newJustification)
        const newReq: DetailedStudentRequest = {
          id: created.solicitudId,
          folio: created.folio,
          tipo: (created.tipoCodigo as any) || newRequestType,
          titulo: created.tipoNombre || titles[newRequestType] || 'Solicitud Académica',
          solicitante: user?.nombreCompleto || 'Valeria Sofía Morales Rivas',
          matricula: user?.matricula || '202301042',
          carrera: user?.carreraNombre || 'Ingeniería en Sistemas Computacionales',
          fechaSolicitud: 'Hoy',
          estado: 'EN_REVISION',
          observaciones: newJustification || 'Solicitud formal ingresada por el alumno.',
          periodo: '2026-B',
        }
        setRequests([newReq, ...requests])
        setIsModalOpen(false)
        setNewJustification('')
        showToast(`Solicitud ${newReq.folio} registrada exitosamente. Turnada a Jefatura de Carrera.`)
      } catch (err: unknown) {
        const errorMsg =
          err instanceof Error
            ? err.message
            : 'Error del servidor al registrar la solicitud documental'
        showToast(errorMsg, 'error')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredRequests = requests.filter((r) => {
    const matchesFilter = filterType === 'ALL' || r.tipo === filterType
    const matchesSearch =
      r.folio.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.titulo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.observaciones.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesFilter && matchesSearch
  })

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
        <div
          className={`px-4 py-3 rounded-lg flex items-center gap-2 shadow-sm animate-fade-in text-sm border ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Alerta Institucional para Alumnos Inactivos */}
      {!puedeSolicitar && (
        <div className="bg-amber-50 border border-amber-300 text-amber-900 p-4 rounded-lg flex items-start gap-3 shadow-sm text-xs animate-fade-in">
          <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <strong className="block text-sm font-bold text-amber-900">
              Acceso Restringido a Nuevas Solicitudes Documentales
            </strong>
            <p className="mt-1 text-amber-800 leading-relaxed">
              Su estatus escolar institucional actualmente registrado es{' '}
              <span className="font-bold underline uppercase">{estadoAlumno}</span>.
              Por normativa académica y de control escolar de SecureCampus, la generación y expedición de nuevas solicitudes
              está reservada estrictamente a alumnos con estatus académico <strong>ACTIVO</strong>.
            </p>
            <p className="mt-1 text-amber-700">
              Usted puede continuar consultando a continuación el historial y estado de sus trámites anteriores.
              Para regularizar su estatus, favor de acudir a la Jefatura de Carrera o Servicios Escolares.
            </p>
          </div>
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
              <Badge
                variant={puedeSolicitar ? 'success' : 'danger'}
                className="text-xs font-mono font-bold"
              >
                ALUMNO {estadoAlumno}
              </Badge>
            </div>
            <p className="text-xs text-secondary-slate max-w-3xl">
              Genera solicitudes formales ante Control Escolar y Jefatura de Carrera. Todos los documentos emitidos cuentan con código QR y firma digital SHA-256 verificable.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="secondary"
              size="md"
              leftIcon={<RefreshCw className={`w-4 h-4 shrink-0 ${isLoading ? 'animate-spin' : ''}`} />}
              onClick={loadData}
              disabled={isLoading}
              title="Actualizar estado y solicitudes"
            >
              Actualizar
            </Button>
            {puedeSolicitar ? (
              <Button
                variant="primary"
                size="md"
                leftIcon={<PlusCircle className="w-4 h-4 shrink-0" />}
                onClick={() => setIsModalOpen(true)}
                className="shadow-sm"
              >
                Nueva Solicitud de Trámite
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="md"
                disabled
                leftIcon={<Lock className="w-4 h-4 shrink-0 text-secondary-muted" />}
                className="opacity-60 cursor-not-allowed shadow-none"
                title="Trámites no disponibles para alumnos con estatus inactivo"
              >
                Trámite Restringido (Inactivo)
              </Button>
            )}
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
              <span className="text-3xl font-extrabold text-emerald-700 font-mono">
                {requests.filter((r) => r.estado === 'APROBADA').length}
              </span>
              <span className="text-xs text-secondary-slate">dictámenes</span>
            </div>
            <div className="w-full bg-surface-canvas rounded-full h-1.5 overflow-hidden mt-2 border border-border-subtle">
              <div
                className="bg-emerald-600 h-full rounded-full"
                style={{
                  width: `${requests.length ? (requests.filter((r) => r.estado === 'APROBADA').length / requests.length) * 100 : 0}%`,
                }}
              ></div>
            </div>
          </div>
          <span className="text-[11px] text-emerald-700 font-semibold">Disponibles para descarga</span>
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
              <span className="text-3xl font-extrabold text-amber-700 font-mono">
                {requests.filter((r) => r.estado === 'EN_REVISION').length}
              </span>
              <span className="text-xs text-secondary-slate">en proceso</span>
            </div>
            <div className="w-full bg-surface-canvas rounded-full h-1.5 overflow-hidden mt-2 border border-border-subtle">
              <div
                className="bg-amber-600 h-full rounded-full"
                style={{
                  width: `${requests.length ? (requests.filter((r) => r.estado === 'EN_REVISION').length / requests.length) * 100 : 0}%`,
                }}
              ></div>
            </div>
          </div>
          <span className="text-[11px] text-amber-700 font-semibold">Turnadas a Jefatura</span>
        </Card>

        {/* KPI 4 */}
        <Card className="p-4 border border-border shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-secondary-slate uppercase tracking-wider">
              Estatus Académico
            </span>
            <div className="p-1.5 bg-purple-50 text-purple-700 rounded">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-secondary uppercase font-mono">
                {estadoAlumno}
              </span>
            </div>
            <div className="w-full bg-surface-canvas rounded-full h-1.5 overflow-hidden mt-2 border border-border-subtle">
              <div
                className={`h-full rounded-full ${puedeSolicitar ? 'bg-purple-600' : 'bg-red-500'}`}
                style={{ width: '100%' }}
              ></div>
            </div>
          </div>
          <span className="text-[11px] text-secondary-slate">
            {puedeSolicitar ? 'Habilitado para solicitudes' : 'Restringido reglamentariamente'}
          </span>
        </Card>
      </div>

      {/* Tabla Principal de Historial de Solicitudes */}
      <Card className="border border-border shadow-sm">
        <div className="p-4 border-b border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold text-secondary">
              Historial de Solicitudes y Dictámenes Escolares ({filteredRequests.length})
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="text-xs bg-surface-canvas border border-border rounded px-2.5 py-1.5 text-secondary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">Todos los trámites</option>
              <option value="CONSTANCIA">Constancia</option>
              <option value="CARDEX">Cardex</option>
              <option value="SOBRECUPO">Sobrecupo</option>
              <option value="EXAMEN_EXTRAORDINARIO">Examen Extraordinario</option>
              <option value="BAJA_TEMPORAL">Baja Temporal</option>
            </select>

            <div className="relative flex items-center">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-secondary-slate pointer-events-none shrink-0" />
              <input
                type="text"
                placeholder="Buscar por folio o trámite..."
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

      {/* Modal: Nueva Solicitud (Solo disponible si el alumno está activo) */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={puedeSolicitar ? "Crear Nueva Solicitud de Trámite Escolar" : "Trámite No Disponible"}
      >
        {puedeSolicitar ? (
          <form onSubmit={handleCreateRequest} className="space-y-4">
            <p className="text-xs text-secondary-slate">
              Selecciona el tipo de trámite académico requerido. Tu solicitud será turnada a las autoridades correspondientes para su dictaminación.
            </p>

            <Select
              label="Tipo de Trámite Académico"
              value={newRequestType}
              onChange={(e) => setNewRequestType(e.target.value)}
              options={[
                { label: 'Constancia de Estudios con Promedio y Horario', value: 'CONSTANCIA' },
                { label: 'Kárdex Oficial Certificado para Trámite Externo', value: 'CARDEX' },
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
              <Button variant="primary" type="submit" isLoading={isSubmitting}>
                Enviar Solicitud Oficial
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4 text-xs text-secondary">
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-800">
              Su estatus actual ({estadoAlumno}) no permite generar nuevas solicitudes.
            </div>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
                Cerrar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
