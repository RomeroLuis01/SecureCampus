import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
} from 'lucide-react'
import { Button, Input, Card, CardBody, Modal } from '../../components'
import { useAuth } from '../../context/AuthContext'
import { getDefaultRouteForUser } from '../../utils/roles'
import { sanitizeReturnUrl } from '../../utils/url'

export const Login: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { login, user, status, error: authError } = useAuth()

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showRecoveryModal, setShowRecoveryModal] = useState(false)
  const [recoveryEmail, setRecoveryEmail] = useState('')
  const [recoverySent, setRecoverySent] = useState(false)

  // Redirigir si el usuario ya cuenta con una sesión válida
  useEffect(() => {
    if (status === 'authenticated' && user) {
      const returnUrlParam = searchParams.get('returnUrl')
      const safeTarget = sanitizeReturnUrl(returnUrlParam, '')
      const destination = safeTarget || getDefaultRouteForUser(user)
      if (destination && destination !== '/login') {
        navigate(destination, { replace: true })
      }
    }
  }, [status, user, navigate, searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!identifier.trim()) {
      setError('Por favor ingrese su matrícula, nómina o correo institucional.')
      return
    }

    if (!password) {
      setError('Por favor ingrese su contraseña.')
      return
    }

    setIsLoading(true)

    try {
      const authenticatedUser = await login(identifier.trim(), password)
      setIsLoading(false)

      const returnUrlParam = searchParams.get('returnUrl')
      const safeTarget = sanitizeReturnUrl(returnUrlParam, '')

      if (safeTarget) {
        navigate(safeTarget, { replace: true })
      } else {
        const destination = getDefaultRouteForUser(authenticatedUser)
        if (destination && destination !== '/login') {
          navigate(destination, { replace: true })
        } else {
          setError('Su cuenta no cuenta con roles activos para acceder a ningún portal institucional.')
        }
      }
    } catch (err: any) {
      setIsLoading(false)
      setError(err?.message || 'Credenciales inválidas o error de comunicación.')
    }
  }

  const handleRecoverySubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!recoveryEmail.includes('@')) {
      return
    }
    setRecoverySent(true)
  }

  const activeErrorMessage = error || authError

  return (
    <div className="w-full space-y-6">
      <Card variant="elevated" className="border-border-strong shadow-layer-2">
        <div className="p-6 border-b border-border-subtle bg-surface-canvas text-center">
          <div className="w-12 h-12 bg-primary rounded text-white font-bold text-lg mx-auto flex items-center justify-center shadow-md mb-3">
            SC
          </div>
          <h1 className="text-xl font-bold text-secondary tracking-tight">
            Acceso Institucional
          </h1>
          <p className="text-xs text-secondary-slate mt-1">
            Ingrese sus credenciales únicas para acceder a los servicios de SecureCampus.
          </p>
        </div>

        <CardBody className="p-6 sm:p-8">
          {activeErrorMessage && (
            <div className="mb-5 p-3 rounded-md bg-academic-danger-bg border border-academic-danger-border flex items-start gap-2.5 text-academic-danger-text text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{activeErrorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Matrícula o Correo Institucional"
              placeholder="ej. 202301042 o usuario@securecampus.edu"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              leftIcon={<Mail className="w-4 h-4 text-secondary-muted" />}
              required
            />

            <div>
              <Input
                label="Contraseña de Acceso"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<Lock className="w-4 h-4 text-secondary-muted shrink-0" />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="h-7 w-7 flex items-center justify-center text-secondary-muted hover:text-secondary rounded transition-colors shrink-0"
                    title={showPassword ? 'Ocultar' : 'Mostrar'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4 shrink-0" /> : <Eye className="w-4 h-4 shrink-0" />}
                  </button>
                }
                required
              />
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none text-secondary-slate">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded-sm border-border-strong text-primary focus:ring-tertiary h-3.5 w-3.5"
                />
                <span>Recordarme en este equipo</span>
              </label>

              <button
                type="button"
                onClick={() => {
                  setRecoverySent(false)
                  setShowRecoveryModal(true)
                }}
                className="text-primary hover:underline font-medium"
              >
                ¿Olvidó su contraseña?
              </button>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-2"
              isLoading={isLoading}
              rightIcon={<ArrowRight className="w-4 h-4 shrink-0" />}
            >
              Iniciar Sesión
            </Button>
          </form>
        </CardBody>
      </Card>

      {/* Nota de Seguridad */}
      <div className="p-3.5 bg-surface-lowest border border-border rounded-lg text-xs text-secondary-slate flex items-center gap-3">
        <ShieldCheck className="w-5 h-5 text-primary shrink-0" />
        <p className="leading-normal">
          Acceso protegido con cifrado TLS 1.3 y registro en la bitácora criptográfica de auditoría.
        </p>
      </div>

      {/* Modal de Recuperación */}
      <Modal
        isOpen={showRecoveryModal}
        onClose={() => setShowRecoveryModal(false)}
        title="Recuperación de Credenciales"
        description="Le enviaremos un enlace criptográfico temporal para restablecer su clave de acceso institucional."
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowRecoveryModal(false)}>
              Cerrar
            </Button>
            {!recoverySent && (
              <Button variant="primary" onClick={handleRecoverySubmit}>
                Enviar Enlace
              </Button>
            )}
          </>
        }
      >
        {!recoverySent ? (
          <form onSubmit={handleRecoverySubmit} className="space-y-4">
            <Input
              label="Correo Electrónico Institucional"
              type="email"
              placeholder="su.usuario@securecampus.edu"
              value={recoveryEmail}
              onChange={(e) => setRecoveryEmail(e.target.value)}
              helperText="Debe ser la dirección oficial registrada en su expediente."
              required
            />
          </form>
        ) : (
          <div className="p-4 bg-academic-success-bg border border-academic-success-border rounded text-academic-success-text text-xs space-y-1">
            <p className="font-semibold">Solicitud enviada correctamente</p>
            <p>
              Revise su bandeja de entrada en <strong>{recoveryEmail}</strong> con las instrucciones para restablecer su contraseña segura.
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}
