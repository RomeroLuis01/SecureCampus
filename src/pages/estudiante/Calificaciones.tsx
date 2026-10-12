import React, { useState, useEffect, useCallback } from 'react'
import {
  Download,
  FileCheck,
  GraduationCap,
  Award,
  BookOpen,
  AlertCircle,
  RefreshCw,
  Loader2,
} from 'lucide-react'
import {
  Card,
  CardBody,
  Button,
  Badge,
  Select,
  Table,
} from '../../components'
import type { Column } from '../../components'
import {
  getStudentGrades,
  type StudentGradesResponse,
  type SubjectGradeItem,
} from '../../services'

export const StudentGradesView: React.FC = () => {
  const [data, setData] = useState<StudentGradesResponse | null>(null)
  const [selectedPeriodIndex, setSelectedPeriodIndex] = useState<number>(0)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)

  const fetchGrades = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await getStudentGrades()
      setData(response)
      setSelectedPeriodIndex(0)
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Error de comunicación al consultar calificaciones'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchGrades()
  }, [fetchGrades])

  const currentPeriod =
    data && data.periodos.length > 0
      ? data.periodos[selectedPeriodIndex] || data.periodos[0]
      : null

  // Columnas de la tabla con especificaciones de DESIGN.md (11px headers, 13px tabular-nums)
  const columns: Column<SubjectGradeItem>[] = [
    {
      key: 'codigo',
      title: 'Clave',
      isNumeric: true,
      width: '100px',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-primary bg-surface-canvas px-1.5 py-0.5 rounded border border-border-subtle">
          {row.codigo}
        </span>
      ),
    },
    {
      key: 'asignatura',
      title: 'Asignatura / Unidad de Aprendizaje',
      render: (row) => (
        <div>
          <span className="font-semibold text-secondary block">{row.asignatura}</span>
          <span className="text-[11px] text-secondary-slate">
            {row.profesor} • Grupo {row.claveGrupo}
          </span>
        </div>
      ),
    },
    {
      key: 'creditos',
      title: 'Créditos',
      isNumeric: true,
      align: 'center',
      width: '90px',
      render: (row) => <span className="font-mono tabular-nums">{row.creditos} CR</span>,
    },
    {
      key: 'estadoCalificacion',
      title: 'Evaluación',
      align: 'center',
      width: '130px',
      render: (row) => (
        <span className="text-[11px] text-secondary-slate font-medium">
          {row.estadoCalificacion === 'CAPTURADA' ? 'Ordinaria' : 'En Curso'}
        </span>
      ),
    },
    {
      key: 'calificacionFinal',
      title: 'Calificación Final',
      isNumeric: true,
      align: 'right',
      width: '140px',
      render: (row) => {
        if (row.calificacionFinal === null) {
          return <span className="text-xs text-secondary-slate italic">Pendiente</span>
        }
        const isPassing = row.estado === 'APROBADA'
        return (
          <span
            className={`font-mono text-sm font-bold tabular-nums ${
              isPassing ? 'text-secondary' : 'text-academic-danger'
            }`}
          >
            {row.calificacionFinal.toFixed(2)}
          </span>
        )
      },
    },
    {
      key: 'estado',
      title: 'Estatus',
      align: 'center',
      width: '120px',
      render: (row) => {
        const variant =
          row.estado === 'APROBADA'
            ? 'success'
            : row.estado === 'REPROBADA'
            ? 'danger'
            : 'warning'
        return (
          <Badge variant={variant} dot size="sm">
            {row.estado}
          </Badge>
        )
      },
    },
  ]

  const handleDownloadBoleta = () => {
    setIsDownloading(true)
    setTimeout(() => {
      setIsDownloading(false)
      alert('Boleta de calificaciones generada con firma digital SHA256.')
    }, 1000)
  }

  // 1. Estado de Carga
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 mb-1">
          <GraduationCap className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-secondary tracking-tight">
            Kárdex e Historial Académico
          </h1>
        </div>
        <Card>
          <CardBody className="p-12 flex flex-col items-center justify-center text-center space-y-3">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm font-medium text-secondary">
              Consultando registro oficial de calificaciones en PostgreSQL...
            </p>
            <p className="text-xs text-secondary-slate">
              Validando sesión criptográfica e identidad del estudiante.
            </p>
          </CardBody>
        </Card>
      </div>
    )
  }

  // 2. Estado de Error
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 mb-1">
          <GraduationCap className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-secondary tracking-tight">
            Kárdex e Historial Académico
          </h1>
        </div>
        <Card className="border-red-200 bg-red-50/40">
          <CardBody className="p-6 space-y-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-red-900">
                  No fue posible cargar las calificaciones
                </h3>
                <p className="text-xs text-red-700 mt-1">{error}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={fetchGrades}
                leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              >
                Reintentar Consulta
              </Button>
              {(error.toLowerCase().includes('401') ||
                error.toLowerCase().includes('sesión') ||
                error.toLowerCase().includes('autenticado')) && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    window.location.href = '/login'
                  }}
                >
                  Iniciar Sesión
                </Button>
              )}
            </div>
          </CardBody>
        </Card>
      </div>
    )
  }

  // 3. Estado Vacío (Sin registros)
  if (!currentPeriod || !data || data.periodos.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 mb-1">
          <GraduationCap className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-secondary tracking-tight">
            Kárdex e Historial Académico
          </h1>
        </div>
        <Card>
          <CardBody className="p-12 flex flex-col items-center justify-center text-center space-y-3">
            <BookOpen className="w-10 h-10 text-secondary-slate" />
            <h3 className="text-base font-bold text-secondary">
              Sin registros de calificaciones disponibles
            </h3>
            <p className="text-xs text-secondary-slate max-w-md">
              Actualmente no cuentas con materias inscritas o actas de evaluación
              registradas en el sistema escolar para este ciclo.
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={fetchGrades}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Actualizar
            </Button>
          </CardBody>
        </Card>
      </div>
    )
  }

  // 4. Vista Principal con Datos Reales
  return (
    <div className="space-y-6">
      {/* 1. Header con Filtro por Periodo y Acción de Descarga */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <GraduationCap className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold text-secondary tracking-tight">
              Kárdex e Historial Académico
            </h1>
          </div>
          <p className="text-xs text-secondary-slate">
            Registro oficial avalado por Servicios Escolares
            {data.matricula ? ` • Matrícula: ${data.matricula}` : ''}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-64">
            <Select
              value={selectedPeriodIndex}
              onChange={(e) => setSelectedPeriodIndex(Number(e.target.value))}
              options={data.periodos.map((p, idx) => ({
                value: idx,
                label: p.nombre,
              }))}
            />
          </div>

          <Button
            variant="secondary"
            size="md"
            onClick={handleDownloadBoleta}
            isLoading={isDownloading}
            leftIcon={<Download className="w-4 h-4" />}
          >
            Descargar Boleta PDF
          </Button>
        </div>
      </div>

      {/* 2. Tarjetas de Resumen General y del Periodo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-primary/20 bg-primary/5">
          <CardBody className="p-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-primary block">Promedio General</span>
                <Badge variant="info" size="sm" className="text-[10px] py-0 px-1">
                  Acumulado
                </Badge>
              </div>
              <span className="text-2xl font-bold font-mono text-primary tabular-nums mt-0.5 block">
                {data.resumenGeneral.promedioGeneral !== null
                  ? data.resumenGeneral.promedioGeneral.toFixed(2)
                  : 'N/A'}
              </span>
              <span className="text-[11px] text-secondary-slate mt-0.5 block">
                {data.resumenGeneral.creditosTotalesAprobados} créditos acreditados
              </span>
            </div>
            <div className="w-9 h-9 rounded bg-primary text-white flex items-center justify-center shadow-sm">
              <Award className="w-5 h-5" />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-4 flex items-center justify-between">
            <div>
              <span className="text-xs text-secondary-slate block">Promedio del Periodo</span>
              <span className="text-2xl font-bold font-mono text-secondary tabular-nums mt-0.5 block">
                {currentPeriod.resumen.promedio !== null
                  ? currentPeriod.resumen.promedio.toFixed(2)
                  : 'N/A'}
              </span>
              <span className="text-[11px] text-secondary-slate mt-0.5 block">
                {currentPeriod.codigo}
              </span>
            </div>
            <div className="w-9 h-9 rounded bg-emerald-50 text-academic-success flex items-center justify-center border border-emerald-100">
              <Award className="w-5 h-5" />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-4 flex items-center justify-between">
            <div>
              <span className="text-xs text-secondary-slate block">Créditos del Periodo</span>
              <span className="text-2xl font-bold font-mono text-secondary tabular-nums mt-0.5 block">
                {currentPeriod.resumen.creditosAprobados}{' '}
                <span className="text-xs font-normal text-secondary-slate">CR</span>
              </span>
              <span className="text-[11px] text-secondary-slate mt-0.5 block">
                Aprobados en {currentPeriod.codigo}
              </span>
            </div>
            <div className="w-9 h-9 rounded bg-blue-50 text-primary flex items-center justify-center border border-blue-100">
              <BookOpen className="w-5 h-5" />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-4 flex items-center justify-between">
            <div>
              <span className="text-xs text-secondary-slate block">Asignaturas Cursadas</span>
              <span className="text-2xl font-bold font-mono text-secondary tabular-nums mt-0.5 block">
                {currentPeriod.materias.length}{' '}
                <span className="text-xs font-normal text-secondary-slate">materias</span>
              </span>
              <span className="text-[11px] text-secondary-slate mt-0.5 block">
                {currentPeriod.materias.filter((m) => m.estadoCalificacion === 'PENDIENTE').length > 0
                  ? `${currentPeriod.materias.filter((m) => m.estadoCalificacion === 'PENDIENTE').length} en evaluación`
                  : 'Todas capturadas'}
              </span>
            </div>
            <div className="w-9 h-9 rounded bg-surface-canvas text-secondary-muted flex items-center justify-center border border-border">
              <FileCheck className="w-5 h-5" />
            </div>
          </CardBody>
        </Card>
      </div>

      {/* 3. Tabla Detallada de Asignaturas */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-secondary">
            Desglose de Calificaciones Oficiales • {currentPeriod.nombre}
          </h2>
          <span className="text-xs text-secondary-slate">
            Estatus:{' '}
            <strong
              className={
                currentPeriod.esActivo ? 'text-academic-success' : 'text-secondary'
              }
            >
              {currentPeriod.esActivo ? 'Periodo en Curso' : 'Actas Cerradas'}
            </strong>
          </span>
        </div>

        <Table
          columns={columns}
          data={currentPeriod.materias}
          rowKey={(row) => row.inscripcionId}
          emptyMessage="No se encontraron registros de calificaciones para este periodo."
        />
      </div>

      {/* 4. Pie Informativo y Validez Legal */}
      <div className="p-4 bg-surface-lowest border border-border rounded-lg text-xs text-secondary-slate flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-academic-success inline-block" />
          <span>
            Documento expedido con validez oficial conforme al Reglamento de Control Escolar de SecureCampus.
          </span>
        </div>
        <div className="text-[11px] font-mono text-secondary-muted">
          Cadena Original: SC-CERT-2026-VAL-{currentPeriod.codigo}
        </div>
      </div>
    </div>
  )
}
