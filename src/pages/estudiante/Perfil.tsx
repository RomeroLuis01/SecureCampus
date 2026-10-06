import React, { useState } from 'react'
import {
  User,
  Phone,
  MapPin,
  ShieldCheck,
  Edit2,
  Check,
  X,
  Camera,
  GraduationCap,
  HeartHandshake,
} from 'lucide-react'
import {
  Card,
  CardBody,
  Button,
  Badge,
  Input,
} from '../../components'
import { mockStudentProfile } from '../../services/mockData'

export const StudentProfileView: React.FC = () => {
  const [profile, setProfile] = useState(mockStudentProfile)
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    telefono: profile.telefono,
    direccion: profile.direccion,
    contactoNombre: profile.contactoEmergencia.nombre,
    contactoParentesco: profile.contactoEmergencia.parentesco,
    contactoTelefono: profile.contactoEmergencia.telefono,
  })
  const [savedSuccess, setSavedSuccess] = useState(false)

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setProfile({
      ...profile,
      telefono: formData.telefono,
      direccion: formData.direccion,
      contactoEmergencia: {
        nombre: formData.contactoNombre,
        parentesco: formData.contactoParentesco,
        telefono: formData.contactoTelefono,
      },
    })
    setIsEditing(false)
    setSavedSuccess(true)
    setTimeout(() => setSavedSuccess(false), 4000)
  }

  return (
    <div className="space-y-6">
      {/* Alerta de Éxito al Guardar */}
      {savedSuccess && (
        <div className="p-4 bg-academic-success-bg border border-academic-success-border rounded-lg text-academic-success-text text-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span className="font-semibold">
              Expediente actualizado exitosamente en el registro central escolar.
            </span>
          </div>
          <button onClick={() => setSavedSuccess(false)} className="text-academic-success-text hover:opacity-75">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 1. Encabezado Maestro del Expediente */}
      <Card variant="elevated" className="border-border shadow-layer-1 overflow-hidden">
        <div className="h-28 bg-gradient-to-r from-primary to-primary-hover relative p-6 flex items-end justify-between">
          <div className="text-white/90 text-xs font-semibold tracking-wider uppercase">
            Expediente Digital Único del Estudiante
          </div>
          <Badge variant="success" dot size="sm" className="bg-white/90 text-primary border-white">
            EXPEDIENTE ACTIVO & VERIFICADO
          </Badge>
        </div>

        <CardBody className="pt-0 px-6 pb-6 relative">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 -mt-12 mb-6">
            <div className="flex items-end gap-4">
              <div className="relative group">
                <div className="w-24 h-24 rounded-lg bg-surface-lowest border-4 border-white shadow-layer-2 flex items-center justify-center text-primary text-3xl font-bold overflow-hidden">
                  <div className="w-full h-full bg-primary-light flex items-center justify-center text-primary font-bold text-2xl">
                    {profile.nombre[0]}
                    {profile.apellidos[0]}
                  </div>
                </div>
                <button
                  className="absolute bottom-1 right-1 w-7 h-7 bg-primary text-white rounded flex items-center justify-center shadow-md hover:bg-primary-hover transition shrink-0"
                  title="Actualizar fotografía oficial"
                >
                  <Camera className="w-3.5 h-3.5 shrink-0" />
                </button>
              </div>

              <div>
                <h1 className="text-xl font-bold text-secondary tracking-tight">
                  {profile.nombre} {profile.apellidos}
                </h1>
                <p className="text-xs text-secondary-slate mt-0.5">
                  Matrícula: <span className="font-mono font-bold text-secondary">{profile.matricula}</span> • CURP: <span className="font-mono text-secondary">{profile.curp}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {!isEditing ? (
                <Button
                  variant="secondary"
                  size="md"
                  leftIcon={<Edit2 className="w-4 h-4 shrink-0" />}
                  onClick={() => setIsEditing(true)}
                >
                  Modificar Datos de Contacto
                </Button>
              ) : (
                <>
                  <Button variant="ghost" size="md" onClick={() => setIsEditing(false)}>
                    Cancelar
                  </Button>
                  <Button variant="primary" size="md" onClick={handleSave} leftIcon={<Check className="w-4 h-4 shrink-0" />}>
                    Guardar Cambios
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Sello de Autenticidad PKI */}
          <div className="p-3 bg-surface-canvas rounded border border-border flex items-center justify-between text-xs text-secondary-slate mb-6">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <span>
                Identidad verificada criptográficamente por la Dirección de Servicios Escolares.
              </span>
            </div>
            <span className="font-mono text-[11px] text-secondary-muted hidden sm:inline">
              Firma: SHA256:7f4a...91b2
            </span>
          </div>

          {/* Formulario / Detalle de Secciones */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Información Personal y de Contacto */}
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-secondary border-b border-border pb-2 flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />
                Datos Personales y Contacto
              </h2>

              {!isEditing ? (
                <div className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-secondary-slate block text-[11px]">Fecha de Nacimiento</span>
                      <strong className="text-secondary">{profile.fechaNacimiento}</strong>
                    </div>
                    <div>
                      <span className="text-secondary-slate block text-[11px]">Género</span>
                      <strong className="text-secondary">{profile.genero}</strong>
                    </div>
                  </div>

                  <div>
                    <span className="text-secondary-slate block text-[11px]">Correo Institucional</span>
                    <strong className="text-primary font-mono">{profile.email}</strong>
                  </div>

                  <div>
                    <span className="text-secondary-slate block text-[11px]">Teléfono Móvil</span>
                    <strong className="text-secondary font-mono">{profile.telefono}</strong>
                  </div>

                  <div>
                    <span className="text-secondary-slate block text-[11px]">Dirección Registrada</span>
                    <strong className="text-secondary">{profile.direccion}</strong>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <Input
                    label="Teléfono Móvil"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    leftIcon={<Phone className="w-4 h-4 text-secondary-muted" />}
                  />
                  <Input
                    label="Dirección Completa"
                    value={formData.direccion}
                    onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                    leftIcon={<MapPin className="w-4 h-4 text-secondary-muted" />}
                  />
                </div>
              )}
            </div>

            {/* Información Académica Oficial (Solo lectura institucional) */}
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-secondary border-b border-border pb-2 flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-primary" />
                Adscripción Curricular
              </h2>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-secondary-slate block text-[11px]">Programa Académico</span>
                  <strong className="text-secondary">{profile.carrera}</strong>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-secondary-slate block text-[11px]">Plan de Estudios</span>
                    <strong className="text-secondary font-mono">{profile.planEstudios}</strong>
                  </div>
                  <div>
                    <span className="text-secondary-slate block text-[11px]">Semestre Activo</span>
                    <strong className="text-secondary">{profile.semestre}</strong>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-secondary-slate block text-[11px]">Turno</span>
                    <strong className="text-secondary">{profile.turno}</strong>
                  </div>
                  <div>
                    <span className="text-secondary-slate block text-[11px]">Campus Asignado</span>
                    <strong className="text-secondary">{profile.campus}</strong>
                  </div>
                </div>

                <div className="pt-2 border-t border-border-subtle flex items-center justify-between">
                  <div>
                    <span className="text-secondary-slate block text-[11px]">Promedio General</span>
                    <span className="font-mono text-sm font-bold text-secondary tabular-nums">
                      {profile.promedioGeneral.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-secondary-slate block text-[11px]">Créditos Aprobados</span>
                    <span className="font-mono text-sm font-bold text-secondary tabular-nums">
                      {profile.creditosAcumulados} / {profile.creditosTotales}
                    </span>
                  </div>
                  <Badge variant="success" size="sm">
                    {profile.estado}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Contacto de Emergencia */}
          <div className="mt-8 pt-6 border-t border-border space-y-4">
            <h2 className="text-sm font-bold text-secondary flex items-center gap-2">
              <HeartHandshake className="w-4 h-4 text-academic-danger" />
              Contacto de Emergencia Institucional
            </h2>

            {!isEditing ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-surface-canvas rounded border border-border text-xs">
                <div>
                  <span className="text-secondary-slate block text-[11px]">Nombre de Contacto</span>
                  <strong className="text-secondary">{profile.contactoEmergencia.nombre}</strong>
                </div>
                <div>
                  <span className="text-secondary-slate block text-[11px]">Parentesco</span>
                  <strong className="text-secondary">{profile.contactoEmergencia.parentesco}</strong>
                </div>
                <div>
                  <span className="text-secondary-slate block text-[11px]">Teléfono de Emergencia</span>
                  <strong className="text-secondary font-mono">{profile.contactoEmergencia.telefono}</strong>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  label="Nombre de Contacto"
                  value={formData.contactoNombre}
                  onChange={(e) => setFormData({ ...formData, contactoNombre: e.target.value })}
                />
                <Input
                  label="Parentesco"
                  value={formData.contactoParentesco}
                  onChange={(e) => setFormData({ ...formData, contactoParentesco: e.target.value })}
                />
                <Input
                  label="Teléfono de Emergencia"
                  value={formData.contactoTelefono}
                  onChange={(e) => setFormData({ ...formData, contactoTelefono: e.target.value })}
                />
              </div>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
