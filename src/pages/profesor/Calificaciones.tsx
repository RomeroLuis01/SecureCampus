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
import type { StudentGradeEntry } from '../../services/mockData'

export const TeacherGradesView: React.FC = () => {
  const [selectedGroupIndex, setSelectedGroupIndex] = useState(0)
  const [groupsData, setGroupsData] = useState(mockTeacherGroups)
  const [isSignModalOpen, setIsSignModalOpen] = useState(false)
  const [signaturePassword, setSignaturePassword] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'info'; text: string } | null>(null)

  const currentGroup = groupsData[selectedGroupIndex]

  // Actualizar calificación de un estudiante
  const handleGradeChange = (studentId: string, field: 'parcial1' | 'parcial2' | 'proyecto', valStr: string) => {
    const val = parseFloat(valStr) || 0
    const clamped = Math.min(10, Math.max(0, val))

    setGroupsData((prev) => {
      const next = [...prev]
      const grp = { ...next[selectedGroupIndex] }
      grp.estudiantes = grp.estudiantes.map((s) => {
        if (s.id === studentId) {
          const updated: StudentGradeEntry = { ...s, [field]: clamped }
          // Recálculo de promedio final ponderado
          const finalScore = Number(((updated.parcial1 + updated.parcial2 + updated.proyecto) / 3).toFixed(1))
          updated.final = finalScore
          updated.estado = finalScore >= 7.0 ? 'APROBADO' : 'REPROBADO'
          return updated
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
        text: 'Borrador de calificaciones guardado temporalmente en el servidor.',
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
            {currentGroup.materia} • Grupo {currentGroup.grupo} • Aula {currentGroup.aula}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="w-64">
            <Select
              value={selectedGroupIndex}
              onChange={(e) => setSelectedGroupIndex(Number(e.target.value))}
              options={groupsData.map((g, idx) => ({
                value: idx,
                label: `${g.clave} - Grupo ${g.grupo} (${g.estatusActa})`,
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

      {/* 2. Matriz de Captura Interactiva */}
      <Card>
        <CardBody className="p-0 overflow-x-auto">
          <table className="w-full border-collapse text-left font-sans">
            <thead>
              <tr className="bg-surface-canvas border-b border-border text-[11px] font-bold uppercase tracking-wider text-secondary-slate">
                <th className="py-3 px-4">Matrícula</th>
                <th className="py-3 px-4">Estudiante</th>
                <th className="py-3 px-4 text-center">Asistencia</th>
                <th className="py-3 px-4 text-center w-28">Parcial 1</th>
                <th className="py-3 px-4 text-center w-28">Parcial 2</th>
                <th className="py-3 px-4 text-center w-28">Proyecto</th>
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

                  {/* Input Parcial 1 */}
                  <td className="py-2 px-3 text-center">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      disabled={isClosed}
                      value={s.parcial1}
                      onChange={(e) => handleGradeChange(s.id, 'parcial1', e.target.value)}
                      className={`w-20 h-8 text-center font-mono font-semibold rounded border outline-none transition-colors ${
                        isClosed
                          ? 'bg-surface-canvas text-secondary-muted border-border cursor-not-allowed'
                          : 'bg-surface-lowest text-secondary border-border-strong focus:border-tertiary focus:ring-1 focus:ring-tertiary'
                      }`}
                    />
                  </td>

                  {/* Input Parcial 2 */}
                  <td className="py-2 px-3 text-center">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      disabled={isClosed}
                      value={s.parcial2}
                      onChange={(e) => handleGradeChange(s.id, 'parcial2', e.target.value)}
                      className={`w-20 h-8 text-center font-mono font-semibold rounded border outline-none transition-colors ${
                        isClosed
                          ? 'bg-surface-canvas text-secondary-muted border-border cursor-not-allowed'
                          : 'bg-surface-lowest text-secondary border-border-strong focus:border-tertiary focus:ring-1 focus:ring-tertiary'
                      }`}
                    />
                  </td>

                  {/* Input Proyecto */}
                  <td className="py-2 px-3 text-center">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      disabled={isClosed}
                      value={s.proyecto}
                      onChange={(e) => handleGradeChange(s.id, 'proyecto', e.target.value)}
                      className={`w-20 h-8 text-center font-mono font-semibold rounded border outline-none transition-colors ${
                        isClosed
                          ? 'bg-surface-canvas text-secondary-muted border-border cursor-not-allowed'
                          : 'bg-surface-lowest text-secondary border-border-strong focus:border-tertiary focus:ring-1 focus:ring-tertiary'
                      }`}
                    />
                  </td>

                  {/* Final Calculado */}
                  <td className="py-2.5 px-4 text-right">
                    <span
                      className={`font-mono text-sm font-bold tabular-nums ${
                        s.final >= 7.0 ? 'text-secondary' : 'text-academic-danger'
                      }`}
                    >
                      {s.final.toFixed(1)}
                    </span>
                  </td>

                  {/* Estatus */}
                  <td className="py-2.5 px-4 text-center">
                    <Badge
                      variant={s.estado === 'APROBADO' ? 'success' : 'danger'}
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
            Las modificaciones sobre actas de evaluación quedan firmadas bajo la clave institucional de docente (DOC-8821).
          </span>
        </div>
        <div className="font-mono text-[11px] text-secondary-muted">
          Escala: 0.0 a 10.0 • Mínimo aprobatorio: 7.0
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
