import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './config/queryClient'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
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
import AccountsPage from './pages/AccountsPage'
import AuditPage from './pages/AuditPage'
import { AdminOnly, TeacherOrAdmin } from './components/RoleGuard'

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

          {/* Teacher/Admin Routes */}
          <Route path="/students" element={
            <TeacherOrAdmin><StudentsPage /></TeacherOrAdmin>
          } />
          <Route path="/students/:id" element={
            <TeacherOrAdmin><StudentDetailPage /></TeacherOrAdmin>
          } />
          <Route path="/deployments" element={
            <TeacherOrAdmin><DeploymentsPage /></TeacherOrAdmin>
          } />

          {/* Project Status - accessible by all authenticated users */}
          <Route path="/projects/:id/status" element={<ProjectStatusPage />} />

          {/* Student's own project (alias for /projects/me/status) */}
          <Route path="/projects/me/status" element={<ProjectStatusPage isStudentView />} />

          {/* Admin Only Routes */}
          <Route path="/admin/projects" element={
            <AdminOnly><AdminProjectsPage /></AdminOnly>
          } />
          <Route path="/admin/registry" element={
            <AdminOnly><RegistryPage /></AdminOnly>
          } />
          <Route path="/admin/monitoring" element={
            <TeacherOrAdmin><MonitoringPage /></TeacherOrAdmin>
          } />
          <Route path="/admin/settings" element={
            <AdminOnly><SettingsPage /></AdminOnly>
          } />
          <Route path="/admin/accounts" element={
            <AdminOnly><AccountsPage /></AdminOnly>
          } />
          <Route path="/admin/audit" element={
            <AdminOnly><AuditPage /></AdminOnly>
          } />

          {/* Common Routes */}
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
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
