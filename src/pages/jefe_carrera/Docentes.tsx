import React, { useState } from 'react'
import {
  CheckCircle,
  FileCheck,
  Search,
  Plus,
  Download,
  Briefcase,
  AlertTriangle,
  Clock,
  Filter,
} from 'lucide-react'
import { Card, Button, Badge, Modal, Input, Select, Table } from '../../components'
import type { Column } from '../../components'
import { mockStaffTeachers } from '../../services/mockData'
import type { StaffTeacher } from '../../services/mockData'

export const TeacherStaffView: React.FC = () => {
  const [teachers, setTeachers] = useState<StaffTeacher[]>(mockStaffTeachers)
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'VIGENTE' | 'SABATICO'>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Modal Alta
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formData, setFormData] = useState({
    nombreCompleto: '',
    numeroNomina: '',
    rfc: '',
    curp: '',
    cedulaDgp: '',
    gradoAcademico: '',
    tipoPlaza: 'TIEMPO_COMPLETO' as 'TIEMPO_COMPLETO' | 'ASIGNATURA',
    horasSemanales: 20,
    cubiculo: '',
    correoInstitucional: '',
  })

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 4000)
  }

  const handleRegisterTeacher = (e: React.FormEvent) => {
    e.preventDefault()
    const newDoc: StaffTeacher = {
      id: `doc-${Date.now()}`,
      numeroNomina: formData.numeroNomina || `DOC-${Math.floor(1000 + Math.random() * 9000)}`,
      nombreCompleto: formData.nombreCompleto,
      rfc: formData.rfc || 'MERA720914HY2',
      curp: formData.curp || 'MERA720914HDFRN09',
      cedulaDgp: formData.cedulaDgp || '4892104-DGP',
      gradoAcademico: formData.gradoAcademico || 'Doctorado en Ciencias Computacionales',
      tipoPlaza: formData.tipoPlaza,
      horasSemanales: Number(formData.horasSemanales),
      materiasAsignadas: ['Asignatura por Programar'],
      estado: 'VIGENTE',
      cubiculo: formData.cubiculo || 'Edificio B Nivel 2',
      correoInstitucional:
        formData.correoInstitucional ||
        `${formData.nombreCompleto.toLowerCase().replace(/\s+/g, '.')}@securecampus.edu`,
    }

    setTeachers([newDoc, ...teachers])
    setIsModalOpen(false)
    setFormData({
      nombreCompleto: '',
      numeroNomina: '',
      rfc: '',
      curp: '',
      cedulaDgp: '',
      gradoAcademico: '',
      tipoPlaza: 'TIEMPO_COMPLETO',
      horasSemanales: 20,
      cubiculo: '',
      correoInstitucional: '',
    })
    showToast('Docente registrado exitosamente y validado con cédula DGP en la base de datos central.')
  }

  const handleToggleStatus = (id: string) => {
    setTeachers(
      teachers.map((t) => {
        if (t.id === id) {
          const nextState = t.estado === 'VIGENTE' ? 'SABATICO' : 'VIGENTE'
          showToast(`Estado de adscripción de ${t.nombreCompleto} actualizado a: ${nextState}`)
          return { ...t, estado: nextState }
        }
        return t
      }),
    )
  }

  const filteredTeachers = teachers.filter((t) => {
    const matchesStatus =
      filterStatus === 'ALL' || t.estado === filterStatus
    const matchesSearch =
      t.nombreCompleto.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.numeroNomina.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.cedulaDgp.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.rfc.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesStatus && matchesSearch
  })

  const vigentesCount = teachers.filter((t) => t.estado === 'VIGENTE').length
  const sabaticosCount = teachers.filter((t) => t.estado === 'SABATICO').length

  const docenteColumns: Column<StaffTeacher>[] = [
    {
      key: 'nomina',
      title: 'Nómina',
      render: (doc) => <span className="font-mono font-bold text-xs text-primary">{doc.numeroNomina}</span>,
    },
    {
      key: 'catedratico',
      title: 'Catedrático & Grado',
      render: (doc) => (
        <div className="space-y-0.5">
          <strong className="text-xs text-secondary block">{doc.nombreCompleto}</strong>
          <span className="text-[11px] text-secondary-slate block truncate max-w-xs">{doc.gradoAcademico}</span>
          <span className="text-[10px] text-primary block truncate font-mono">{doc.correoInstitucional}</span>
        </div>
      ),
    },
    {
      key: 'ids',
      title: 'Identificadores (RFC / Cédula)',
      render: (doc) => (
        <div className="space-y-0.5 font-mono text-[11px]">
          <span className="text-secondary block">RFC: {doc.rfc}</span>
          <span className="text-secondary-slate block">DGP: {doc.cedulaDgp}</span>
        </div>
      ),
    },
    {
      key: 'plaza',
      title: 'Plaza & Carga',
      render: (doc) => (
        <div className="text-xs">
          <Badge variant={doc.tipoPlaza === 'TIEMPO_COMPLETO' ? 'info' : 'inactive'} className="text-[10px]">
            {doc.tipoPlaza === 'TIEMPO_COMPLETO' ? 'Tiempo Completo' : 'Asignatura'}
          </Badge>
          <span className="block font-mono text-secondary font-bold mt-1">{doc.horasSemanales} hrs/sem</span>
        </div>
      ),
    },
    {
      key: 'cubiculo',
      title: 'Cubículo',
      render: (doc) => <span className="text-xs text-secondary-slate">{doc.cubiculo}</span>,
    },
    {
      key: 'materias',
      title: 'Asignaturas Impartidas',
      render: (doc) => (
        <div className="text-xs space-y-1 max-w-xs">
          {doc.materiasAsignadas.length > 0 ? (
            doc.materiasAsignadas.map((m, i) => (
              <span key={i} className="inline-block bg-surface-canvas border border-border-subtle px-1.5 py-0.5 rounded text-[10px] font-medium text-secondary mr-1 mb-0.5">
                {m}
              </span>
            ))
          ) : (
            <span className="text-[10px] text-amber-700 italic">Sin carga frente a grupo (Sabático)</span>
          )}
        </div>
      ),
    },
    {
      key: 'estado',
      title: 'Estado',
      render: (doc) => (
        <Badge variant={doc.estado === 'VIGENTE' ? 'success' : 'warning'} className="text-[10px]">
          {doc.estado}
        </Badge>
      ),
    },
    {
      key: 'acciones',
      title: 'Acciones',
      render: (doc) => (
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleToggleStatus(doc.id)}
            title="Alternar estado Vigente/Sabático"
          >
            {doc.estado === 'VIGENTE' ? 'Poner Sabático' : 'Reactivar'}
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-lg flex items-center gap-2 shadow-sm animate-fade-in text-sm">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Breadcrumb & Header Institucional */}
      <div className="flex flex-col gap-2">
        <nav className="flex items-center gap-2 text-xs text-secondary-slate">
          <span>Portal Jefatura</span>
          <span>/</span>
          <span>Personal Académico</span>
          <span>/</span>
          <span className="text-primary font-semibold">Gestión de Planta Docente</span>
        </nav>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-surface-lowest p-6 rounded-lg border border-border shadow-sm">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-secondary tracking-tight">
                Directorio y Asignación de Planta Docente
              </h1>
              <Badge variant="info" className="px-2.5 py-0.5 text-xs font-bold uppercase">
                {teachers.length} DOCENTES ADSCRITOS
              </Badge>
              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-surface-canvas text-secondary-slate border border-border-subtle font-mono">
                ING-SIS-09
              </span>
            </div>

            {/* Selector de Estatus Operativo */}
            <div className="flex items-center gap-1 bg-surface-canvas p-1 rounded-lg w-fit border border-border-subtle">
              <button
                type="button"
                onClick={() => setFilterStatus('ALL')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-all whitespace-nowrap leading-none ${
                  filterStatus === 'ALL'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-secondary-slate hover:bg-surface-lowest'
                }`}
              >
                Todos ({teachers.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('VIGENTE')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap leading-none ${
                  filterStatus === 'VIGENTE'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-secondary-slate hover:bg-surface-lowest'
                }`}
              >
                <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                Vigentes ({vigentesCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('SABATICO')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap leading-none ${
                  filterStatus === 'SABATICO'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-secondary-slate hover:bg-surface-lowest'
                }`}
              >
                <Clock className="w-3.5 h-3.5 shrink-0" />
                En Sabático ({sabaticosCount})
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Button
              variant="secondary"
              size="md"
              leftIcon={<Download className="w-4 h-4 shrink-0 text-secondary-slate" />}
              onClick={() => alert('Exportando plantilla docente completa en formato oficial Excel/PDF...')}
            >
              Exportar Plantilla
            </Button>
            <Button
              variant="primary"
              size="md"
              leftIcon={<Plus className="w-4 h-4 shrink-0" />}
              onClick={() => setIsModalOpen(true)}
            >
              Registrar Nueva Alta Docente
            </Button>
          </div>
        </div>
      </div>

      {/* Bento Grid de Cobertura y Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Horas Totales */}
        <Card className="p-4 border border-border shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-secondary-slate uppercase tracking-wider">
              Horas Semanales Asignadas
            </span>
            <div className="p-1.5 bg-blue-50 text-primary rounded">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-secondary font-mono">272</span>
              <span className="text-xs text-secondary-slate">hrs / semana</span>
            </div>
            <div className="w-full bg-surface-canvas rounded-full h-1.5 overflow-hidden mt-2 border border-border-subtle">
              <div className="bg-primary h-full rounded-full" style={{ width: '100%' }}></div>
            </div>
          </div>
          <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5" />
            100% cobertura del plan de estudios
          </span>
        </Card>

        {/* KPI 2: Cédulas Auditadas */}
        <Card className="p-4 border border-border shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-secondary-slate uppercase tracking-wider">
              Cédulas DGP Auditadas
            </span>
            <div className="p-1.5 bg-emerald-50 text-emerald-700 rounded">
              <FileCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-emerald-700 font-mono">100%</span>
              <span className="text-xs text-secondary-slate font-mono">({teachers.length}/{teachers.length})</span>
            </div>
            <div className="w-full bg-surface-canvas rounded-full h-1.5 overflow-hidden mt-2 border border-border-subtle">
              <div className="bg-emerald-600 h-full rounded-full" style={{ width: '100%' }}></div>
            </div>
          </div>
          <span className="text-[11px] text-emerald-700 font-semibold">
            Auditado ante DGP y RH Central
          </span>
        </Card>

        {/* KPI 3: Cátedras Asignadas */}
        <Card className="p-4 border border-border shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-secondary-slate uppercase tracking-wider">
              Cátedras Asignadas
            </span>
            <div className="p-1.5 bg-blue-50 text-primary rounded">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-secondary font-mono">38</span>
              <span className="text-xs text-secondary-slate">secciones activas</span>
            </div>
            <div className="w-full bg-surface-canvas rounded-full h-1.5 overflow-hidden mt-2 border border-border-subtle">
              <div className="bg-secondary h-full rounded-full" style={{ width: '92%' }}></div>
            </div>
          </div>
          <span className="text-[11px] text-secondary-slate">
            Promedio 1.8 materias / catedrático
          </span>
        </Card>

        {/* KPI 4: Profesores en Sabático */}
        <Card className="p-4 border border-border shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-secondary-slate uppercase tracking-wider">
              Estancias y Sabáticos
            </span>
            <div className="p-1.5 bg-amber-50 text-amber-700 rounded">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-amber-700 font-mono">{sabaticosCount}</span>
              <span className="text-xs text-secondary-slate">profesores</span>
            </div>
            <div className="w-full bg-surface-canvas rounded-full h-1.5 overflow-hidden mt-2 border border-border-subtle">
              <div className="bg-amber-500 h-full rounded-full" style={{ width: '25%' }}></div>
            </div>
          </div>
          <span className="text-[11px] text-secondary-slate">
            Licencia aprobada por H. Consejo
          </span>
        </Card>
      </div>

      {/* Tabla Principal de Personal Docente */}
      <Card className="border border-border shadow-sm">
        <div className="p-4 border-b border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold text-secondary">
              Padrón Docente Institucional ({filteredTeachers.length} registros)
            </h2>
          </div>
          <div className="relative flex items-center">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-secondary-slate pointer-events-none shrink-0" />
            <input
              type="text"
              placeholder="Filtrar por nombre, nómina, RFC o cédula..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-surface-canvas border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary w-72"
            />
          </div>
        </div>

        <Table
          columns={docenteColumns}
          data={filteredTeachers}
          rowKey={(d) => d.id}
        />
      </Card>

      {/* Modal: Registrar Alta Docente */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Registrar Nueva Alta de Docente en Nómina Académica"
      >
        <form onSubmit={handleRegisterTeacher} className="space-y-4">
          <p className="text-xs text-secondary-slate">
            Captura los datos del catedrático para vincularlo a la división académica. Se generará su folio de adscripción y credenciales OIDC de acceso.
          </p>

          <Input
            label="Nombre Completo con Título Honorífico"
            placeholder="Ej. Dra. Mónica Patricia Esquivel"
            value={formData.nombreCompleto}
            onChange={(e) => setFormData({ ...formData, nombreCompleto: e.target.value })}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Número de Nómina"
              placeholder="DOC-9811"
              value={formData.numeroNomina}
              onChange={(e) => setFormData({ ...formData, numeroNomina: e.target.value })}
              required
            />
            <Input
              label="Cédula Profesional DGP"
              placeholder="6519203-DGP"
              value={formData.cedulaDgp}
              onChange={(e) => setFormData({ ...formData, cedulaDgp: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="RFC con Homoclave"
              placeholder="ESQM800115LP2"
              value={formData.rfc}
              onChange={(e) => setFormData({ ...formData, rfc: e.target.value })}
              required
            />
            <Input
              label="CURP Oficial"
              placeholder="ESQM800115MDFSP01"
              value={formData.curp}
              onChange={(e) => setFormData({ ...formData, curp: e.target.value })}
              required
            />
          </div>

          <Input
            label="Grado Académico Máximo e Institución"
            placeholder="Doctorado en Ciberseguridad (Politécnico Nacional)"
            value={formData.gradoAcademico}
            onChange={(e) => setFormData({ ...formData, gradoAcademico: e.target.value })}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Tipo de Nombramiento / Plaza"
              value={formData.tipoPlaza}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  tipoPlaza: e.target.value as 'TIEMPO_COMPLETO' | 'ASIGNATURA',
                })
              }
              options={[
                { label: 'Tiempo Completo (20 - 40 hrs)', value: 'TIEMPO_COMPLETO' },
                { label: 'Por Asignatura (8 - 16 hrs)', value: 'ASIGNATURA' },
              ]}
            />
            <Input
              label="Horas Semanales Asignadas"
              type="number"
              value={formData.horasSemanales.toString()}
              onChange={(e) =>
                setFormData({ ...formData, horasSemanales: Number(e.target.value) })
              }
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Cubículo / Ubicación en Campus"
              placeholder="Edificio B, Cubículo 204"
              value={formData.cubiculo}
              onChange={(e) => setFormData({ ...formData, cubiculo: e.target.value })}
              required
            />
            <Input
              label="Correo Institucional Preferente"
              type="email"
              placeholder="m.esquivel@securecampus.edu"
              value={formData.correoInstitucional}
              onChange={(e) => setFormData({ ...formData, correoInstitucional: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
            <Button variant="ghost" type="button" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit">
              Completar Registro Oficial
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
