import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components'
import { AuthLayout, DashboardLayout } from './layouts'
import { Login } from './pages/auth'
import {
  StudentDashboard,
  StudentProfileView,
  StudentGradesView,
  StudentRequestsView,
} from './pages/estudiante'
import { AdminDashboard } from './pages/admin'
import {
  TeacherDashboard,
  TeacherProfileView,
  TeacherGroupsView,
  TeacherGradesView,
} from './pages/profesor'
import {
  JefeDashboard,
  TeacherStaffView,
  CurricularOfferView,
  JefeProfileView,
} from './pages/jefe_carrera'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* 1. Módulo de Autenticación Público */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<Login />} />
        </Route>

        {/* 2. Módulo Estudiante (Requiere rol ALUMNO) */}
        <Route element={<ProtectedRoute allowedRoles={['ALUMNO', 'estudiante']} />}>
          <Route path="/estudiante" element={<DashboardLayout role="estudiante" />}>
            <Route index element={<StudentDashboard />} />
            <Route path="perfil" element={<StudentProfileView />} />
            <Route path="calificaciones" element={<StudentGradesView />} />
            <Route path="solicitudes" element={<StudentRequestsView />} />
          </Route>
        </Route>

        {/* 3. Módulo Profesor (Requiere rol PROFESOR) */}
        <Route element={<ProtectedRoute allowedRoles={['PROFESOR', 'profesor']} />}>
          <Route path="/profesor" element={<DashboardLayout role="profesor" />}>
            <Route index element={<TeacherDashboard />} />
            <Route path="perfil" element={<TeacherProfileView />} />
            <Route path="grupos" element={<TeacherGroupsView />} />
            <Route path="calificaciones" element={<TeacherGradesView />} />
          </Route>
        </Route>

        {/* 4. Módulo Jefe de Carrera (Requiere rol JEFE_CARRERA) */}
        <Route element={<ProtectedRoute allowedRoles={['JEFE_CARRERA', 'jefe_carrera']} />}>
          <Route path="/jefe_carrera" element={<DashboardLayout role="jefe_carrera" />}>
            <Route index element={<JefeDashboard />} />
            <Route path="docentes" element={<TeacherStaffView />} />
            <Route path="oferta" element={<CurricularOfferView />} />
            <Route path="perfil" element={<JefeProfileView />} />
          </Route>
        </Route>

        {/* 5. Módulo Administrador (Requiere rol ADMINISTRADOR) */}
        <Route element={<ProtectedRoute allowedRoles={['ADMINISTRADOR', 'admin']} />}>
          <Route path="/admin" element={<DashboardLayout role="admin" />}>
            <Route index element={<AdminDashboard />} />
            <Route path="usuarios" element={<AdminDashboard />} />
            <Route path="auditoria" element={<AdminDashboard />} />
            <Route path="sistema" element={<AdminDashboard />} />
          </Route>
        </Route>

        {/* Rutas desconocidas y raíz: Redirigir a inicio */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  )
}

