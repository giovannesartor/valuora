import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './context/ThemeContext';
import ErrorBoundary from './components/ErrorBoundary';
import PrivateRoute from './components/PrivateRoute';
import AdminRoute from './components/AdminRoute';
import DashboardLayout from './components/DashboardLayout';
import AdminLayout from './components/AdminLayout';
import CookieBanner from './components/CookieBanner';
import useAuthStore from './store/authStore';

// ─── Eager — critical first-load pages ────────────────────
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';

// ─── Lazy — all other pages ──────────────────────────
const DashboardPage        = lazy(() => import('./pages/DashboardPage'));
const NewAnalysisPage      = lazy(() => import('./pages/NewAnalysisPage'));
const AnalysisPage         = lazy(() => import('./pages/AnalysisPage'));
const SimulatorPage        = lazy(() => import('./pages/SimulatorPage'));
const TrashPage            = lazy(() => import('./pages/TrashPage'));
const ProfilePage          = lazy(() => import('./pages/ProfilePage'));
const ComparePage          = lazy(() => import('./pages/ComparePage'));
const WACCCalculatorPage   = lazy(() => import('./pages/WACCCalculatorPage'));
const InverseProjectionPage = lazy(() => import('./pages/InverseProjectionPage'));
const PartnerDashboardPage   = lazy(() => import('./pages/PartnerDashboardPage'));
const PartnerClientsPage     = lazy(() => import('./pages/PartnerClientsPage'));
const PartnerCommissionsPage   = lazy(() => import('./pages/PartnerCommissionsPage'));
const PartnerClientDetailPage = lazy(() => import('./pages/PartnerClientDetailPage'));
const PartnerMarketingPage    = lazy(() => import('./pages/PartnerMarketingPage'));
const PartnerFinanceiroPage  = lazy(() => import('./pages/PartnerFinanceiroPage'));
const PartnerRegisterPage    = lazy(() => import('./pages/PartnerRegisterPage'));
const PartnerLoginPage     = lazy(() => import('./pages/PartnerLoginPage'));
const AdminDashboardPage   = lazy(() => import('./pages/AdminDashboardPage'));
const AdminUsersPage       = lazy(() => import('./pages/AdminUsersPage'));
const AdminAnalysesPage    = lazy(() => import('./pages/AdminAnalysesPage'));
const AdminPaymentsPage    = lazy(() => import('./pages/AdminPaymentsPage'));
const AdminCouponsPage     = lazy(() => import('./pages/AdminCouponsPage'));
const AdminAuditLogPage    = lazy(() => import('./pages/AdminAuditLogPage'));
const AdminErrorLogsPage   = lazy(() => import('./pages/AdminErrorLogsPage'));
const PrivacyPolicyPage    = lazy(() => import('./pages/PrivacyPolicyPage'));
const TermsOfUsePage       = lazy(() => import('./pages/TermsOfUsePage'));
const NotFoundPage         = lazy(() => import('./pages/NotFoundPage'));
const PublicAnalysisPage   = lazy(() => import('./pages/PublicAnalysisPage'));
const InteractiveReportPage = lazy(() => import('./pages/InteractiveReportPage'));
const EditAnalysisPage     = lazy(() => import('./pages/EditAnalysisPage'));
const PitchDeckListPage    = lazy(() => import('./pages/PitchDeckListPage'));
const NewPitchDeckPage     = lazy(() => import('./pages/NewPitchDeckPage'));
const PitchDeckPage        = lazy(() => import('./pages/PitchDeckPage'));
const NotificationsPage    = lazy(() => import('./pages/NotificationsPage'));
const PartnerTemplatesPage     = lazy(() => import('./pages/PartnerTemplatesPage'));
const PartnerFollowUpRulesPage = lazy(() => import('./pages/PartnerFollowUpRulesPage'));
const PartnerSettingsPage      = lazy(() => import('./pages/PartnerSettingsPage'));
const NotificationPreferencesPage = lazy(() => import('./pages/NotificationPreferencesPage'));
const ROICalculatorPage = lazy(() => import('./pages/ROICalculatorPage'));

const LazyFallback = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

