import { Navigate, Outlet, useLocation } from 'react-router-dom';
import useAuthStore from '../store/authStore';

export default function PrivateRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isPartner = useAuthStore((s) => s.isPartner);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname + location.search + location.hash }} replace />;
  }

  // Partner-only users can only access /parceiro/* routes and /perfil
  const partnerOnly = isPartner && !isAdmin && !isSuperAdmin;
  const isPartnerRoute = location.pathname.startsWith('/parceiro') || location.pathname === '/perfil';
  if (partnerOnly && !isPartnerRoute) {
    return <Navigate to="/parceiro/dashboard" replace />;
  }

  return <Outlet />;
}
