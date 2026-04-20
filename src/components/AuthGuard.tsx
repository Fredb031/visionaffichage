import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore, type UserRole } from '@/stores/authStore';
import { useLang } from '@/lib/langContext';

interface AuthGuardProps {
  children: React.ReactNode;
  requiredRole: UserRole | UserRole[];
  /** Explicit login page. When omitted, the guard auto-picks based on
   * the current path: /vendor/* → /admin/login (same login page, redirect
   * back to /vendor after success). Keeps things simple with one login. */
  redirectTo?: string;
}

export function AuthGuard({ children, requiredRole, redirectTo }: AuthGuardProps) {
  const user = useAuthStore(s => s.user);
  const loading = useAuthStore(s => s.loading);
  const location = useLocation();
  const { lang } = useLang();

  const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];

  // Don't redirect while the auth store is still hydrating from Supabase
  // session — otherwise a logged-in user landing directly on /admin/...
  // gets bounced to /admin/login for ~50ms before the session resolves.
  if (loading) {
    return (
      <div
        className="min-h-[60vh] flex items-center justify-center"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="w-6 h-6 border-2 border-[#0052CC] border-t-transparent rounded-full animate-spin" aria-hidden="true" />
        <span className="sr-only">{lang === 'en' ? 'Loading' : 'Chargement'}</span>
      </div>
    );
  }

  if (!user) {
    // Default to /admin/login since it's the single sign-in surface on
    // this site; AdminLogin's post-auth redirect sends admins to /admin
    // and vendors to /vendor based on role. Pages can override if needed.
    //
    // Preserve search + hash so the back-redirect lands on the exact
    // URL the user tried to reach — previously state.from dropped the
    // ?cat=polos / #anchor, stranding the user on the bare route.
    const target = redirectTo ?? '/admin/login';
    const from = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={target} state={{ from }} replace />;
  }

  // President has access to everything — bypass role check.
  if (user.role !== 'president' && !allowedRoles.includes(user.role)) {
    // Wrong role — send to their natural home.
    const home = user.role === 'admin' ? '/admin' : user.role === 'vendor' ? '/vendor' : '/';
    return <Navigate to={home} replace />;
  }

  return <>{children}</>;
}
