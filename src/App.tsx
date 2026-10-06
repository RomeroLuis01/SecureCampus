import { Routes, Route, Navigate } from 'react-router-dom'
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
    <Routes>
      {/* 1. Módulo de Autenticación */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
      </Route>

      {/* 2. Módulo Estudiante */}
      <Route path="/estudiante" element={<DashboardLayout role="estudiante" />}>
        <Route index element={<StudentDashboard />} />
        <Route path="perfil" element={<StudentProfileView />} />
        <Route path="calificaciones" element={<StudentGradesView />} />
        <Route path="solicitudes" element={<StudentRequestsView />} />
      </Route>

      {/* 3. Módulo Profesor */}
      <Route path="/profesor" element={<DashboardLayout role="profesor" />}>
        <Route index element={<TeacherDashboard />} />
        <Route path="perfil" element={<TeacherProfileView />} />
        <Route path="grupos" element={<TeacherGroupsView />} />
        <Route path="calificaciones" element={<TeacherGradesView />} />
      </Route>

      {/* 4. Módulo Jefe de Carrera */}
      <Route path="/jefe_carrera" element={<DashboardLayout role="jefe_carrera" />}>
        <Route index element={<JefeDashboard />} />
        <Route path="docentes" element={<TeacherStaffView />} />
        <Route path="oferta" element={<CurricularOfferView />} />
        <Route path="perfil" element={<JefeProfileView />} />
      </Route>

      {/* 5. Módulo Administrador */}
      <Route path="/admin" element={<DashboardLayout role="admin" />}>
        <Route index element={<AdminDashboard />} />
        <Route path="usuarios" element={<AdminDashboard />} />
        <Route path="auditoria" element={<AdminDashboard />} />
        <Route path="sistema" element={<AdminDashboard />} />
      </Route>

      {/* Redirección por defecto */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

