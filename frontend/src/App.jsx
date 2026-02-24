import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './context/ThemeContext';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import AnalysisPage from './pages/AnalysisPage';
import NewAnalysisPage from './pages/NewAnalysisPage';
import SimulatorPage from './pages/SimulatorPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminAnalysesPage from './pages/AdminAnalysesPage';
import AdminPaymentsPage from './pages/AdminPaymentsPage';
import PrivateRoute from './components/PrivateRoute';
import AdminRoute from './components/AdminRoute';
import DashboardLayout from './components/DashboardLayout';
import AdminLayout from './components/AdminLayout';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import TermsOfUsePage from './pages/TermsOfUsePage';
import PartnerRegisterPage from './pages/PartnerRegisterPage';
import PartnerDashboardPage from './pages/PartnerDashboardPage';
import PartnerLoginPage from './pages/PartnerLoginPage';
import TrashPage from './pages/TrashPage';
import NotFoundPage from './pages/NotFoundPage';

// Lazy loaded pages
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const ComparePage = lazy(() => import('./pages/ComparePage'));
const WACCCalculatorPage = lazy(() => import('./pages/WACCCalculatorPage'));

const LazyFallback = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

export default function App() {
  return (
    <ThemeProvider>
    <BrowserRouter>
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
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/cadastro" element={<RegisterPage />} />
        <Route path="/verificar-email" element={<VerifyEmailPage />} />
        <Route path="/esqueci-senha" element={<ForgotPasswordPage />} />
        <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
        <Route path="/politica-de-privacidade" element={<PrivacyPolicyPage />} />
        <Route path="/termos-de-uso" element={<TermsOfUsePage />} />

        {/* Partner public routes */}
        <Route path="/parceiro/cadastro" element={<PartnerRegisterPage />} />
        <Route path="/parceiro/login" element={<PartnerLoginPage />} />

        {/* Protected — with Sidebar layout */}
        <Route element={<PrivateRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/nova-analise" element={<NewAnalysisPage />} />
            <Route path="/analise/:id" element={<AnalysisPage />} />
            <Route path="/simulador/:id" element={<SimulatorPage />} />
            <Route path="/lixeira" element={<TrashPage />} />
            <Route path="/perfil" element={<Suspense fallback={<LazyFallback />}><ProfilePage /></Suspense>} />
            <Route path="/comparar" element={<Suspense fallback={<LazyFallback />}><ComparePage /></Suspense>} />
            <Route path="/calculadora-wacc" element={<Suspense fallback={<LazyFallback />}><WACCCalculatorPage /></Suspense>} />
            <Route path="/parceiro/dashboard" element={<PartnerDashboardPage />} />
          </Route>
        </Route>

        {/* Admin */}
        <Route element={<AdminRoute />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminDashboardPage />} />
            <Route path="/admin/usuarios" element={<AdminUsersPage />} />
            <Route path="/admin/analises" element={<AdminAnalysesPage />} />
            <Route path="/admin/pagamentos" element={<AdminPaymentsPage />} />
          </Route>
        </Route>

        {/* 404 catch-all */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
    </ThemeProvider>
  );
}
