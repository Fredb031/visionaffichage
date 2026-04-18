import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore, type UserRole } from '@/stores/authStore';

interface AuthGuardProps {
  children: React.ReactNode;
  requiredRole: UserRole | UserRole[];
  redirectTo?: string;
}

export function AuthGuard({ children, requiredRole, redirectTo = '/admin/login' }: AuthGuardProps) {
  const user = useAuthStore(s => s.user);
  const location = useLocation();

  const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];

  if (!user) {
    return <Navigate to={redirectTo} state={{ from: location.pathname }} replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    // Wrong role — send to their natural home.
    const home = user.role === 'admin' ? '/admin' : user.role === 'vendor' ? '/vendor' : '/';
    return <Navigate to={home} replace />;
  }

  return <>{children}</>;
}
