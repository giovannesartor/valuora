import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './context/ThemeContext';
import ErrorBoundary from './components/ErrorBoundary';
import PrivateRoute from './components/PrivateRoute';
import AdminRoute from './components/AdminRoute';
import DashboardLayout from './components/DashboardLayout';
import AdminLayout from './components/AdminLayout';

// ─── Eager — páginas críticas de primeiro carregamento ────
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';

// ─── Lazy — todas as demais páginas ──────────────────────
const DashboardPage        = lazy(() => import('./pages/DashboardPage'));
const NewAnalysisPage      = lazy(() => import('./pages/NewAnalysisPage'));
const AnalysisPage         = lazy(() => import('./pages/AnalysisPage'));
const SimulatorPage        = lazy(() => import('./pages/SimulatorPage'));
const TrashPage            = lazy(() => import('./pages/TrashPage'));
const ProfilePage          = lazy(() => import('./pages/ProfilePage'));
const ComparePage          = lazy(() => import('./pages/ComparePage'));
const WACCCalculatorPage   = lazy(() => import('./pages/WACCCalculatorPage'));
const PartnerDashboardPage   = lazy(() => import('./pages/PartnerDashboardPage'));
const PartnerClientsPage     = lazy(() => import('./pages/PartnerClientsPage'));
const PartnerCommissionsPage = lazy(() => import('./pages/PartnerCommissionsPage'));
const PartnerFinanceiroPage  = lazy(() => import('./pages/PartnerFinanceiroPage'));
const PartnerRegisterPage    = lazy(() => import('./pages/PartnerRegisterPage'));
const PartnerLoginPage     = lazy(() => import('./pages/PartnerLoginPage'));
const AdminDashboardPage   = lazy(() => import('./pages/AdminDashboardPage'));
const AdminUsersPage       = lazy(() => import('./pages/AdminUsersPage'));
const AdminAnalysesPage    = lazy(() => import('./pages/AdminAnalysesPage'));
const AdminPaymentsPage    = lazy(() => import('./pages/AdminPaymentsPage'));
const AdminCouponsPage     = lazy(() => import('./pages/AdminCouponsPage'));
const AdminAuditLogPage    = lazy(() => import('./pages/AdminAuditLogPage'));
const PrivacyPolicyPage    = lazy(() => import('./pages/PrivacyPolicyPage'));
const TermsOfUsePage       = lazy(() => import('./pages/TermsOfUsePage'));
const NotFoundPage         = lazy(() => import('./pages/NotFoundPage'));
const PublicAnalysisPage   = lazy(() => import('./pages/PublicAnalysisPage'));
const EditAnalysisPage     = lazy(() => import('./pages/EditAnalysisPage'));

const LazyFallback = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

export default function App() {
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
              <Route path="/cadastro" element={<RegisterPage />} />
              <Route path="/verificar-email" element={<VerifyEmailPage />} />
              <Route path="/esqueci-senha" element={<ForgotPasswordPage />} />
              <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
              <Route path="/politica-de-privacidade" element={<PrivacyPolicyPage />} />
              <Route path="/termos-de-uso" element={<TermsOfUsePage />} />
              <Route path="/compartilhado/:token" element={<PublicAnalysisPage />} />

              {/* Partner public routes */}
              <Route path="/parceiro/cadastro" element={<PartnerRegisterPage />} />
              <Route path="/parceiro/login" element={<PartnerLoginPage />} />

              {/* Protected — with Sidebar layout */}
              <Route element={<PrivateRoute />}>
                <Route element={<DashboardLayout />}>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/nova-analise" element={<NewAnalysisPage />} />
                  <Route path="/analise/:id" element={<AnalysisPage />} />
                  <Route path="/analise/:id/editar" element={<EditAnalysisPage />} />
                  <Route path="/simulador/:id" element={<SimulatorPage />} />
                  <Route path="/lixeira" element={<TrashPage />} />
                  <Route path="/perfil" element={<ProfilePage />} />
                  <Route path="/comparar" element={<ComparePage />} />
                  <Route path="/calculadora-wacc" element={<WACCCalculatorPage />} />
                  <Route path="/parceiro/dashboard"   element={<PartnerDashboardPage />} />
                  <Route path="/parceiro/clientes"    element={<PartnerClientsPage />} />
                  <Route path="/parceiro/comissoes"   element={<PartnerCommissionsPage />} />
                  <Route path="/parceiro/financeiro"  element={<PartnerFinanceiroPage />} />
                </Route>
              </Route>

              {/* Admin */}
              <Route element={<AdminRoute />}>
                <Route element={<AdminLayout />}>
                  <Route path="/admin" element={<AdminDashboardPage />} />
                  <Route path="/admin/usuarios" element={<AdminUsersPage />} />
                  <Route path="/admin/analises" element={<AdminAnalysesPage />} />
                  <Route path="/admin/pagamentos" element={<AdminPaymentsPage />} />
                  <Route path="/admin/cupons" element={<AdminCouponsPage />} />
                  <Route path="/admin/audit-log" element={<AdminAuditLogPage />} />
                </Route>
              </Route>

              {/* 404 catch-all */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </BrowserRouter>
    </ThemeProvider>
  );
}
