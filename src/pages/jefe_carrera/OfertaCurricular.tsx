import React, { useState } from 'react'
import {
  Calendar,
  Building,
  CheckCircle,
  PlusCircle,
  Search,
  CheckCheck,
  Edit,
  Clock,
  Filter,
} from 'lucide-react'
import { Card, Button, Badge, Modal, Input, Select, Table } from '../../components'
import type { Column } from '../../components'
import { mockCurricularGroups } from '../../services/mockData'
import type { CurricularGroup } from '../../services/mockData'

export const CurricularOfferView: React.FC = () => {
  const [groups, setGroups] = useState<CurricularGroup[]>(mockCurricularGroups)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSemestre, setSelectedSemestre] = useState<string>('ALL')
  const [selectedTurno, setSelectedTurno] = useState<string>('ALL')
  const [toastMessage, setToastMessage] = useState<{ title: string; detail: string } | null>(null)

  // Drawer / Quick Action state
  const [focusedGroup, setFocusedGroup] = useState<CurricularGroup | null>(groups[0])
  const [isEditCapacityModalOpen, setIsEditCapacityModalOpen] = useState(false)
  const [tempCapacity, setTempCapacity] = useState<number>(30)
  const [tempAula, setTempAula] = useState<string>('')

  // Create Group Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [newGroup, setNewGroup] = useState({
    claveMateria: '',
    nombreMateria: '',
    codigoGrupo: '',
    semestre: 6,
    turno: 'MATUTINO' as 'MATUTINO' | 'VESPERTINO',
    docenteTitular: '',
    aula: '',
    edificio: 'Edificio Tecnologías',
    horario: '07:00 - 09:00',
    dias: 'Lun, Mié',
    capacidadMaxima: 30,
  })

  const showToast = (title: string, detail: string) => {
    setToastMessage({ title, detail })
    setTimeout(() => setToastMessage(null), 4500)
  }

  const validateRoomConflicts = () => {
    showToast(
      'Auditoría Espacial en Tiempo Real Concluida',
      'Restricción ex_sesiones_aula_sin_traslape: 0 colisiones en los 16 salones y 4 laboratorios activos del campus.',
    )
  }

  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault()
    const grp: CurricularGroup = {
      id: `grp-${Date.now()}`,
      claveMateria: newGroup.claveMateria || 'CS-605',
      nombreMateria: newGroup.nombreMateria,
      codigoGrupo: newGroup.codigoGrupo || '6CV3',
      semestre: Number(newGroup.semestre),
      turno: newGroup.turno,
      docenteTitular: newGroup.docenteTitular || 'Dr. Alejandro Méndez Rosas',
      docenteNomina: 'DOC-8821',
      aula: newGroup.aula || 'Lab Cómputo 3',
      edificio: newGroup.edificio,
      tipoEspacio: 'LABORATORIO_ESPECIALIZADO',
      horario: newGroup.horario,
      dias: newGroup.dias,
      inscritos: 0,
      capacidadMaxima: Number(newGroup.capacidadMaxima),
      sobrecuposEmitidos: 0,
      estado: 'ABIERTO',
    }
    setGroups([grp, ...groups])
    setFocusedGroup(grp)
    setIsCreateModalOpen(false)
    showToast(
      'Grupo Aperturado Exitosamente',
      `Sección ${grp.codigoGrupo} (${grp.claveMateria}) asignada a ${grp.aula} sin traslapes detectados.`,
    )
  }

  const handleUpdateGroupParam = (e: React.FormEvent) => {
    e.preventDefault()
    if (!focusedGroup) return
    setGroups(
      groups.map((g) =>
        g.id === focusedGroup.id
          ? { ...g, capacidadMaxima: tempCapacity, aula: tempAula || g.aula }
          : g,
      ),
    )
    setFocusedGroup((prev) => (prev ? { ...prev, capacidadMaxima: tempCapacity, aula: tempAula || prev.aula } : null))
    setIsEditCapacityModalOpen(false)
    showToast(
      'Parámetros Actualizados',
      `Cupo máximo de ${focusedGroup.codigoGrupo} reconfigurado a ${tempCapacity} alumnos.`,
    )
  }

  const filteredGroups = groups.filter((g) => {
    const matchesSearch =
      g.nombreMateria.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.claveMateria.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.codigoGrupo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.docenteTitular.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesSem =
      selectedSemestre === 'ALL' || g.semestre === Number(selectedSemestre)
    const matchesTurno =
      selectedTurno === 'ALL' || g.turno === selectedTurno
    return matchesSearch && matchesSem && matchesTurno
  })

  const groupColumns: Column<CurricularGroup>[] = [
    {
      key: 'clave',
      title: 'Clave',
      render: (grp) => <span className="font-mono font-bold text-xs text-primary">{grp.claveMateria}</span>,
    },
    {
      key: 'asignatura',
      title: 'Asignatura & Grupo',
      render: (grp) => (
        <div className="space-y-0.5">
          <strong className="text-xs text-secondary block">{grp.nombreMateria}</strong>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] font-bold text-primary bg-primary/10 px-1 rounded">
              Grupo: {grp.codigoGrupo}
            </span>
            <span className="text-[10px] text-secondary-slate">Sem {grp.semestre} • {grp.turno}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'docente',
      title: 'Docente Titular',
      render: (grp) => (
        <div className="text-xs">
          <span className="font-medium text-secondary block">{grp.docenteTitular}</span>
          <span className="font-mono text-[10px] text-secondary-slate">{grp.docenteNomina}</span>
        </div>
      ),
    },
    {
      key: 'aula',
      title: 'Espacio / Aula',
      render: (grp) => (
        <div className="text-xs">
          <strong className="text-secondary block">{grp.aula}</strong>
          <span className="text-[10px] text-secondary-slate">{grp.edificio}</span>
        </div>
      ),
    },
    {
      key: 'horario',
      title: 'Horario',
      render: (grp) => (
        <div className="font-mono text-xs text-secondary-slate">
          <span className="font-semibold text-secondary block">{grp.dias}</span>
          <span>{grp.horario}</span>
        </div>
      ),
    },
    {
      key: 'ocupacion',
      title: 'Ocupación',
      render: (grp) => (
        <div className="text-xs">
          <span className="font-bold text-secondary font-mono">{grp.inscritos} / {grp.capacidadMaxima}</span>
          {grp.sobrecuposEmitidos > 0 && (
            <span className="text-[10px] text-amber-700 block font-semibold">+{grp.sobrecuposEmitidos} sobrecupo</span>
          )}
        </div>
      ),
    },
    {
      key: 'estado',
      title: 'Estado',
      render: (grp) => (
        <Badge variant={grp.estado === 'ABIERTO' ? 'success' : 'inactive'} className="text-[10px]">
          {grp.estado}
        </Badge>
      ),
    },
    {
      key: 'seleccion',
      title: 'Selección',
      render: (grp) => (
        <Button
          variant={focusedGroup?.id === grp.id ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => setFocusedGroup(grp)}
        >
          {focusedGroup?.id === grp.id ? 'Activo' : 'Ver'}
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Toast Notifier */}
      {toastMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-lg flex items-start gap-3 shadow-md animate-fade-in text-sm">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <strong className="block font-bold">{toastMessage.title}</strong>
            <span className="text-xs text-emerald-700">{toastMessage.detail}</span>
          </div>
        </div>
      )}

      {/* Breadcrumb & Main Viewport Header */}
      <div className="space-y-2">
        <nav className="flex items-center gap-2 text-xs text-secondary-slate">
          <span>Portal Jefatura</span>
          <span>/</span>
          <span>Oferta Académica</span>
          <span>/</span>
          <span className="text-primary font-semibold">Oferta Curricular y Horarios</span>
        </nav>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-surface-lowest p-6 rounded-lg border border-border shadow-sm">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold text-secondary tracking-tight">
                Oferta Curricular y Programación de Horarios
              </h1>
              <Badge variant="info" className="text-xs uppercase font-bold">
                CICLO 2026-B AGO-DIC
              </Badge>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                ESTADO: PUBLICADO
              </span>
            </div>
            <p className="text-xs text-secondary-slate max-w-4xl">
              Planificación técnica por asignación de bloques espaciales y cuerpos colegiados para Ingeniería en Sistemas Computacionales. Modelo curricular <strong className="font-mono text-secondary">ISC-2020-RET</strong>.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <Button
              variant="secondary"
              size="md"
              leftIcon={<CheckCheck className="w-4 h-4 shrink-0 text-emerald-600" />}
              onClick={validateRoomConflicts}
            >
              Validar Conflicto de Aulas
            </Button>
            <Button
              variant="primary"
              size="md"
              leftIcon={<PlusCircle className="w-4 h-4 shrink-0" />}
              onClick={() => setIsCreateModalOpen(true)}
            >
              Crear Nuevo Grupo
            </Button>
          </div>
        </div>
      </div>

      {/* Bento Grid: 4 Métricas de Planificación */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Grupos Programados */}
        <Card className="p-4 border border-border shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-secondary-slate uppercase tracking-wider">
              Grupos Programados
            </span>
            <div className="p-1.5 bg-blue-50 text-primary rounded">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-secondary font-mono">{groups.length}</span>
              <span className="text-xs text-secondary-slate">secciones</span>
            </div>
            <div className="w-full bg-surface-canvas rounded-full h-1.5 overflow-hidden mt-2 border border-border-subtle">
              <div className="bg-primary h-full rounded-full" style={{ width: '92%' }}></div>
            </div>
          </div>
          <span className="text-[11px] text-secondary-slate">Plan ISC-2020-RET Activo</span>
        </Card>

        {/* KPI 2: Aulas Asignadas */}
        <Card className="p-4 border border-border shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-secondary-slate uppercase tracking-wider">
              Espacios & Aulas
            </span>
            <div className="p-1.5 bg-blue-50 text-primary rounded">
              <Building className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-primary font-mono">20</span>
              <span className="text-xs text-secondary-slate">espacios</span>
            </div>
            <div className="w-full bg-surface-canvas rounded-full h-1.5 overflow-hidden mt-2 border border-border-subtle">
              <div className="bg-emerald-600 h-full rounded-full" style={{ width: '100%' }}></div>
            </div>
          </div>
          <span className="text-[11px] text-emerald-700 font-semibold">16 aulas • 4 labs especializados</span>
        </Card>

        {/* KPI 3: Carga Ofertada */}
        <Card className="p-4 border border-border shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-secondary-slate uppercase tracking-wider">
              Carga Semanal Aula
            </span>
            <div className="p-1.5 bg-blue-50 text-primary rounded">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-secondary font-mono">384</span>
              <span className="text-xs text-secondary-slate">hrs / semana</span>
            </div>
            <div className="w-full bg-surface-canvas rounded-full h-1.5 overflow-hidden mt-2 border border-border-subtle">
              <div className="bg-secondary h-full rounded-full" style={{ width: '88%' }}></div>
            </div>
          </div>
          <span className="text-[11px] text-secondary-slate">Promedio 19.2 hrs por aula</span>
        </Card>

        {/* KPI 4: Colisiones Espaciales */}
        <Card className="p-4 border border-border shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-secondary-slate uppercase tracking-wider">
              Traslape Espacial
            </span>
            <div className="p-1.5 bg-emerald-50 text-emerald-700 rounded">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-emerald-700 font-mono">0</span>
              <span className="text-xs text-secondary-slate">colisiones</span>
            </div>
            <div className="w-full bg-surface-canvas rounded-full h-1.5 overflow-hidden mt-2 border border-border-subtle">
              <div className="bg-emerald-600 h-full rounded-full" style={{ width: '100%' }}></div>
            </div>
          </div>
          <span className="text-[11px] text-emerald-700 font-semibold">100% de horarios sin conflicto</span>
        </Card>
      </div>

      {/* Grilla: Tabla de Programación + Panel de Acción Rápida */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Tabla (3 Columnas) */}
        <div className="lg:col-span-3 space-y-4">
          <Card className="border border-border shadow-sm">
            {/* Barra de Filtros */}
            <div className="p-4 border-b border-border-subtle flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-bold text-secondary">
                  Catálogo de Secciones Curriculares ({filteredGroups.length} grupos)
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedSemestre}
                  onChange={(e) => setSelectedSemestre(e.target.value)}
                  className="text-xs bg-surface-canvas border border-border rounded px-2.5 py-1.5 text-secondary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="ALL">Todos los semestres</option>
                  <option value="5">5° Semestre</option>
                  <option value="6">6° Semestre</option>
                  <option value="7">7° Semestre</option>
                </select>

                <select
                  value={selectedTurno}
                  onChange={(e) => setSelectedTurno(e.target.value)}
                  className="text-xs bg-surface-canvas border border-border rounded px-2.5 py-1.5 text-secondary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="ALL">Todos los turnos</option>
                  <option value="MATUTINO">Matutino</option>
                  <option value="VESPERTINO">Vespertino</option>
                </select>

                <div className="relative flex items-center">
                  <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-secondary-slate pointer-events-none shrink-0" />
                  <input
                    type="text"
                    placeholder="Buscar materia o docente..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs bg-surface-canvas border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary w-52"
                  />
                </div>
              </div>
            </div>

            <Table
              columns={groupColumns}
              data={filteredGroups}
              rowKey={(g) => g.id}
            />
          </Card>
        </div>

        {/* Panel Lateral: Acciones Rápidas del Grupo Seleccionado (1 Columna) */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="border border-border shadow-sm p-5 space-y-4 sticky top-20">
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <span className="text-xs font-bold text-secondary-slate uppercase tracking-wider">
                Ficha de Grupo Seleccionado
              </span>
              <span className="font-mono font-bold text-xs text-primary px-2 py-0.5 bg-blue-50 border border-blue-200 rounded">
                {focusedGroup?.codigoGrupo}
              </span>
            </div>

            {focusedGroup ? (
              <div className="space-y-4 text-xs">
                <div>
                  <span className="text-secondary-slate block text-[11px]">Asignatura:</span>
                  <strong className="text-secondary text-sm block leading-tight">{focusedGroup.nombreMateria}</strong>
                  <span className="font-mono text-primary font-bold">{focusedGroup.claveMateria}</span>
                </div>

                <div className="p-3 bg-surface-canvas rounded border border-border-subtle space-y-2">
                  <div>
                    <span className="text-secondary-slate block text-[11px]">Docente Asignado:</span>
                    <strong className="text-secondary block">{focusedGroup.docenteTitular}</strong>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border-subtle">
                    <div>
                      <span className="text-secondary-slate block text-[10px]">Aula:</span>
                      <strong className="text-secondary">{focusedGroup.aula}</strong>
                    </div>
                    <div>
                      <span className="text-secondary-slate block text-[10px]">Horario:</span>
                      <strong className="text-secondary">{focusedGroup.horario}</strong>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-secondary-slate">Ocupación Actual:</span>
                    <strong className="font-mono text-secondary">
                      {focusedGroup.inscritos} de {focusedGroup.capacidadMaxima} ({Math.round((focusedGroup.inscritos / focusedGroup.capacidadMaxima) * 100)}%)
                    </strong>
                  </div>
                  <div className="w-full bg-surface-canvas rounded-full h-2 overflow-hidden border border-border-subtle">
                    <div
                      className={`h-full rounded-full ${
                        focusedGroup.inscritos >= focusedGroup.capacidadMaxima ? 'bg-amber-600' : 'bg-primary'
                      }`}
                      style={{ width: `${Math.min(100, (focusedGroup.inscritos / focusedGroup.capacidadMaxima) * 100)}%` }}
                    ></div>
                  </div>
                </div>

                <div className="pt-2 border-t border-border-subtle space-y-2">
                  <Button
                    variant="secondary"
                    size="md"
                    leftIcon={<Edit className="w-3.5 h-3.5 shrink-0" />}
                    className="w-full justify-center"
                    onClick={() => {
                      setTempCapacity(focusedGroup.capacidadMaxima)
                      setTempAula(focusedGroup.aula)
                      setIsEditCapacityModalOpen(true)
                    }}
                  >
                    Modificar Capacidad / Aula
                  </Button>
                  <Button
                    variant="ghost"
                    size="md"
                    leftIcon={<CheckCircle className="w-3.5 h-3.5 shrink-0 text-emerald-600" />}
                    className="w-full justify-center"
                    onClick={() =>
                      showToast(
                        'Horario Verificado',
                        `Sin traslape en ${focusedGroup.aula} para el grupo ${focusedGroup.codigoGrupo}.`,
                      )
                    }
                  >
                    Verificar Disponibilidad
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-secondary-slate text-center py-6">
                Selecciona un grupo en la tabla para ver y editar sus parámetros espaciales.
              </p>
            )}
          </Card>
        </div>
      </div>

      {/* Modal: Crear Nuevo Grupo */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Crear Nueva Sección de Grupo en Oferta Curricular"
      >
        <form onSubmit={handleCreateGroup} className="space-y-4">
          <Input
            label="Nombre de la Asignatura"
            placeholder="Ej. Ciberseguridad Ofensiva y Defensa Activa"
            value={newGroup.nombreMateria}
            onChange={(e) => setNewGroup({ ...newGroup, nombreMateria: e.target.value })}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Clave de Materia"
              placeholder="CS-605"
              value={newGroup.claveMateria}
              onChange={(e) => setNewGroup({ ...newGroup, claveMateria: e.target.value })}
              required
            />
            <Input
              label="Código de Grupo"
              placeholder="6CV3"
              value={newGroup.codigoGrupo}
              onChange={(e) => setNewGroup({ ...newGroup, codigoGrupo: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Semestre"
              value={newGroup.semestre.toString()}
              onChange={(e) => setNewGroup({ ...newGroup, semestre: Number(e.target.value) })}
              options={[
                { label: '5to Semestre', value: '5' },
                { label: '6to Semestre', value: '6' },
                { label: '7mo Semestre', value: '7' },
                { label: '8vo Semestre', value: '8' },
              ]}
            />
            <Select
              label="Turno"
              value={newGroup.turno}
              onChange={(e) =>
                setNewGroup({
                  ...newGroup,
                  turno: e.target.value as 'MATUTINO' | 'VESPERTINO',
                })
              }
              options={[
                { label: 'Matutino', value: 'MATUTINO' },
                { label: 'Vespertino', value: 'VESPERTINO' },
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Docente Titular"
              placeholder="Dr. Alejandro Méndez Rosas"
              value={newGroup.docenteTitular}
              onChange={(e) => setNewGroup({ ...newGroup, docenteTitular: e.target.value })}
              required
            />
            <Input
              label="Aula / Laboratorio Asignado"
              placeholder="Lab Redes 1"
              value={newGroup.aula}
              onChange={(e) => setNewGroup({ ...newGroup, aula: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Días de Impartición"
              placeholder="Lun, Mié"
              value={newGroup.dias}
              onChange={(e) => setNewGroup({ ...newGroup, dias: e.target.value })}
              required
            />
            <Input
              label="Horario"
              placeholder="07:00 - 09:00"
              value={newGroup.horario}
              onChange={(e) => setNewGroup({ ...newGroup, horario: e.target.value })}
              required
            />
          </div>

          <Input
            label="Capacidad Máxima de Alumnos"
            type="number"
            value={newGroup.capacidadMaxima.toString()}
            onChange={(e) => setNewGroup({ ...newGroup, capacidadMaxima: Number(e.target.value) })}
            required
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
            <Button variant="ghost" type="button" onClick={() => setIsCreateModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit">
              Registrar Sección
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Editar Capacidad / Aula */}
      <Modal
        isOpen={isEditCapacityModalOpen}
        onClose={() => setIsEditCapacityModalOpen(false)}
        title={`Reconfigurar Grupo ${focusedGroup?.codigoGrupo}`}
      >
        <form onSubmit={handleUpdateGroupParam} className="space-y-4">
          <p className="text-xs text-secondary-slate">
            Modifica los límites reglamentarios o reasigna el salón de clase. Se mantendrá la validación de cupos de laboratorio.
          </p>

          <Input
            label="Capacidad Máxima Autorizada"
            type="number"
            value={tempCapacity.toString()}
            onChange={(e) => setTempCapacity(Number(e.target.value))}
            required
          />

          <Input
            label="Reasignar Aula o Laboratorio"
            type="text"
            value={tempAula}
            onChange={(e) => setTempAula(e.target.value)}
            required
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
            <Button variant="ghost" type="button" onClick={() => setIsEditCapacityModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit">
              Guardar Reconfiguración
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
