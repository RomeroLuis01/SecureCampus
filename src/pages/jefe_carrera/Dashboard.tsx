import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users,
  Calendar,
  Award,
  PlusCircle,
  Search,
  BookOpen,
  CheckCircle,
  FileCheck,
  Check,
  X,
  Eye,
} from 'lucide-react'
import { Card, Button, Badge, Modal, Input, Select, Table } from '../../components'
import type { Column } from '../../components'
import {
  mockJefeCareerProfile,
  mockStaffTeachers,
  mockCurricularGroups,
  mockStudentDetailedRequests,
} from '../../services/mockData'
import type {
  StaffTeacher,
  CurricularGroup,
  DetailedStudentRequest,
} from '../../services/mockData'

export const JefeDashboard: React.FC = () => {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'docentes' | 'grupos' | 'inscripciones'>('docentes')
  const [searchDocente, setSearchDocente] = useState('')
  const [searchGrupo, setSearchGrupo] = useState('')
  const [teachers, setTeachers] = useState<StaffTeacher[]>(mockStaffTeachers)
  const [groups, setGroups] = useState<CurricularGroup[]>(mockCurricularGroups)
  const [requests, setRequests] = useState<DetailedStudentRequest[]>(mockStudentDetailedRequests)

  // Modales
  const [isAddTeacherModalOpen, setIsAddTeacherModalOpen] = useState(false)
  const [isAddGroupModalOpen, setIsAddGroupModalOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Form states
  const [newTeacherName, setNewTeacherName] = useState('')
  const [newTeacherNomina, setNewTeacherNomina] = useState('')
  const [newTeacherCedula, setNewTeacherCedula] = useState('')
  const [newTeacherPlaza, setNewTeacherPlaza] = useState<'TIEMPO_COMPLETO' | 'ASIGNATURA'>('TIEMPO_COMPLETO')

  const [newGroupMateria, setNewGroupMateria] = useState('')
  const [newGroupClave, setNewGroupClave] = useState('')
  const [newGroupCodigo, setNewGroupCodigo] = useState('')
  const [newGroupAula, setNewGroupAula] = useState('')
  const [newGroupDocente, setNewGroupDocente] = useState('')
  const [newGroupParciales, setNewGroupParciales] = useState<number>(3)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 4000)
  }

  const handleAddTeacher = (e: React.FormEvent) => {
    e.preventDefault()
    const newDoc: StaffTeacher = {
      id: `doc-${Date.now()}`,
      numeroNomina: newTeacherNomina || `DOC-${Math.floor(1000 + Math.random() * 9000)}`,
      nombreCompleto: newTeacherName,
      rfc: 'XAXX010101000',
      curp: 'XAXX010101HDFR00',
      cedulaDgp: newTeacherCedula || '9988771-DGP',
      gradoAcademico: 'Maestría en Computación',
      tipoPlaza: newTeacherPlaza,
      horasSemanales: newTeacherPlaza === 'TIEMPO_COMPLETO' ? 20 : 12,
      materiasAsignadas: ['Asignatura por designar'],
      estado: 'VIGENTE',
      cubiculo: 'Área Docente Asignación',
      correoInstitucional: `${newTeacherName.toLowerCase().replace(/\s+/g, '.')}@securecampus.edu`,
    }
    setTeachers([newDoc, ...teachers])
    setIsAddTeacherModalOpen(false)
    setNewTeacherName('')
    setNewTeacherNomina('')
    setNewTeacherCedula('')
    showToast('Docente adscrito formalmente al catálogo departamental conforme a RBAC.')
  }

  const handleAddGroup = (e: React.FormEvent) => {
    e.preventDefault()
    const newGrp: CurricularGroup = {
      id: `grp-${Date.now()}`,
      claveMateria: newGroupClave || 'CS-702',
      nombreMateria: newGroupMateria,
      codigoGrupo: newGroupCodigo || '7CV2',
      semestre: 7,
      turno: 'MATUTINO',
      docenteTitular: newGroupDocente || 'Dr. Antonio Méndez',
      docenteNomina: 'DOC-8821',
      aula: newGroupAula || 'Lab Redes 1',
      edificio: 'Edificio Tecnologías',
      tipoEspacio: 'LABORATORIO_ESPECIALIZADO',
      horario: '07:00 - 09:00',
      dias: 'Lun, Mié',
      inscritos: 0,
      capacidadMaxima: 30,
      sobrecuposEmitidos: 0,
      estado: 'ABIERTO',
      numeroParciales: Number(newGroupParciales) || 3,
    }
    setGroups([newGrp, ...groups])
    setIsAddGroupModalOpen(false)
    setNewGroupMateria('')
    setNewGroupClave('')
    setNewGroupCodigo('')
    setNewGroupAula('')
    setNewGroupParciales(3)
    showToast('Grupo aperturado exitosamente. Validación espacial sin colisiones de aula.')
  }

  const handleApproveRequest = (id: string) => {
    setRequests(
      requests.map((r) =>
        r.id === id ? { ...r, estado: 'APROBADA', fechaResolucion: 'Hoy' } : r,
      ),
    )
    showToast('Solicitud dictaminada y aprobada oficialmente por Jefatura.')
  }

  const handleRejectRequest = (id: string) => {
    setRequests(
      requests.map((r) =>
        r.id === id ? { ...r, estado: 'RECHAZADA', fechaResolucion: 'Hoy' } : r,
      ),
    )
    showToast('Solicitud dictaminada como improcedente conforme a reglamento escolar.')
  }

  const filteredTeachers = teachers.filter(
    (t) =>
      t.nombreCompleto.toLowerCase().includes(searchDocente.toLowerCase()) ||
      t.numeroNomina.toLowerCase().includes(searchDocente.toLowerCase()) ||
      t.cedulaDgp.toLowerCase().includes(searchDocente.toLowerCase()),
  )

  const filteredGroups = groups.filter(
    (g) =>
      g.nombreMateria.toLowerCase().includes(searchGrupo.toLowerCase()) ||
      g.claveMateria.toLowerCase().includes(searchGrupo.toLowerCase()) ||
      g.codigoGrupo.toLowerCase().includes(searchGrupo.toLowerCase()),
  )

  const teacherColumns: Column<StaffTeacher>[] = [
    {
      key: 'nomina',
      title: 'Nómina',
      render: (t) => <span className="font-mono font-bold text-xs text-primary">{t.numeroNomina}</span>,
    },
    {
      key: 'docente',
      title: 'Docente',
      render: (t) => (
        <div className="space-y-0.5">
          <strong className="text-xs text-secondary block">{t.nombreCompleto}</strong>
          <span className="text-[11px] text-secondary-slate block truncate max-w-xs">{t.gradoAcademico}</span>
        </div>
      ),
    },
    {
      key: 'cedula',
      title: 'Cédula DGP',
      render: (t) => <span className="font-mono text-xs text-secondary-slate">{t.cedulaDgp}</span>,
    },
    {
      key: 'plaza',
      title: 'Plaza',
      render: (t) => (
        <Badge variant={t.tipoPlaza === 'TIEMPO_COMPLETO' ? 'info' : 'inactive'} className="text-[10px]">
          {t.tipoPlaza === 'TIEMPO_COMPLETO' ? 'Tiempo Completo' : 'Asignatura'}
        </Badge>
      ),
    },
    {
      key: 'horas',
      title: 'Horas',
      render: (t) => <span className="font-mono text-xs font-semibold text-secondary">{t.horasSemanales} hrs</span>,
    },
    {
      key: 'estado',
      title: 'Estado',
      render: (t) => (
        <Badge variant={t.estado === 'VIGENTE' ? 'success' : 'warning'} className="text-[10px]">
          {t.estado}
        </Badge>
      ),
    },
    {
      key: 'acciones',
      title: 'Acciones',
      render: (t) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            className="px-2 py-1 text-xs"
            onClick={() => alert(`Expediente docente de: ${t.nombreCompleto}`)}
          >
            <Eye className="w-3.5 h-3.5" />
          </Button>
        </div>
      ),
    },
  ]

  const groupColumns: Column<CurricularGroup>[] = [
    {
      key: 'clave',
      title: 'Clave',
      render: (g) => <span className="font-mono font-bold text-xs text-primary">{g.claveMateria}</span>,
    },
    {
      key: 'asignatura',
      title: 'Asignatura',
      render: (g) => <span className="text-xs font-bold text-secondary">{g.nombreMateria}</span>,
    },
    {
      key: 'grupo',
      title: 'Grupo',
      render: (g) => (
        <span className="font-mono font-bold text-xs text-secondary bg-surface-canvas px-1.5 py-0.5 rounded border border-border-subtle">
          {g.codigoGrupo}
        </span>
      ),
    },
    {
      key: 'docente',
      title: 'Docente Titular',
      render: (g) => <span className="text-xs text-secondary-slate">{g.docenteTitular}</span>,
    },
    {
      key: 'espacio',
      title: 'Espacio / Aula',
      render: (g) => (
        <div className="text-xs">
          <strong className="text-secondary block">{g.aula}</strong>
          <span className="text-[10px] text-secondary-slate">{g.edificio}</span>
        </div>
      ),
    },
    {
      key: 'horario',
      title: 'Horario',
      render: (g) => <span className="font-mono text-xs text-secondary-slate">{g.dias} {g.horario}</span>,
    },
    {
      key: 'ocupacion',
      title: 'Ocupación',
      render: (g) => (
        <div className="text-xs">
          <span className="font-bold text-secondary">{g.inscritos} / {g.capacidadMaxima}</span>
          {g.sobrecuposEmitidos > 0 && (
            <span className="text-[10px] text-amber-700 block font-medium">+{g.sobrecuposEmitidos} sobrecupo</span>
          )}
        </div>
      ),
    },
    {
      key: 'estado',
      title: 'Estado',
      render: (g) => (
        <Badge variant={g.estado === 'ABIERTO' ? 'success' : 'inactive'} className="text-[10px]">
          {g.estado}
        </Badge>
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

      {/* Header Institucional Jefatura de Carrera */}
      <div className="bg-surface-lowest rounded-lg border border-border shadow-sm p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-xl bg-primary/10 border-2 border-primary/20 flex items-center justify-center text-primary font-bold text-2xl shadow-inner">
              AM
            </div>
            <span className="absolute -bottom-1 -right-1 w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center shadow-sm" title="Jefe Titular Verificado">
              <Award className="w-3.5 h-3.5 shrink-0" />
            </span>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-secondary tracking-tight">
                {mockJefeCareerProfile.titularNombre}
              </h1>
              <Badge variant="info" className="text-[11px] font-semibold uppercase">
                Jefe de Carrera Titular
              </Badge>
            </div>
            <p className="text-xs text-secondary-slate">
              {mockJefeCareerProfile.carrera} •{' '}
              <strong className="text-secondary font-mono">CCT: {mockJefeCareerProfile.cct}</strong>
            </p>
            <div className="flex items-center gap-3 pt-1 text-[11px] text-secondary-slate flex-wrap font-mono">
              <span className="flex items-center gap-1 text-primary font-semibold">
                <FileCheck className="w-3.5 h-3.5 shrink-0" />
                RBAC Scope: [ING-SIS]
              </span>
              <span>•</span>
              <span>Periodo Activo: {mockJefeCareerProfile.periodoActivo}</span>
              <span>•</span>
              <span className="text-emerald-700 font-semibold">OIDC SSO Activo</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
          <Button
            variant="secondary"
            size="md"
            leftIcon={<Users className="w-4 h-4 shrink-0" />}
            onClick={() => setIsAddTeacherModalOpen(true)}
          >
            Adscribir Profesor
          </Button>
          <Button
            variant="primary"
            size="md"
            leftIcon={<PlusCircle className="w-4 h-4 shrink-0" />}
            onClick={() => setIsAddGroupModalOpen(true)}
          >
            Aperturar Grupo
          </Button>
        </div>
      </div>

      {/* 4 Bento Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Matrícula Activa */}
        <Card className="p-4 border border-border shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-secondary-slate uppercase tracking-wider">Matrícula Activa</span>
            <div className="p-1.5 bg-blue-50 text-primary rounded">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-primary font-mono">{mockJefeCareerProfile.matriculaTotal}</span>
              <span className="text-xs text-secondary-slate">alumnos</span>
            </div>
            <div className="w-full bg-surface-canvas rounded-full h-1.5 overflow-hidden mt-2 border border-border-subtle">
              <div className="bg-primary h-full rounded-full" style={{ width: '94.2%' }}></div>
            </div>
          </div>
          <span className="text-[11px] text-secondary-slate">Capacidad instalada al 94.2%</span>
        </Card>

        {/* KPI 2: Grupos Ofertados */}
        <Card className="p-4 border border-border shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-secondary-slate uppercase tracking-wider">Grupos Ofertados</span>
            <div className="p-1.5 bg-blue-50 text-primary rounded">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-secondary font-mono">{mockJefeCareerProfile.gruposTotales}</span>
              <span className="text-xs text-secondary-slate">secciones</span>
            </div>
            <div className="flex items-center gap-2 mt-2 text-[11px] text-secondary-slate">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-600"></span> 41 Abiertos
              <span className="inline-block w-2 h-2 rounded-full bg-secondary"></span> 5 Planeados
              <span className="inline-block w-2 h-2 rounded-full bg-red-600"></span> 2 Cerrados
            </div>
          </div>
          <span className="text-[11px] text-secondary-slate">{mockJefeCareerProfile.periodoActivo}</span>
        </Card>

        {/* KPI 3: Planta Docente */}
        <Card className="p-4 border border-border shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-secondary-slate uppercase tracking-wider">Planta Docente</span>
            <div className="p-1.5 bg-blue-50 text-primary rounded">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-primary font-mono">{mockJefeCareerProfile.docentesAdscritos}</span>
              <span className="text-xs text-secondary-slate">profesores</span>
            </div>
            <div className="flex justify-between text-[11px] text-secondary-slate mt-2">
              <span>19 Tiempo Completo</span>
              <span>5 Asignatura</span>
            </div>
          </div>
          <span className="text-[11px] text-secondary-slate">Carga prom: 18.5 hrs/sem</span>
        </Card>

        {/* KPI 4: Sobrecupos Emitidos */}
        <Card className="p-4 border border-border shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-secondary-slate uppercase tracking-wider">Sobrecupos Emitidos</span>
            <div className="p-1.5 bg-amber-50 text-amber-700 rounded">
              <FileCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-secondary font-mono">{mockJefeCareerProfile.sobrecuposUtilizados}</span>
              <span className="text-xs text-secondary-slate">/ {mockJefeCareerProfile.sobrecuposMaximos} máx</span>
            </div>
            <div className="w-full bg-surface-canvas rounded-full h-1.5 overflow-hidden mt-2 border border-border-subtle">
              <div className="bg-amber-500 h-full rounded-full" style={{ width: '68%' }}></div>
            </div>
          </div>
          <span className="text-[11px] text-emerald-700 font-semibold">8 disponibles según reglamento</span>
        </Card>
      </div>

      {/* Tabs Switcher */}
      <div className="bg-surface-lowest p-1 rounded-lg border border-border flex items-center gap-1 overflow-x-auto shadow-sm">
        <button
          onClick={() => setActiveTab('docentes')}
          className={`flex items-center gap-2 px-4 py-2 rounded text-xs font-semibold transition-all ${
            activeTab === 'docentes'
              ? 'bg-primary text-white shadow-sm'
              : 'text-secondary-slate hover:bg-surface-canvas hover:text-secondary'
          }`}
        >
          <Users className="w-4 h-4" />
          Planta Docente Adscrita ({teachers.length})
        </button>
        <button
          onClick={() => setActiveTab('grupos')}
          className={`flex items-center gap-2 px-4 py-2 rounded text-xs font-semibold transition-all ${
            activeTab === 'grupos'
              ? 'bg-primary text-white shadow-sm'
              : 'text-secondary-slate hover:bg-surface-canvas hover:text-secondary'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Oferta Curricular & Horarios ({groups.length})
        </button>
        <button
          onClick={() => setActiveTab('inscripciones')}
          className={`flex items-center gap-2 px-4 py-2 rounded text-xs font-semibold transition-all ${
            activeTab === 'inscripciones'
              ? 'bg-primary text-white shadow-sm'
              : 'text-secondary-slate hover:bg-surface-canvas hover:text-secondary'
          }`}
        >
          <FileCheck className="w-4 h-4" />
          Inscripciones y Sobrecupos ({requests.length})
        </button>
      </div>

      {/* Tab 1: Planta Docente */}
      {activeTab === 'docentes' && (
        <Card className="border border-border shadow-sm">
          <div className="p-4 border-b border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-secondary">Plantilla de Catedráticos Departamentales</h2>
              <p className="text-xs text-secondary-slate">
                Alcance legal de jefatura: Alta y conclusión de adscripción departamental conforme a permisos RBAC.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex items-center">
                <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-secondary-slate pointer-events-none shrink-0" />
                <input
                  type="text"
                  placeholder="Buscar docente o nómina..."
                  value={searchDocente}
                  onChange={(e) => setSearchDocente(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs bg-surface-canvas border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary w-56"
                />
              </div>
              <Button variant="secondary" size="sm" onClick={() => navigate('/jefe_carrera/docentes')}>
                Vista Avanzada
              </Button>
            </div>
          </div>

          <Table
            columns={teacherColumns}
            data={filteredTeachers}
            rowKey={(t) => t.id}
          />
        </Card>
      )}

      {/* Tab 2: Oferta Curricular */}
      {activeTab === 'grupos' && (
        <Card className="border border-border shadow-sm">
          <div className="p-4 border-b border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-secondary">Programación Curricular y Grupos Acreditados</h2>
              <p className="text-xs text-secondary-slate">
                Planificación docente y asignación de aulas conforme al modelo curricular ISC-2020-RET.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex items-center">
                <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-secondary-slate pointer-events-none shrink-0" />
                <input
                  type="text"
                  placeholder="Buscar asignatura o grupo..."
                  value={searchGrupo}
                  onChange={(e) => setSearchGrupo(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs bg-surface-canvas border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary w-56"
                />
              </div>
              <Button variant="secondary" size="sm" onClick={() => navigate('/jefe_carrera/oferta')}>
                Programador Completo
              </Button>
            </div>
          </div>

          <Table
            columns={groupColumns}
            data={filteredGroups}
            rowKey={(g) => g.id}
          />
        </Card>
      )}

      {/* Tab 3: Inscripciones y Sobrecupos */}
      {activeTab === 'inscripciones' && (
        <Card className="border border-border shadow-sm">
          <div className="p-4 border-b border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-secondary">Resolución de Sobrecupos y Solicitudes de Alumnos</h2>
              <p className="text-xs text-secondary-slate">
                Dictaminación en primera instancia conforme al reglamento institucional de inscripciones.
              </p>
            </div>
            <Badge variant="info" className="text-xs">
              {requests.filter((r) => r.estado === 'EN_REVISION').length} Pendientes de Dictamen
            </Badge>
          </div>

          <div className="divide-y divide-border-subtle">
            {requests.map((req) => (
              <div key={req.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-surface-canvas/40 transition-colors">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                      {req.folio}
                    </span>
                    <strong className="text-sm text-secondary">{req.titulo}</strong>
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
                      {req.estado}
                    </Badge>
                  </div>
                  <p className="text-xs text-secondary-slate">
                    Alumno: <strong className="text-secondary">{req.solicitante}</strong> (Matrícula: {req.matricula}) • Fecha: {req.fechaSolicitud}
                  </p>
                  <p className="text-xs text-secondary-muted italic">"{req.observaciones}"</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {req.estado === 'EN_REVISION' ? (
                    <>
                      <Button
                        variant="primary"
                        size="sm"
                        leftIcon={<Check className="w-3.5 h-3.5 shrink-0" />}
                        onClick={() => handleApproveRequest(req.id)}
                      >
                        Autorizar
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        leftIcon={<X className="w-3.5 h-3.5 shrink-0" />}
                        onClick={() => handleRejectRequest(req.id)}
                      >
                        Rechazar
                      </Button>
                    </>
                  ) : (
                    <span className="text-xs font-mono font-medium text-secondary-slate">
                      Dictaminado: {req.fechaResolucion || 'Concluido'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Modal: Adscribir Profesor */}
      <Modal
        isOpen={isAddTeacherModalOpen}
        onClose={() => setIsAddTeacherModalOpen(false)}
        title="Adscribir Nuevo Catedrático a la División"
      >
        <form onSubmit={handleAddTeacher} className="space-y-4">
          <p className="text-xs text-secondary-slate">
            Registra a un docente en el catálogo departamental de la carrera. Se validará su cédula ante el expediente de DGP y Recursos Humanos.
          </p>
          <Input
            label="Nombre Completo del Docente (con grado)"
            placeholder="Ej. Dr. Mario Alberto Juárez"
            value={newTeacherName}
            onChange={(e) => setNewTeacherName(e.target.value)}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Número de Nómina"
              placeholder="DOC-8921"
              value={newTeacherNomina}
              onChange={(e) => setNewTeacherNomina(e.target.value)}
              required
            />
            <Input
              label="Cédula Profesional DGP"
              placeholder="5491204-DGP"
              value={newTeacherCedula}
              onChange={(e) => setNewTeacherCedula(e.target.value)}
              required
            />
          </div>
          <Select
            label="Tipo de Nombramiento / Plaza"
            value={newTeacherPlaza}
            onChange={(e) => setNewTeacherPlaza(e.target.value as 'TIEMPO_COMPLETO' | 'ASIGNATURA')}
            options={[
              { label: 'Tiempo Completo (20 - 40 hrs)', value: 'TIEMPO_COMPLETO' },
              { label: 'Por Asignatura (8 - 16 hrs)', value: 'ASIGNATURA' },
            ]}
          />
          <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
            <Button variant="ghost" type="button" onClick={() => setIsAddTeacherModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit">
              Adscribir Docente
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Aperturar Grupo */}
      <Modal
        isOpen={isAddGroupModalOpen}
        onClose={() => setIsAddGroupModalOpen(false)}
        title="Aperturar Nuevo Grupo en la Oferta Curricular"
      >
        <form onSubmit={handleAddGroup} className="space-y-4">
          <p className="text-xs text-secondary-slate">
            Registra una nueva sección curricular. Se verificará automáticamente que no existan traslapes en el espacio asignado.
          </p>
          <Input
            label="Nombre de la Asignatura"
            placeholder="Ej. Pentesting y Ciberdefensa"
            value={newGroupMateria}
            onChange={(e) => setNewGroupMateria(e.target.value)}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Clave de Asignatura"
              placeholder="CS-702"
              value={newGroupClave}
              onChange={(e) => setNewGroupClave(e.target.value)}
              required
            />
            <Input
              label="Código de Grupo"
              placeholder="7CV1"
              value={newGroupCodigo}
              onChange={(e) => setNewGroupCodigo(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Aula / Laboratorio"
              placeholder="Lab Redes 2"
              value={newGroupAula}
              onChange={(e) => setNewGroupAula(e.target.value)}
              required
            />
            <Input
              label="Docente Titular Asignado"
              placeholder="Dr. Antonio Méndez"
              value={newGroupDocente}
              onChange={(e) => setNewGroupDocente(e.target.value)}
              required
            />
          </div>
          <Input
            label="Número de Parciales"
            type="number"
            min={1}
            max={6}
            value={newGroupParciales}
            onChange={(e) => setNewGroupParciales(Math.max(1, Math.min(6, parseInt(e.target.value, 10) || 1)))}
            helperText="Rango institucional permitido: 1 a 6 parciales (por defecto 3)."
            required
          />
          <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
            <Button variant="ghost" type="button" onClick={() => setIsAddGroupModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit">
              Aperturar Sección
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
