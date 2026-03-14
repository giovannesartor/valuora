import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
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
const EditAnalysisPage     = lazy(() => import('./pages/EditAnalysisPage'));
const PitchDeckListPage    = lazy(() => import('./pages/PitchDeckListPage'));
const NewPitchDeckPage     = lazy(() => import('./pages/NewPitchDeckPage'));
const PitchDeckPage        = lazy(() => import('./pages/PitchDeckPage'));
const NotificationsPage    = lazy(() => import('./pages/NotificationsPage'));

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

              {/* Legacy PT-BR routes (redirects) */}
              <Route path="/signup" element={<RegisterPage />} />
              <Route path="/verify-email-legacy" element={<VerifyEmailPage />} />
              <Route path="/forgot-password-legacy" element={<ForgotPasswordPage />} />
              <Route path="/reset-password-legacy" element={<ResetPasswordPage />} />
              <Route path="/shared-legacy/:token" element={<PublicAnalysisPage />} />

              {/* Partner public routes */}
              <Route path="/partner/register-legacy" element={<PartnerRegisterPage />} />
              <Route path="/partner/login-legacy" element={<PartnerLoginPage />} />
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
                  {/* Legacy PT-BR dashboard routes */}
                  <Route path="/nova-analise" element={<NewAnalysisPage />} />
                  <Route path="/analise/:id" element={<AnalysisPage />} />
                  <Route path="/analise/:id/editar" element={<EditAnalysisPage />} />
                  <Route path="/simulador" element={<SimulatorPage />} />
                  <Route path="/simulador/:id" element={<SimulatorPage />} />
                  <Route path="/lixeira" element={<TrashPage />} />
                  <Route path="/perfil" element={<ProfilePage />} />
                  <Route path="/comparar" element={<ComparePage />} />
                  <Route path="/calculadora-wacc" element={<WACCCalculatorPage />} />
                  <Route path="/projecao-inversa" element={<InverseProjectionPage />} />
                  <Route path="/notificacoes" element={<NotificationsPage />} />
                  <Route path="/partner/dashboard"   element={<PartnerDashboardPage />} />
                  <Route path="/partner/clients"    element={<PartnerClientsPage />} />
                  <Route path="/partner/commissions"   element={<PartnerCommissionsPage />} />
                  <Route path="/partner/finance"  element={<PartnerFinanceiroPage />} />
                  <Route path="/partner/clients/:id" element={<PartnerClientDetailPage />} />
                  <Route path="/partner/marketing"   element={<PartnerMarketingPage />} />
                  <Route path="/partner/dashboard"   element={<PartnerDashboardPage />} />
                  <Route path="/partner/clients"    element={<PartnerClientsPage />} />
                  <Route path="/partner/commissions"   element={<PartnerCommissionsPage />} />
                  <Route path="/partner/finance"  element={<PartnerFinanceiroPage />} />
                  <Route path="/partner/clients/:id" element={<PartnerClientDetailPage />} />
                  <Route path="/partner/marketing"   element={<PartnerMarketingPage />} />
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
                  {/* Legacy PT-BR admin routes */}
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
