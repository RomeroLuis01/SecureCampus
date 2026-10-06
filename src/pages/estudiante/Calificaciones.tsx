import React, { useState } from 'react'
import {
  Download,
  FileCheck,
  GraduationCap,
  Award,
  BookOpen,
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
import { mockKardexHistory } from '../../services/mockData'

interface SubjectGradeRow {
  codigo: string
  asignatura: string
  profesor: string
  creditos: number
  tipoEvaluacion: string
  calificacionFinal: number
  estado: 'APROBADA' | 'REPROBADA'
}

export const StudentGradesView: React.FC = () => {
  const [selectedPeriodIndex, setSelectedPeriodIndex] = useState<number>(0)
  const [isDownloading, setIsDownloading] = useState(false)

  const currentPeriod = mockKardexHistory[selectedPeriodIndex]

  // Columnas de la tabla con especificaciones de DESIGN.md (11px headers, 13px tabular-nums)
  const columns: Column<SubjectGradeRow>[] = [
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
          <span className="text-[11px] text-secondary-slate">{row.profesor}</span>
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
      key: 'tipoEvaluacion',
      title: 'Tipo Evaluación',
      align: 'center',
      width: '130px',
      render: (row) => (
        <span className="text-[11px] text-secondary-slate font-medium">
          {row.tipoEvaluacion}
        </span>
      ),
    },
    {
      key: 'calificacionFinal',
      title: 'Calificación Final',
      isNumeric: true,
      align: 'right',
      width: '140px',
      render: (row) => (
        <span
          className={`font-mono text-sm font-bold tabular-nums ${
            row.calificacionFinal >= 7.0 ? 'text-secondary' : 'text-academic-danger'
          }`}
        >
          {row.calificacionFinal.toFixed(2)}
        </span>
      ),
    },
    {
      key: 'estado',
      title: 'Estatus',
      align: 'center',
      width: '120px',
      render: (row) => (
        <Badge
          variant={row.estado === 'APROBADA' ? 'success' : 'danger'}
          dot
          size="sm"
        >
          {row.estado}
        </Badge>
      ),
    },
  ]

  const handleDownloadBoleta = () => {
    setIsDownloading(true)
    setTimeout(() => {
      setIsDownloading(false)
      alert('Boleta de calificaciones descargada con firma digital SHA256.')
    }, 1000)
  }

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
            Registro oficial y actas de calificaciones avaladas por Servicios Escolares.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-56">
            <Select
              value={selectedPeriodIndex}
              onChange={(e) => setSelectedPeriodIndex(Number(e.target.value))}
              options={mockKardexHistory.map((p, idx) => ({
                value: idx,
                label: p.periodo,
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

      {/* 2. Tarjetas de Resumen del Periodo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardBody className="p-4 flex items-center justify-between">
            <div>
              <span className="text-xs text-secondary-slate block">Promedio del Periodo</span>
              <span className="text-2xl font-bold font-mono text-secondary tabular-nums mt-0.5 block">
                {currentPeriod.promedioPeriodo.toFixed(2)}
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
              <span className="text-xs text-secondary-slate block">Créditos Aprobados</span>
              <span className="text-2xl font-bold font-mono text-secondary tabular-nums mt-0.5 block">
                {currentPeriod.creditosAprobados} <span className="text-xs font-normal text-secondary-slate">créditos</span>
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
                {currentPeriod.materias.length} <span className="text-xs font-normal text-secondary-slate">materias</span>
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
            Desglose de Calificaciones Oficiales • {currentPeriod.periodo}
          </h2>
          <span className="text-xs text-secondary-slate">
            Estatus:{' '}
            <strong className="text-academic-success">
              {currentPeriod.esActivo ? 'Periodo en Curso' : 'Actas Cerradas'}
            </strong>
          </span>
        </div>

        <Table
          columns={columns}
          data={currentPeriod.materias}
          rowKey={(row) => row.codigo}
          emptyMessage="No se encontraron registros de calificaciones para este periodo."
        />
      </div>

      {/* 4. Pie Informativo y Validez Legal */}
      <div className="p-4 bg-surface-lowest border border-border rounded-lg text-xs text-secondary-slate flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-academic-success inline-block" />
          <span>Documento expedido con validez oficial conforme al Reglamento de Control Escolar.</span>
        </div>
        <div className="text-[11px] font-mono text-secondary-muted">
          Cadena Original: SC-CERT-2026-99014-VAL
        </div>
      </div>
    </div>
  )
}
