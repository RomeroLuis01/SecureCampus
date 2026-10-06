import React, { useState } from 'react'
import {
  ShieldCheck,
  Award,
  BookOpen,
  Clock,
  Mail,
  Phone,
  MapPin,
  FileCheck,
  Edit,
  Download,
  Building,
  CheckCircle,
  Hash,
  Briefcase,
} from 'lucide-react'
import { Card, Button, Badge, Modal, Input } from '../../components'
import { mockTeacherProfile, mockTeacherGroups } from '../../services/mockData'

export const TeacherProfileView: React.FC = () => {
  const [profile, setProfile] = useState(mockTeacherProfile)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editPhone, setEditPhone] = useState(profile.telefono)
  const [editEmail, setEditEmail] = useState(profile.email)
  const [editCubiculo, setEditCubiculo] = useState(profile.cubículo)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const handleSaveContact = (e: React.FormEvent) => {
    e.preventDefault()
    setProfile((prev) => ({
      ...prev,
      telefono: editPhone,
      email: editEmail,
      cubículo: editCubiculo,
    }))
    setIsEditModalOpen(false)
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 3500)
  }

  return (
    <div className="space-y-6">
      {/* Toast de confirmación */}
      {saveSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-lg flex items-center gap-2 shadow-sm animate-fade-in text-sm">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>Datos de contacto del docente actualizados correctamente en el catálogo institucional.</span>
        </div>
      )}

      {/* Header Institucional de Ficha Curricular */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-surface-lowest p-6 rounded-lg border border-border shadow-sm">
        <div className="space-y-1">
          <nav className="flex items-center gap-1.5 text-xs text-secondary-slate">
            <span>Portal Docente</span>
            <span>/</span>
            <span>Expediente y Perfil</span>
            <span>/</span>
            <span className="text-primary font-semibold">Ficha Curricular y Adscripción</span>
          </nav>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <h1 className="text-2xl font-bold text-secondary tracking-tight">Expediente y Perfil Docente Oficial</h1>
            <Badge variant="success" className="px-2 py-0.5 text-[11px] font-semibold">
              ACTIVO • EN NÓMINA
            </Badge>
            <Badge variant="inactive" className="px-2 py-0.5 text-[11px] font-mono">
              OIDC FEDERADO
            </Badge>
          </div>
          <p className="text-sm text-secondary-slate max-w-3xl">
            Información institucional, identidad OIDC federada, adscripción académica y habilitación docente registrada en el sistema escolar centralizado.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            variant="secondary"
            size="md"
            leftIcon={<Edit className="w-4 h-4 shrink-0" />}
            onClick={() => setIsEditModalOpen(true)}
          >
            Actualizar Contacto
          </Button>
          <Button
            variant="primary"
            size="md"
            leftIcon={<Download className="w-4 h-4 shrink-0" />}
            onClick={() => alert('Generando Cédula Curricular Docente Oficial firmada digitalmente (PDF)...')}
          >
            Descargar Ficha Curricular (PDF)
          </Button>
        </div>
      </div>

      {/* Bento Grid Principal: 2 Columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna Izquierda: Tarjeta de Identidad y Resumen */}
        <div className="space-y-6 lg:col-span-1">
          <Card className="border border-border shadow-sm">
            <div className="p-6 text-center space-y-4">
              <div className="relative inline-block">
                <div className="w-24 h-24 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center text-primary font-bold text-3xl mx-auto shadow-inner">
                  AM
                </div>
                <span className="absolute bottom-0 right-0 bg-emerald-600 text-white w-7 h-7 flex items-center justify-center rounded-full border-2 border-white shadow-sm" title="Verificado DGP">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                </span>
              </div>
              <div>
                <h2 className="text-lg font-bold text-secondary">{profile.nombre} {profile.apellidos}</h2>
                <p className="text-xs text-secondary-slate font-medium">{profile.categoria}</p>
                <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-surface-canvas rounded text-xs font-mono font-semibold text-primary border border-border-subtle leading-none">
                  <Hash className="w-3.5 h-3.5 shrink-0" />
                  Nómina: {profile.nomina}
                </div>
              </div>

              <div className="pt-4 border-t border-border-subtle text-left space-y-3 text-xs">
                <div className="flex items-center gap-2.5 text-secondary-slate">
                  <Mail className="w-4 h-4 text-primary shrink-0" />
                  <span className="truncate">{profile.email}</span>
                </div>
                <div className="flex items-center gap-2.5 text-secondary-slate">
                  <Phone className="w-4 h-4 text-primary shrink-0" />
                  <span>{profile.telefono}</span>
                </div>
                <div className="flex items-center gap-2.5 text-secondary-slate">
                  <MapPin className="w-4 h-4 text-primary shrink-0" />
                  <span>{profile.cubículo}</span>
                </div>
                <div className="flex items-center gap-2.5 text-secondary-slate">
                  <Building className="w-4 h-4 text-primary shrink-0" />
                  <span>{profile.departamento}</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Distribución de Horas */}
          <Card className="border border-border shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-secondary-slate uppercase tracking-wider">Carga Horaria Semanal</span>
              <span className="text-xs font-mono font-bold text-primary px-2 py-0.5 bg-blue-50 border border-blue-200 rounded">
                20 hrs / sem
              </span>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-secondary-slate">Docencia Frente a Grupo</span>
                  <span className="font-semibold text-secondary">16 hrs (80%)</span>
                </div>
                <div className="w-full bg-surface-canvas rounded-full h-2 overflow-hidden border border-border-subtle">
                  <div className="bg-primary h-full rounded-full" style={{ width: '80%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-secondary-slate">Tutorías y Asesorías</span>
                  <span className="font-semibold text-secondary">2 hrs (10%)</span>
                </div>
                <div className="w-full bg-surface-canvas rounded-full h-2 overflow-hidden border border-border-subtle">
                  <div className="bg-secondary h-full rounded-full" style={{ width: '10%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-secondary-slate">Investigación y Desarrollo</span>
                  <span className="font-semibold text-secondary">2 hrs (10%)</span>
                </div>
                <div className="w-full bg-surface-canvas rounded-full h-2 overflow-hidden border border-border-subtle">
                  <div className="bg-emerald-600 h-full rounded-full" style={{ width: '10%' }}></div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Columna Derecha: Ficha Detallada, Asignaciones y Habilitación */}
        <div className="space-y-6 lg:col-span-2">
          {/* Cédula y Nombramiento Institucional */}
          <Card className="border border-border shadow-sm">
            <div className="p-5 border-b border-border-subtle flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold text-secondary">Cédula y Nombramiento Institucional</h3>
              </div>
              <Badge variant="success" className="text-[11px]">
                Validado ante DGP
              </Badge>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-surface-canvas rounded border border-border-subtle">
                <span className="text-secondary-slate block font-medium">Cédula Profesional DGP</span>
                <span className="text-secondary font-mono font-bold text-sm">4892104-DGP (Lic. y Posgrado)</span>
              </div>
              <div className="p-3 bg-surface-canvas rounded border border-border-subtle">
                <span className="text-secondary-slate block font-medium">RFC con Homoclave</span>
                <span className="text-secondary font-mono font-bold text-sm">MERA720914HY2</span>
              </div>
              <div className="p-3 bg-surface-canvas rounded border border-border-subtle">
                <span className="text-secondary-slate block font-medium">CURP Oficial</span>
                <span className="text-secondary font-mono font-bold text-sm">MERA720914HDFRN09</span>
              </div>
              <div className="p-3 bg-surface-canvas rounded border border-border-subtle">
                <span className="text-secondary-slate block font-medium">Grado Académico Máximo</span>
                <span className="text-secondary font-bold text-sm">Doctorado en Ciencias Computacionales</span>
              </div>
              <div className="p-3 bg-surface-canvas rounded border border-border-subtle sm:col-span-2">
                <span className="text-secondary-slate block font-medium">Institución Otorgante de Grado</span>
                <span className="text-secondary font-semibold text-sm">Centro de Investigación y de Estudios Avanzados del IPN (CINVESTAV)</span>
              </div>
            </div>
          </Card>

          {/* Cátedras Asignadas en Periodo 2026-B */}
          <Card className="border border-border shadow-sm">
            <div className="p-5 border-b border-border-subtle flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold text-secondary">Cátedras Asignadas en el Periodo Activo</h3>
              </div>
              <span className="text-xs font-mono font-medium text-secondary-slate">3 Grupos Oficiales</span>
            </div>
            <div className="divide-y divide-border-subtle text-xs">
              {mockTeacherGroups.map((grp) => (
                <div key={grp.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-canvas/50 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded text-[11px]">
                        {grp.clave}
                      </span>
                      <span className="font-bold text-secondary text-sm">{grp.materia}</span>
                    </div>
                    <div className="flex items-center gap-4 text-secondary-slate">
                      <span>Grupo: <strong className="text-secondary">{grp.grupo}</strong></span>
                      <span>Aula: <strong className="text-secondary">{grp.aula}</strong></span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {grp.horario}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className="block text-secondary font-bold">{grp.alumnosInscritos} / {grp.cupoMaximo}</span>
                      <span className="text-[10px] text-secondary-slate">Alumnos inscritos</span>
                    </div>
                    <Badge variant={grp.estatusActa === 'CERRADA_FIRMADA' ? 'inactive' : 'warning'} className="text-[10px]">
                      {grp.estatusActa === 'CERRADA_FIRMADA' ? 'Acta Firmada' : 'En Captura'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>


          {/* Habilitación Académica y Certificaciones */}
          <Card className="border border-border shadow-sm p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold text-secondary">Certificaciones Profesionales y Colegiaturas</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-surface-canvas rounded border border-border-subtle flex items-start gap-2.5">
                <FileCheck className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <span className="font-bold text-secondary block">Certified Information Systems Security Professional (CISSP)</span>
                  <span className="text-[11px] text-secondary-slate">ID: ISC2-98412 • Vigente hasta 2027</span>
                </div>
              </div>
              <div className="p-3 bg-surface-canvas rounded border border-border-subtle flex items-start gap-2.5">
                <FileCheck className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <span className="font-bold text-secondary block">Certified Ethical Hacker (CEH v12 Master)</span>
                  <span className="text-[11px] text-secondary-slate">EC-Council • ID: ECC-33921</span>
                </div>
              </div>
              <div className="p-3 bg-surface-canvas rounded border border-border-subtle flex items-start gap-2.5 sm:col-span-2">
                <Award className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <span className="font-bold text-secondary block">Miembro del Sistema Nacional de Investigadoras e Investigadores (SNII)</span>
                  <span className="text-[11px] text-secondary-slate">Nivel I • Área VII: Ciencias de la Computación e Ingeniería de Ciberseguridad</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Modal de Actualización de Contacto */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Actualizar Datos de Contacto Docente"
      >
        <form onSubmit={handleSaveContact} className="space-y-4">
          <p className="text-xs text-secondary-slate">
            Modifica la información de contacto registrada en el directorio de la escuela. Los cambios se sincronizarán con tu expediente institucional.
          </p>
          <Input
            label="Correo Electrónico Institucional"
            type="email"
            value={editEmail}
            onChange={(e) => setEditEmail(e.target.value)}
            required
          />
          <Input
            label="Teléfono / Extensión de Oficina"
            type="text"
            value={editPhone}
            onChange={(e) => setEditPhone(e.target.value)}
            required
          />
          <Input
            label="Cubículo / Despacho Académico"
            type="text"
            value={editCubiculo}
            onChange={(e) => setEditCubiculo(e.target.value)}
            required
          />
          <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
            <Button variant="ghost" type="button" onClick={() => setIsEditModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit">
              Guardar Cambios
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
