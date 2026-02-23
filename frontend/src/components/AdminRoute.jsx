import { Navigate, Outlet } from 'react-router-dom';
import useAuthStore from '../store/authStore';

export default function AdminRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin);

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isAdmin && !isSuperAdmin) return <Navigate to="/dashboard" replace />;

  return <Outlet />;
}
