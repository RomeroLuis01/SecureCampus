import React, { useState } from 'react'
import {
  Save,
  Lock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Download,
} from 'lucide-react'
import {
  Card,
  CardBody,
  Button,
  Badge,
  Select,
  Modal,
  Input,
} from '../../components'
import { mockTeacherGroups } from '../../services/mockData'
import { useAuth } from '../../context/AuthContext'

export const TeacherGradesView: React.FC = () => {
  const { user } = useAuth()
  const [selectedGroupIndex, setSelectedGroupIndex] = useState(0)
  const [groupsData, setGroupsData] = useState(mockTeacherGroups)
  const [isSignModalOpen, setIsSignModalOpen] = useState(false)
  const [signaturePassword, setSignaturePassword] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'info'; text: string } | null>(null)

  const currentGroup = groupsData[selectedGroupIndex]
  const numParciales = currentGroup.numeroParciales || 3
  const partialNumbers = Array.from({ length: numParciales }, (_, i) => i + 1)

  // Actualizar calificación de un estudiante por parcial
  const handleGradeChange = (studentId: string, partialNum: number, valStr: string) => {
    const trimmed = valStr.trim()
    const val = trimmed === '' ? null : Math.min(100, Math.max(0, parseFloat(trimmed)))

    setGroupsData((prev) => {
      const next = [...prev]
      const grp = { ...next[selectedGroupIndex] }
      const groupNumParciales = grp.numeroParciales || 3

      grp.estudiantes = grp.estudiantes.map((s) => {
        if (s.id === studentId) {
          const updatedParciales: Record<number, number | null> = {
            ...(s.parciales || {}),
            ...(s.parcial1 !== undefined ? { 1: s.parcial1 } : {}),
            ...(s.parcial2 !== undefined ? { 2: s.parcial2 } : {}),
            ...(s.parcial3 !== undefined ? { 3: s.parcial3 } : {}),
            ...(s.parcial4 !== undefined ? { 4: s.parcial4 } : {}),
            [partialNum]: val,
          }

          // Verificar si todos los parciales configurados han sido capturados
          let allCaptured = true
          let sum = 0
          for (let i = 1; i <= groupNumParciales; i++) {
            const score = updatedParciales[i]
            if (score === null || score === undefined || isNaN(score)) {
              allCaptured = false
              break
            }
            sum += score
          }

          let finalScore: number | null = null
          let estado: 'APROBADO' | 'REPROBADO' | 'PENDIENTE' = 'PENDIENTE'

          if (allCaptured) {
            // Media aritmética simple con redondeo estándar half-up a entero institucional
            const mean = sum / groupNumParciales
            finalScore = Math.round(mean)
            estado = finalScore >= 70 ? 'APROBADO' : 'REPROBADO'
          }

          return {
            ...s,
            parciales: updatedParciales,
            parcial1: updatedParciales[1] ?? null,
            parcial2: updatedParciales[2] ?? null,
            parcial3: updatedParciales[3] ?? null,
            parcial4: updatedParciales[4] ?? null,
            final: finalScore,
            estado,
          }
        }
        return s
      })
      next[selectedGroupIndex] = grp
      return next
    })
  }

  const handleSaveDraft = () => {
    setIsSaving(true)
    setTimeout(() => {
      setIsSaving(false)
      setFeedbackMessage({
        type: 'info',
        text: 'Borrador de calificaciones parciales guardado temporalmente en el servidor.',
      })
      setTimeout(() => setFeedbackMessage(null), 3500)
    }, 600)
  }

  const handleConfirmSignAct = (e: React.FormEvent) => {
    e.preventDefault()
    if (!signaturePassword) {
      alert('Debe ingresar su contraseña institucional para validar la firma.')
      return
    }

    setGroupsData((prev) => {
      const next = [...prev]
      next[selectedGroupIndex] = {
        ...next[selectedGroupIndex],
        estatusActa: 'CERRADA_FIRMADA',
      }
      return next
    })

    setIsSignModalOpen(false)
    setSignaturePassword('')
    setFeedbackMessage({
      type: 'success',
      text: `Acta del Grupo ${currentGroup.grupo} cerrada y firmada digitalmente con éxito. Hash PKI generado.`,
    })
  }

  const isClosed = currentGroup.estatusActa === 'CERRADA_FIRMADA'

  return (
    <div className="space-y-6 font-sans">
      {/* Mensajes de Feedback */}
      {feedbackMessage && (
        <div
          className={`p-4 rounded-lg border text-xs flex items-center justify-between ${
            feedbackMessage.type === 'success'
              ? 'bg-academic-success-bg border-academic-success-border text-academic-success-text'
              : 'bg-blue-50 border-blue-200 text-primary'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span className="font-semibold">{feedbackMessage.text}</span>
          </div>
          <button onClick={() => setFeedbackMessage(null)} className="font-bold">
            ✕
          </button>
        </div>
      )}

      {/* 1. Header con Selector de Grupo y Estado del Acta */}
      <div className="bg-surface-lowest border border-border rounded-lg p-5 shadow-layer-1 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">
              Módulo de Evaluación Docente
            </span>
            <span className="text-secondary-muted">•</span>
            <Badge
              variant={isClosed ? 'success' : 'warning'}
              size="sm"
              dot
            >
              {isClosed ? 'ACTA OFICIAL CERRADA & FIRMADA' : 'ACTA EN PERIODO DE CAPTURA'}
            </Badge>
          </div>
          <h1 className="text-xl font-bold text-secondary tracking-tight">
            Captura de Calificaciones Oficiales
          </h1>
          <p className="text-xs text-secondary-slate mt-0.5">
            {currentGroup.materia} • Grupo {currentGroup.grupo} • Aula {currentGroup.aula} •{' '}
            <span className="font-bold text-primary font-mono">{numParciales} Parciales</span> configurados
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="w-64">
            <Select
              value={selectedGroupIndex}
              onChange={(e) => setSelectedGroupIndex(Number(e.target.value))}
              options={groupsData.map((g, idx) => ({
                value: idx,
                label: `${g.clave} - Grupo ${g.grupo} (${g.numeroParciales}P - ${g.estatusActa})`,
              }))}
            />
          </div>

          <div className="flex items-center gap-2">
            {!isClosed ? (
              <>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={handleSaveDraft}
                  isLoading={isSaving}
                  leftIcon={<Save className="w-4 h-4" />}
                >
                  Guardar Borrador
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  leftIcon={<Lock className="w-4 h-4" />}
                  onClick={() => setIsSignModalOpen(true)}
                >
                  Firmar y Cerrar Acta
                </Button>
              </>
            ) : (
              <Button
                variant="secondary"
                size="md"
                leftIcon={<Download className="w-4 h-4" />}
                onClick={() => alert('Descargando Acta Oficial Firmada con Sello PKI en PDF.')}
              >
                Descargar Acta Firmada
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Matriz de Captura Interactiva con Parciales Dinámicos */}
      <Card>
        <CardBody className="p-0 overflow-x-auto">
          <table className="w-full border-collapse text-left font-sans">
            <thead>
              <tr className="bg-surface-canvas border-b border-border text-[11px] font-bold uppercase tracking-wider text-secondary-slate">
                <th className="py-3 px-4">Matrícula</th>
                <th className="py-3 px-4">Estudiante</th>
                <th className="py-3 px-4 text-center">Asistencia</th>
                {partialNumbers.map((pNum) => (
                  <th key={pNum} className="py-3 px-4 text-center w-24">
                    Parcial {pNum}
                  </th>
                ))}
                <th className="py-3 px-4 text-right w-32">Calificación Final</th>
                <th className="py-3 px-4 text-center w-32">Estatus</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle text-xs">
              {currentGroup.estudiantes.map((s) => (
                <tr key={s.id} className="hover:bg-surface-canvas transition-colors">
                  <td className="py-2.5 px-4 font-mono font-medium text-secondary">
                    {s.matricula}
                  </td>
                  <td className="py-2.5 px-4 font-medium text-secondary">
                    {s.nombre}
                  </td>
                  <td className="py-2.5 px-4 text-center font-mono tabular-nums text-secondary-slate">
                    {s.asistencia}%
                  </td>

                  {/* Celdas dinámicas de parciales según la configuración del grupo */}
                  {partialNumbers.map((pNum) => {
                    const val =
                      s.parciales?.[pNum] ??
                      (pNum === 1
                        ? s.parcial1
                        : pNum === 2
                        ? s.parcial2
                        : pNum === 3
                        ? s.parcial3
                        : pNum === 4
                        ? s.parcial4
                        : null) ??
                      ''
                    return (
                      <td key={pNum} className="py-2 px-3 text-center">
                        <input
                          type="number"
                          step="1"
                          min="0"
                          max="100"
                          disabled={isClosed}
                          value={val}
                          onChange={(e) => handleGradeChange(s.id, pNum, e.target.value)}
                          className={`w-20 h-8 text-center font-mono font-semibold rounded border outline-none transition-colors ${
                            isClosed
                              ? 'bg-surface-canvas text-secondary-muted border-border cursor-not-allowed'
                              : 'bg-surface-lowest text-secondary border-border-strong focus:border-tertiary focus:ring-1 focus:ring-tertiary'
                          }`}
                        />
                      </td>
                    )
                  })}

                  {/* Final Calculado Estrictamente Entero */}
                  <td className="py-2.5 px-4 text-right">
                    {s.final !== null && s.final !== undefined ? (
                      <span
                        className={`font-mono text-sm font-bold tabular-nums ${
                          s.final >= 70 ? 'text-secondary' : 'text-academic-danger'
                        }`}
                      >
                        {s.final}
                      </span>
                    ) : (
                      <span className="text-xs text-secondary-slate font-normal italic">
                        Pendiente
                      </span>
                    )}
                  </td>

                  {/* Estatus */}
                  <td className="py-2.5 px-4 text-center">
                    <Badge
                      variant={
                        s.estado === 'APROBADO'
                          ? 'success'
                          : s.estado === 'REPROBADO'
                          ? 'danger'
                          : 'warning'
                      }
                      dot
                      size="sm"
                    >
                      {s.estado}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>

      {/* 3. Panel Informativo de Auditoría */}
      <div className="p-4 bg-surface-lowest border border-border rounded-lg text-xs text-secondary-slate flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
          <span>
            Las modificaciones sobre actas de evaluación quedan firmadas bajo la clave institucional de docente ({user?.numeroEmpleado || 'DOCENTE'}).
          </span>
        </div>
        <div className="font-mono text-[11px] text-secondary-muted">
          Escala: 0 a 100 • Calificación final entera (redondeo estándar) • Mínimo aprobatorio: 70
        </div>
      </div>

      {/* Modal de Firma Digital de Acta */}
      <Modal
        isOpen={isSignModalOpen}
        onClose={() => setIsSignModalOpen(false)}
        title={`Cierre y Firma Digital: ${currentGroup.materia}`}
        description={`Grupo ${currentGroup.grupo} • ${currentGroup.estudiantes.length} alumnos evaluados`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsSignModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleConfirmSignAct}>
              Confirmar y Sellar Acta
            </Button>
          </>
        }
      >
        <form onSubmit={handleConfirmSignAct} className="space-y-4">
          <div className="p-3 bg-academic-danger-bg border border-academic-danger-border rounded text-academic-danger-text text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Atención:</strong> Al cerrar el acta oficial, las calificaciones quedarán congeladas y no podrán ser modificadas directamente por el docente sin autorización expresa del Jefe de Carrera.
            </p>
          </div>

          <Input
            label="Contraseña Institucional del Docente"
            type="password"
            placeholder="Ingrese su contraseña para firmar..."
            value={signaturePassword}
            onChange={(e) => setSignaturePassword(e.target.value)}
            helperText="Se generará un comprobante PKI criptográfico inmutable."
            required
          />
        </form>
      </Modal>
    </div>
  )
}