export default function App() {
  const fetchUser = useAuthStore(s => s.fetchUser);
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);

  // Restore user object on hard reload / deploy — token stays in localStorage
  // but zustand state is fresh, so user would be null without this call.
  useEffect(() => {
    if (isAuthenticated) {
      fetchUser();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ThemeProvider>
      <BrowserRouter>
        <ErrorBoundary>
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                fontFamily: 'Inter, sans-serif',
                borderRadius: '8px',
              },
              className: 'dark:bg-slate-800 dark:text-white bg-white text-slate-900',
            }}
          />
          <Suspense fallback={<LazyFallback />}>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/verify-email" element={<VerifyEmailPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
              <Route path="/terms-of-use" element={<TermsOfUsePage />} />
              <Route path="/shared/:token" element={<PublicAnalysisPage />} />
              <Route path="/report/:token" element={<InteractiveReportPage />} />

              {/* Legacy PT-BR routes → redirect to canonical EN paths */}
              <Route path="/signup" element={<Navigate to="/register" replace />} />
              <Route path="/verify-email-legacy" element={<Navigate to="/verify-email" replace />} />
              <Route path="/forgot-password-legacy" element={<Navigate to="/forgot-password" replace />} />
              <Route path="/reset-password-legacy" element={<Navigate to="/reset-password" replace />} />
              <Route path="/shared-legacy/:token" element={<Navigate to="/shared/:token" replace />} />

              {/* Partner public routes */}
              <Route path="/partner/register-legacy" element={<Navigate to="/partner/register" replace />} />
              <Route path="/partner/login-legacy" element={<Navigate to="/partner/login" replace />} />
              <Route path="/partner/register" element={<PartnerRegisterPage />} />
              <Route path="/partner/login" element={<PartnerLoginPage />} />

              {/* Protected — with Sidebar layout */}
              <Route element={<PrivateRoute />}>
                <Route element={<DashboardLayout />}>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/new-analysis" element={<NewAnalysisPage />} />
                  <Route path="/analysis/:id" element={<AnalysisPage />} />
                  <Route path="/analysis/:id/edit" element={<EditAnalysisPage />} />
                  <Route path="/simulator" element={<SimulatorPage />} />
                  <Route path="/simulator/:id" element={<SimulatorPage />} />
                  <Route path="/trash" element={<TrashPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/compare" element={<ComparePage />} />
                  <Route path="/wacc-calculator" element={<WACCCalculatorPage />} />
                  <Route path="/inverse-projection" element={<InverseProjectionPage />} />
                  <Route path="/notifications" element={<NotificationsPage />} />
                  <Route path="/pitch-deck" element={<PitchDeckListPage />} />
                  <Route path="/pitch-deck/new" element={<NewPitchDeckPage />} />
                  <Route path="/pitch-deck/novo" element={<NewPitchDeckPage />} />
                  <Route path="/pitch-deck/:id" element={<PitchDeckPage />} />
                  {/* Legacy PT-BR dashboard routes → redirect to EN paths */}
                  <Route path="/nova-analise" element={<Navigate to="/new-analysis" replace />} />
                  <Route path="/analise/:id" element={<Navigate to="/analysis/:id" replace />} />
                  <Route path="/analise/:id/editar" element={<Navigate to="/analysis/:id/edit" replace />} />
                  <Route path="/simulador" element={<Navigate to="/simulator" replace />} />
                  <Route path="/simulador/:id" element={<Navigate to="/simulator/:id" replace />} />
                  <Route path="/lixeira" element={<Navigate to="/trash" replace />} />
                  <Route path="/perfil" element={<Navigate to="/profile" replace />} />
                  <Route path="/comparar" element={<Navigate to="/compare" replace />} />
                  <Route path="/calculadora-wacc" element={<Navigate to="/wacc-calculator" replace />} />
                  <Route path="/projecao-inversa" element={<Navigate to="/inverse-projection" replace />} />
                  <Route path="/notificacoes" element={<Navigate to="/notifications" replace />} />
                  <Route path="/partner/dashboard"   element={<PartnerDashboardPage />} />
                  <Route path="/partner/clients"    element={<PartnerClientsPage />} />
                  <Route path="/partner/commissions"   element={<PartnerCommissionsPage />} />
                  <Route path="/partner/finance"  element={<PartnerFinanceiroPage />} />
                  <Route path="/partner/clients/:id" element={<PartnerClientDetailPage />} />
                  <Route path="/partner/marketing"   element={<PartnerMarketingPage />} />
                  <Route path="/partner/templates"   element={<PartnerTemplatesPage />} />
                  <Route path="/partner/followup"    element={<PartnerFollowUpRulesPage />} />
                  <Route path="/partner/settings"    element={<PartnerSettingsPage />} />
                  <Route path="/notification-preferences" element={<NotificationPreferencesPage />} />
                  <Route path="/roi-calculator" element={<ROICalculatorPage />} />
                </Route>
              </Route>

              {/* Admin */}
              <Route element={<AdminRoute />}>
                <Route element={<AdminLayout />}>
                  <Route path="/admin" element={<AdminDashboardPage />} />
                  <Route path="/admin/users" element={<AdminUsersPage />} />
                  <Route path="/admin/analyses" element={<AdminAnalysesPage />} />
                  <Route path="/admin/payments" element={<AdminPaymentsPage />} />
                  <Route path="/admin/coupons" element={<AdminCouponsPage />} />
                  <Route path="/admin/audit-log" element={<AdminAuditLogPage />} />
                  <Route path="/admin/error-logs" element={<AdminErrorLogsPage />} />
                </Route>
              </Route>

              {/* 404 catch-all */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
          <CookieBanner />
        </ErrorBoundary>
      </BrowserRouter>
    </ThemeProvider>
  );
}
