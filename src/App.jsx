import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { useAuth } from './context/AuthContext';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ReducedMotionProvider } from './context/ReducedMotionContext';
import { NotificationProvider } from './context/NotificationContext';
import { FinancialRecordsProvider } from './context/FinancialRecordsContext';
import { Layout } from './components/Layout/Layout';
import { DashboardLayout } from './components/dashboard/DashboardLayout';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { OverviewPage } from './pages/dashboard/OverviewPage';
import { ReportsPage } from './pages/dashboard/ReportsPage';
import { ForecastingPage } from './pages/dashboard/ForecastingPage';
import { NotificationsPage } from './pages/dashboard/NotificationsPage';
import { TransactionsPage } from './pages/dashboard/TransactionsPage';
import { SettingsPage } from './pages/dashboard/SettingsPage';
import { AdminPage } from './pages/dashboard/AdminPage';
import { ErrorPage } from './pages/ErrorPage';
import { ErrorBoundary } from './components/ErrorBoundary';

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function PublicOnlyRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;
  return isAuthenticated ? <Navigate to="/overview" replace /> : children;
}

function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return (
    <ProtectedRoute>
      {user?.role === 'admin' ? children : <Navigate to="/overview" replace />}
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      {/*
        Fixed `user` only: do not tie MotionConfig to the in-app reduced-motion toggle. Changing
        `reducedMotion` re-renders every motion subtree and caused viewport paint glitches on
        Edge/Chromium while layout metrics stayed correct. In-app toggle still drives
        `data-reduced-motion` on #root, CSS tokens, and chart `isAnimationActive`. FM here follows OS
        prefers-reduced-motion only.
      */}
      <MotionConfig reducedMotion="user">
        <ReducedMotionProvider>
          <AuthProvider>
            <NotificationProvider>
              <ErrorBoundary>
                <BrowserRouter
                  future={{
                    v7_startTransition: true,
                    v7_relativeSplatPath: true,
                  }}
                >
                  <a href="#main-content" className="skip-link">
                    Skip to main content
                  </a>
                  <Routes>
                    <Route path="/" element={<Layout />}>
                      <Route index element={<HomePage />} />
                      <Route path="login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
                      <Route path="register" element={<PublicOnlyRoute><RegisterPage /></PublicOnlyRoute>} />
                      <Route path="reset-password" element={<ResetPasswordPage />} />
                    </Route>
                    <Route
                      path="/settings"
                      element={
                        <ProtectedRoute>
                          <FinancialRecordsProvider>
                            <Navigate to="/settings/profile" replace />
                          </FinancialRecordsProvider>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/settings/:section"
                      element={
                        <ProtectedRoute>
                          <FinancialRecordsProvider>
                            <SettingsPage />
                          </FinancialRecordsProvider>
                        </ProtectedRoute>
                      }
                    />
                    <Route path="/" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
                      <Route path="overview" element={<OverviewPage />} />
                      <Route path="forecasting" element={<ForecastingPage />} />
                      <Route path="reports" element={<ReportsPage />} />
                      <Route path="notifications" element={<NotificationsPage />} />
                      <Route path="transactions" element={<TransactionsPage />} />
                      <Route path="admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
                      <Route path="data" element={<Navigate to="/transactions" replace />} />
                      <Route path="costs" element={<Navigate to="/reports" replace />} />
                      <Route path="marketing" element={<Navigate to="/reports" replace />} />
                      <Route path="analytics" element={<Navigate to="/forecasting" replace />} />
                    </Route>
                    <Route path="*" element={<ErrorPage />} />
                  </Routes>
                </BrowserRouter>
              </ErrorBoundary>
            </NotificationProvider>
          </AuthProvider>
        </ReducedMotionProvider>
      </MotionConfig>
    </ThemeProvider>
  );
}
