import React, { useState } from 'react'
import {
  Award,
  ShieldCheck,
  Building,
  Mail,
  Phone,
  Calendar,
  FileText,
  Download,
  Edit,
  CheckCircle,
  Briefcase,
  Layers,
} from 'lucide-react'
import { Card, Button, Badge, Modal, Input } from '../../components'
import { mockJefeCareerProfile } from '../../services/mockData'

export const JefeProfileView: React.FC = () => {
  const [profile, setProfile] = useState(mockJefeCareerProfile)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editPhone, setEditPhone] = useState(profile.telefono)
  const [editExtension, setEditExtension] = useState(profile.extension)
  const [editEmail, setEditEmail] = useState(profile.email)
  const [editOficina, setEditOficina] = useState(profile.oficina)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  const handleSaveContact = (e: React.FormEvent) => {
    e.preventDefault()
    setProfile((prev) => ({
      ...prev,
      telefono: editPhone,
      extension: editExtension,
      email: editEmail,
      oficina: editOficina,
    }))
    setIsModalOpen(false)
    showToast('Datos de contacto y despacho de jefatura actualizados correctamente.')
  }

  return (
    <div className="space-y-6">
      {/* Toast Notifier */}
      {toastMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-lg flex items-center gap-2 shadow-sm animate-fade-in text-sm">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Breadcrumb & Overline */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <nav className="flex items-center gap-2 text-xs text-secondary-slate">
          <span>Portal Jefatura</span>
          <span>/</span>
          <span>Expediente y Nombramiento</span>
          <span>/</span>
          <span className="text-primary font-semibold">Ficha Institucional de Jefatura</span>
        </nav>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-lowest border border-border text-secondary-slate font-mono text-[11px] shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
          AUDIT_STAMP: 2026-09-21T03:32:10Z
        </span>
      </div>

      {/* Encabezado Principal de la Ficha */}
      <div className="relative bg-surface-lowest p-6 rounded-lg border border-border shadow-sm overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded bg-primary text-white font-mono text-xs uppercase font-bold">
                ÁMBITO VIGENTE: {profile.cct}
              </span>
              <span className="px-2.5 py-0.5 rounded bg-blue-50 text-primary border border-blue-200 text-xs font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                OIDC FEDERADO
              </span>
              <span className="px-2 py-0.5 rounded bg-surface-canvas text-secondary-slate border border-border-subtle font-mono text-xs">
                {profile.clavePrograma}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-secondary tracking-tight">
              Ficha Institucional de Jefatura de Carrera
            </h1>
            <p className="text-xs text-secondary-slate max-w-3xl leading-relaxed">
              Cédula de facultades estatutarias, vinculación federada de identidad y parametrización de control escolar para la gestión académica del ciclo {profile.periodoActivo}.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Button
              variant="secondary"
              size="md"
              leftIcon={<Edit className="w-4 h-4 shrink-0" />}
              onClick={() => setIsModalOpen(true)}
            >
              Actualizar Contacto
            </Button>
            <Button
              variant="primary"
              size="md"
              leftIcon={<Download className="w-4 h-4 shrink-0" />}
              onClick={() => alert('Generando Acta Oficial de Nombramiento Trienal con firma criptográfica (PDF)...')}
            >
              Descargar Acta de Nombramiento (PDF)
            </Button>
          </div>
        </div>
      </div>

      {/* 4 Bento Cards de Métricas de la Carrera */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <Card className="p-4 border border-border shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-secondary-slate uppercase tracking-wider">
              Matrícula Activa en Carrera
            </span>
            <div className="p-1.5 bg-blue-50 text-primary rounded">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-primary font-mono">{profile.matriculaTotal}</span>
              <span className="text-xs text-secondary-slate">alumnos</span>
            </div>
            <div className="w-full bg-surface-canvas rounded-full h-1.5 overflow-hidden mt-2 border border-border-subtle">
              <div className="bg-primary h-full rounded-full" style={{ width: '88%' }}></div>
            </div>
          </div>
          <span className="text-[11px] text-emerald-700 font-semibold">
            En {profile.gruposTotales} grupos activos regulares
          </span>
        </Card>

        {/* KPI 2 */}
        <Card className="p-4 border border-border shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-secondary-slate uppercase tracking-wider">
              Planta Docente Adscrita
            </span>
            <div className="p-1.5 bg-blue-50 text-secondary rounded">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-secondary font-mono">{profile.docentesAdscritos}</span>
              <span className="text-xs text-secondary-slate">profesores</span>
            </div>
            <div className="w-full bg-surface-canvas rounded-full h-1.5 overflow-hidden mt-2 border border-border-subtle">
              <div className="bg-secondary h-full rounded-full" style={{ width: '75%' }}></div>
            </div>
          </div>
          <span className="text-[11px] text-secondary-slate">
            19 Tiempo Completo • 5 Asignatura
          </span>
        </Card>

        {/* KPI 3 */}
        <Card className="p-4 border border-border shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-secondary-slate uppercase tracking-wider">
              Eficiencia Terminal Ciclo
            </span>
            <div className="p-1.5 bg-emerald-50 text-emerald-700 rounded">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-emerald-700 font-mono">{profile.eficienciaTerminal}%</span>
            </div>
            <div className="w-full bg-surface-canvas rounded-full h-1.5 overflow-hidden mt-2 border border-border-subtle">
              <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${profile.eficienciaTerminal}%` }}></div>
            </div>
          </div>
          <span className="text-[11px] text-emerald-700 font-semibold">
            +2.3% respecto al ciclo anterior
          </span>
        </Card>

        {/* KPI 4 */}
        <Card className="p-4 border border-border shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-secondary-slate uppercase tracking-wider">
              Sobrecupos Emitidos
            </span>
            <div className="p-1.5 bg-amber-50 text-amber-700 rounded">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-secondary font-mono">{profile.sobrecuposUtilizados}</span>
              <span className="text-xs text-secondary-slate">/ {profile.sobrecuposMaximos} máx</span>
            </div>
            <div className="w-full bg-surface-canvas rounded-full h-1.5 overflow-hidden mt-2 border border-border-subtle">
              <div className="bg-amber-500 h-full rounded-full" style={{ width: '68%' }}></div>
            </div>
          </div>
          <span className="text-[11px] text-emerald-700 font-semibold">8 folios disponibles reglamentarios</span>
        </Card>
      </div>

      {/* Bento Grid: 2 Columnas Detalle */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna Izquierda: Nombramiento & Contacto (1 Columna) */}
        <div className="space-y-6 lg:col-span-1">
          <Card className="border border-border shadow-sm p-6 space-y-4">
            <div className="text-center space-y-3 pb-4 border-b border-border-subtle">
              <div className="w-20 h-20 rounded-xl bg-primary/10 border-2 border-primary/20 flex items-center justify-center text-primary font-bold text-2xl mx-auto shadow-inner">
                AM
              </div>
              <div>
                <h3 className="text-base font-bold text-secondary">{profile.titularNombre}</h3>
                <p className="text-xs text-secondary-slate">{profile.titularGrado}</p>
                <Badge variant="info" className="mt-2 text-[10px] font-semibold">
                  Nombramiento Institucional Vigente
                </Badge>
              </div>
            </div>


            <div className="space-y-3 text-xs">
              <div className="p-3 bg-surface-canvas rounded border border-border-subtle space-y-1">
                <span className="text-[10px] font-bold text-secondary-slate uppercase block">Tipo de Nombramiento</span>
                <strong className="text-secondary block">{profile.nombramiento}</strong>
                <span className="text-[11px] text-secondary-slate block font-mono">
                  {profile.vigenciaNombramiento}
                </span>
              </div>

              <div className="flex items-center gap-2.5 text-secondary-slate">
                <Mail className="w-4 h-4 text-primary shrink-0" />
                <span className="truncate">{profile.email}</span>
              </div>
              <div className="flex items-center gap-2.5 text-secondary-slate">
                <Phone className="w-4 h-4 text-primary shrink-0" />
                <span>{profile.telefono} ext. {profile.extension}</span>
              </div>
              <div className="flex items-center gap-2.5 text-secondary-slate">
                <Building className="w-4 h-4 text-primary shrink-0" />
                <span>{profile.oficina}</span>
              </div>
              <div className="flex items-center gap-2.5 text-secondary-slate">
                <Calendar className="w-4 h-4 text-primary shrink-0" />
                <span>Fecha de Toma de Protesta: {profile.fechaNombramiento}</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Columna Derecha: Facultades Estatutarias & Plan de Estudios (2 Columnas) */}
        <div className="space-y-6 lg:col-span-2">
          {/* Facultades Estatutarias */}
          <Card className="border border-border shadow-sm">
            <div className="p-5 border-b border-border-subtle flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold text-secondary">Facultades Estatutarias y Atribuciones RBAC</h3>
              </div>
              <Badge variant="success" className="text-[11px]">
                5 Facultades Autorizadas
              </Badge>
            </div>
            <div className="p-5 divide-y divide-border-subtle text-xs">
              {profile.facultadesEstatutarias.map((facultad, idx) => (
                <div key={idx} className="py-3 flex items-start gap-3 first:pt-0 last:pb-0">
                  <span className="font-mono text-primary font-bold bg-primary/10 px-2 py-0.5 rounded text-[11px] shrink-0 mt-0.5">
                    ART-{idx + 1}
                  </span>
                  <span className="text-secondary leading-relaxed font-medium">{facultad}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Parametrización del Plan de Estudios */}
          <Card className="border border-border shadow-sm p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold text-secondary">Parámetros del Plan Educativo y Control Escolar</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-surface-canvas rounded border border-border-subtle">
                <span className="text-secondary-slate block text-[11px]">Plan Oficial de Carrera</span>
                <strong className="text-secondary text-sm font-mono">ISC-2020-RET</strong>
              </div>
              <div className="p-3 bg-surface-canvas rounded border border-border-subtle">
                <span className="text-secondary-slate block text-[11px]">Créditos Totales del Plan</span>
                <strong className="text-primary text-sm font-mono">260 Créditos SATCA</strong>
              </div>
              <div className="p-3 bg-surface-canvas rounded border border-border-subtle">
                <span className="text-secondary-slate block text-[11px]">Duración Promedio</span>
                <strong className="text-secondary text-sm">8 Semestres Regulares</strong>
              </div>
              <div className="p-3 bg-surface-canvas rounded border border-border-subtle">
                <span className="text-secondary-slate block text-[11px]">Cupo Estándar por Sección</span>
                <strong className="text-secondary text-sm font-mono">30 Alumnos / Grupo</strong>
              </div>
              <div className="p-3 bg-surface-canvas rounded border border-border-subtle">
                <span className="text-secondary-slate block text-[11px]">Sobrecupo Máx. por Aula</span>
                <strong className="text-secondary text-sm font-mono">3 Alumnos Autorizados</strong>
              </div>
              <div className="p-3 bg-surface-canvas rounded border border-border-subtle">
                <span className="text-secondary-slate block text-[11px]">Periodo de Evaluaciones</span>
                <strong className="text-emerald-700 text-sm font-semibold">Parciales Ordinarios</strong>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Modal: Actualizar Datos de Contacto */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Actualizar Datos de Despacho de Jefatura"
      >
        <form onSubmit={handleSaveContact} className="space-y-4">
          <p className="text-xs text-secondary-slate">
            Actualiza los datos oficiales de contacto de la oficina de Jefatura en el directorio escolar.
          </p>

          <Input
            label="Correo Electrónico Institucional"
            type="email"
            value={editEmail}
            onChange={(e) => setEditEmail(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Teléfono Directo"
              type="text"
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
              required
            />
            <Input
              label="Extensión Telefónica"
              type="text"
              value={editExtension}
              onChange={(e) => setEditExtension(e.target.value)}
              required
            />
          </div>

          <Input
            label="Ubicación de Despacho / Oficina"
            type="text"
            value={editOficina}
            onChange={(e) => setEditOficina(e.target.value)}
            required
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
            <Button variant="ghost" type="button" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit">
              Guardar Modificaciones
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
