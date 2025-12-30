import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import MainLayout from './layouts/MainLayout'
import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'
import StudentsPage from './pages/StudentsPage'
import StudentDetailPage from './pages/StudentDetailPage'
import DeploymentsPage from './pages/DeploymentsPage'
import AdminProjectsPage from './pages/AdminProjectsPage'
import RegistryPage from './pages/RegistryPage'
import MonitoringPage from './pages/MonitoringPage'
import SystemGuidePage from './pages/SystemGuidePage'
import ProjectStatusPage from './pages/ProjectStatusPage'
import SettingsPage from './pages/SettingsPage'
import ProfilePage from './pages/ProfilePage'

const RequireAuth = () => {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return <div>Loading...</div>
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />
}

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<MainLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/students" element={<StudentsPage />} />
          <Route path="/students/:id" element={<StudentDetailPage />} />
          <Route path="/deployments" element={<DeploymentsPage />} />
          <Route path="/projects/:id/status" element={<ProjectStatusPage />} />

          {/* Admin Routes */}
          <Route path="/admin/projects" element={<AdminProjectsPage />} />
          <Route path="/admin/registry" element={<RegistryPage />} />
          <Route path="/admin/monitoring" element={<MonitoringPage />} />
          <Route path="/admin/settings" element={<SettingsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/help/system" element={<SystemGuidePage />} />

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
