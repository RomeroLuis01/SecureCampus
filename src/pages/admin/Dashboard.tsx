import React, { useState } from 'react'
import {
  Users,
  ShieldAlert,
  KeyRound,
  Search,
  Plus,
  Activity,
} from 'lucide-react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  Button,
  Badge,
  Input,
  Select,
  Modal,
  Table,
} from '../../components'
import type { Column } from '../../components'
import { mockAdminUsers, mockAuditLogs } from '../../services/mockData'
import type { SystemUser } from '../../services/mockData'
import { useAuth } from '../../context/AuthContext'

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth()
  const [users, setUsers] = useState<SystemUser[]>(mockAdminUsers)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRole, setSelectedRole] = useState('ALL')
  const [isNewUserModalOpen, setIsNewUserModalOpen] = useState(false)
  const [newUserForm, setNewUserForm] = useState({
    identificador: '',
    nombre: '',
    email: '',
    rol: 'Estudiante',
  })

  // Filtrado reactivo de usuarios
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.identificador.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesRole = selectedRole === 'ALL' || u.rol === selectedRole
    return matchesSearch && matchesRole
  })

  const handleToggleStatus = (userId: string) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          const nextStatus = u.estatus === 'ACTIVO' ? 'SUSPENDIDO' : 'ACTIVO'
          return { ...u, estatus: nextStatus }
        }
        return u
      })
    )
  }

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newUserForm.identificador || !newUserForm.nombre || !newUserForm.email) {
      alert('Por favor complete todos los campos requeridos.')
      return
    }

    const created: SystemUser = {
      id: `usr-${Date.now()}`,
      identificador: newUserForm.identificador,
      nombre: newUserForm.nombre,
      email: newUserForm.email,
      rol: newUserForm.rol as any,
      estatus: 'ACTIVO',
      mfaHabilitado: false,
      ultimoAcceso: 'Nunca',
    }

    setUsers([created, ...users])
    setIsNewUserModalOpen(false)
    setNewUserForm({ identificador: '', nombre: '', email: '', rol: 'Estudiante' })
  }

  // Columnas para la tabla de gestión de usuarios
  const columns: Column<SystemUser>[] = [
    {
      key: 'identificador',
      title: 'Identificador / ID',
      isNumeric: true,
      width: '130px',
      render: (u) => (
        <span className="font-mono text-xs font-semibold text-secondary bg-surface-canvas px-2 py-0.5 rounded border border-border-subtle">
          {u.identificador}
        </span>
      ),
    },
    {
      key: 'nombre',
      title: 'Usuario & Credencial',
      render: (u) => (
        <div>
          <span className="font-semibold text-secondary block">{u.nombre}</span>
          <span className="text-[11px] text-secondary-slate font-mono">{u.email}</span>
        </div>
      ),
    },
    {
      key: 'rol',
      title: 'Rol Asignado',
      width: '140px',
      render: (u) => {
        const roleVariants: Record<string, 'info' | 'warning' | 'success'> = {
          Estudiante: 'info',
          Profesor: 'success',
          Administrador: 'warning',
          'Jefe de Carrera': 'info',
        }
        return (
          <Badge variant={roleVariants[u.rol] || 'info'} size="sm">
            {u.rol}
          </Badge>
        )
      },
    },
    {
      key: 'mfaHabilitado',
      title: 'MFA',
      align: 'center',
      width: '90px',
      render: (u) => (
        <Badge variant={u.mfaHabilitado ? 'success' : 'inactive'} size="sm">
          {u.mfaHabilitado ? 'ACTIVO' : 'INACTIVO'}
        </Badge>
      ),
    },
    {
      key: 'estatus',
      title: 'Estatus',
      align: 'center',
      width: '120px',
      render: (u) => (
        <Badge
          variant={
            u.estatus === 'ACTIVO'
              ? 'success'
              : u.estatus === 'SUSPENDIDO'
              ? 'warning'
              : 'danger'
          }
          dot
          size="sm"
        >
          {u.estatus}
        </Badge>
      ),
    },
    {
      key: 'ultimoAcceso',
      title: 'Último Acceso',
      render: (u) => <span className="text-[11px] text-secondary-slate">{u.ultimoAcceso}</span>,
    },
    {
      key: 'acciones',
      title: 'Operación',
      align: 'right',
      width: '110px',
      render: (u) => (
        <Button
          variant={u.estatus === 'ACTIVO' ? 'secondary' : 'primary'}
          size="sm"
          onClick={() => handleToggleStatus(u.id)}
        >
          {u.estatus === 'ACTIVO' ? 'Suspender' : 'Reactivar'}
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* 1. Header con Resumen de Seguridad */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">
              Control de Seguridad & RBAC
            </span>
            <span className="text-secondary-muted">•</span>
            <Badge variant="info" size="sm">
              Sesión Activa: {user?.correo || 'admin@securecampus.edu'}
            </Badge>
            <Badge variant="inactive" size="sm">
              Métricas y Padrón: Demostrativo
            </Badge>
          </div>
          <h1 className="text-xl font-bold text-secondary tracking-tight">
            Portal del Administrador General{user?.nombreCompleto ? ` — ${user.nombreCompleto}` : ''}
          </h1>
          <p className="text-xs text-secondary-slate mt-0.5">
            Supervisión institucional, control de identidades y bitácora de integridad del sistema.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="md"
            leftIcon={<Plus className="w-4 h-4 shrink-0" />}
            onClick={() => setIsNewUserModalOpen(true)}
          >
            Dar de Alta Usuario
          </Button>
        </div>
      </div>

      {/* 2. Estadísticas Generales (KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardBody className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-secondary-slate">Usuarios Totales</p>
              <h3 className="text-2xl font-bold text-secondary mt-1 tabular-nums">1,420</h3>
              <p className="text-[11px] text-primary font-medium mt-1">1,150 Estudiantes activos</p>
            </div>
            <div className="w-10 h-10 rounded bg-blue-50 text-primary flex items-center justify-center border border-blue-100">
              <Users className="w-5 h-5" />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-secondary-slate">Incidentes de Seguridad</p>
              <h3 className="text-2xl font-bold text-academic-success mt-1 tabular-nums">0</h3>
              <p className="text-[11px] text-academic-success-text font-medium mt-1">
                Políticas de acceso conformes
              </p>
            </div>
            <div className="w-10 h-10 rounded bg-emerald-50 text-academic-success flex items-center justify-center border border-emerald-100">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-secondary-slate">Sesiones Concurrentes</p>
              <h3 className="text-2xl font-bold text-secondary mt-1 tabular-nums">342</h3>
              <p className="text-[11px] text-secondary-slate mt-1">Carga de servidor: 18%</p>
            </div>
            <div className="w-10 h-10 rounded bg-surface-canvas text-secondary-muted flex items-center justify-center border border-border">
              <Activity className="w-5 h-5" />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-secondary-slate">Cobertura MFA</p>
              <h3 className="text-2xl font-bold text-secondary mt-1 tabular-nums">94.2%</h3>
              <p className="text-[11px] text-academic-warning-text font-medium mt-1">
                83 usuarios pendientes
              </p>
            </div>
            <div className="w-10 h-10 rounded bg-amber-50 text-academic-warning flex items-center justify-center border border-amber-100">
              <KeyRound className="w-5 h-5" />
            </div>
          </CardBody>
        </Card>
      </div>

      {/* 3. Panel de Gestión de Usuarios */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-base font-semibold text-secondary">
            Gestión y Padrón de Usuarios Institucionales
          </h2>

          <div className="flex flex-wrap items-center gap-3">
            <div className="w-64">
              <Input
                placeholder="Buscar por nombre, correo o ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search className="w-4 h-4 text-secondary-muted" />}
              />
            </div>

            <div className="w-44">
              <Select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                options={[
                  { value: 'ALL', label: 'Todos los roles' },
                  { value: 'Estudiante', label: 'Estudiantes' },
                  { value: 'Profesor', label: 'Profesores' },
                  { value: 'Administrador', label: 'Administradores' },
                  { value: 'Jefe de Carrera', label: 'Jefes de Carrera' },
                ]}
              />
            </div>
          </div>
        </div>

        <Table
          columns={columns}
          data={filteredUsers}
          rowKey={(u) => u.id}
          emptyMessage="No se encontraron usuarios que coincidan con los criterios de búsqueda."
        />
      </div>

      {/* 4. Bitácora de Auditoría en Tiempo Real */}
      <Card>
        <CardHeader>
          <CardTitle>Bitácora de Auditoría de Seguridad Reciente</CardTitle>
          <CardDescription>
            Registro inmutable de eventos del sistema para cumplimiento normativo
          </CardDescription>
        </CardHeader>
        <CardBody className="p-0">
          <div className="divide-y divide-border-subtle">
            {mockAuditLogs.map((log) => (
              <div
                key={log.id}
                className="p-3.5 px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs hover:bg-surface-canvas transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                  <div>
                    <span className="font-semibold text-secondary">{log.accion}</span>
                    <p className="text-[11px] text-secondary-slate mt-0.5">
                      Actor: <strong className="text-secondary">{log.usuario}</strong> • IP: {log.ip}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-right shrink-0">
                  <span className="font-mono text-[11px] text-secondary-muted">
                    {log.timestamp}
                  </span>
                  <Badge
                    variant={log.nivel === 'WARNING' ? 'warning' : 'info'}
                    size="sm"
                  >
                    {log.nivel}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Modal de Alta de Usuario */}
      <Modal
        isOpen={isNewUserModalOpen}
        onClose={() => setIsNewUserModalOpen(false)}
        title="Dar de Alta Nuevo Usuario Institucional"
        description="El usuario recibirá un correo con una clave provisional y requerimiento de activación de MFA."
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsNewUserModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleCreateUser}>
              Registrar Usuario
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <Input
            label="Identificador Único (Matrícula o Nómina)"
            placeholder="ej. 20260481 o DOC-9921"
            value={newUserForm.identificador}
            onChange={(e) => setNewUserForm({ ...newUserForm, identificador: e.target.value })}
            required
          />

          <Input
            label="Nombre Completo"
            placeholder="Nombre y Apellidos"
            value={newUserForm.nombre}
            onChange={(e) => setNewUserForm({ ...newUserForm, nombre: e.target.value })}
            required
          />

          <Input
            label="Correo Institucional"
            type="email"
            placeholder="nombre.apellido@securecampus.edu"
            value={newUserForm.email}
            onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
            required
          />

          <Select
            label="Rol Institucional"
            value={newUserForm.rol}
            onChange={(e) => setNewUserForm({ ...newUserForm, rol: e.target.value })}
            options={[
              { value: 'Estudiante', label: 'Estudiante' },
              { value: 'Profesor', label: 'Profesor' },
              { value: 'Administrador', label: 'Administrador' },
              { value: 'Jefe de Carrera', label: 'Jefe de Carrera' },
            ]}
          />
        </form>
      </Modal>
    </div>
  )
}
