import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { AuthProvider } from './features/auth/AuthProvider.jsx'
import { ProtectedRoute } from './features/auth/ProtectedRoute.jsx'
import { PermissionGuard } from './features/auth/RequirePermission.jsx'
import { HomeRedirect } from './features/auth/HomeRedirect.jsx'
import LoginPage from './features/auth/LoginPage.jsx'
import AcceptInvitationPage from './features/auth/AcceptInvitationPage.jsx'
import ResetPasswordPage from './features/auth/ResetPasswordPage.jsx'
import ForgotPasswordPage from './features/auth/ForgotPasswordPage.jsx'
import { AppShell } from './components/AppShell.jsx'
import { routes } from './modules.js'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          {/* Enlaces de los correos de Supabase (ver 4_docs/autenticacion.md). */}
          <Route path="/auth/accept-invitation" element={<AcceptInvitationPage />} />
          <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
          <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />

          {/* Todo lo que está acá adentro requiere sesión (HU01). */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/" element={<HomeRedirect />} />
              {/* Las rutas las aportan los módulos (ver modules.js). */}
              {routes.map(({ path, Component, permission }) => (
                <Route
                  key={path}
                  path={path}
                  element={
                    permission ? (
                      <PermissionGuard permission={permission}>
                        <Component />
                      </PermissionGuard>
                    ) : (
                      <Component />
                    )
                  }
                />
              ))}
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
