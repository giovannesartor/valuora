import { Navigate, Outlet } from 'react-router-dom';
import useAuthStore from '../store/authStore';

const ADMIN_EMAIL = 'giovannesartor@gmail.com';

export default function AdminRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin);

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // Only allow specific admin email
  const isAdminEmail = user?.email === ADMIN_EMAIL;
  if ((!isAdmin && !isSuperAdmin) || !isAdminEmail) return <Navigate to="/dashboard" replace />;

  return <Outlet />;
}
