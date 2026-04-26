import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useLang } from '@/lib/langContext';
import {
  coerceToPermissionRole,
  getUserOverrides,
  hasPermission,
  ROLE_LABEL,
  type Permission,
} from '@/lib/permissions';

interface RequirePermissionProps {
  permission: Permission;
  children: React.ReactNode;
}

/**
 * Wraps a route (or any subtree) and only renders its children when the
 * current user has `permission` — via role default or per-user override.
 *
 * Deliberately does NOT redirect: the user is already authenticated by
 * the outer AuthGuard, so bouncing them to /admin/login would loop. We
 * render an explainer card so the admin who wired the role knows why
 * the page is empty, instead of a blank section that looks like a bug.
 */
export function RequirePermission({ permission, children }: RequirePermissionProps) {
  const user = useAuthStore(s => s.user);
  const { lang } = useLang();
  const navigate = useNavigate();

  // No user → nothing to check. AuthGuard handles the unauthenticated
  // case already, but render nothing rather than crashing on
  // user.role if someone drops RequirePermission outside an AuthGuard.
  const userId = user?.id;
  const userRole = user?.role;

  // Memoise the role coercion + overrides lookup. getUserOverrides()
  // calls loadOverrides() which hits localStorage and JSON.parses the
  // stored map every invocation — fine once per route mount, but this
  // component re-renders on every authStore / langContext change (tab
  // switch, language toggle, parent re-renders). Without the memo each
  // render did a fresh localStorage read + Object.entries scan +
  // permission validation pass purely to recompute the same boolean.
  // Only invalidate when the identity bits or the requested permission
  // change.
  // Memoise the coerced role so the denied UI does not re-run
  // coerceToPermissionRole on every parent re-render (lang toggle,
  // authStore tick) while the user role itself is unchanged.
  const role = useMemo(() => coerceToPermissionRole(userRole), [userRole]);

  const allowed = useMemo(() => {
    if (!userId) return false;
    const overrides = getUserOverrides(userId);
    return hasPermission(role, permission, overrides);
  }, [userId, role, permission]);

  if (!user) return null;
  if (allowed) return <>{children}</>;

  const isEn = lang === 'en';
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6" role="alert">
      <div className="max-w-md w-full bg-white border border-zinc-200 rounded-2xl shadow-sm p-6 text-center">
        <div className="w-12 h-12 mx-auto rounded-full bg-rose-50 flex items-center justify-center mb-4">
          <ShieldAlert className="text-rose-600" size={22} aria-hidden="true" />
        </div>
        <h1 className="text-lg font-extrabold tracking-tight text-zinc-900">
          {isEn ? 'Access denied' : 'Accès refusé'}
        </h1>
        <p className="text-sm text-zinc-600 mt-2">
          {isEn
            ? `Your role (${ROLE_LABEL[role]}) does not include the permission`
            : `Ton rôle (${ROLE_LABEL[role]}) ne te donne pas accès à la permission`}
          {' '}
          <code className="px-1.5 py-0.5 rounded bg-zinc-100 text-[11px] font-bold text-zinc-800">
            {permission}
          </code>
          {'.'}
        </p>
        <p className="text-xs text-zinc-500 mt-2">
          {isEn
            ? 'Ask a president or admin to grant you this permission in /admin/users.'
            : "Demande à un président ou admin de t'accorder cette permission dans /admin/users."}
        </p>
        <div className="mt-5 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg border border-zinc-200 hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-2"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            {isEn ? 'Go back' : 'Retour'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin')}
            className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg bg-[#0052CC] text-white hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-2"
          >
            {isEn ? 'Admin home' : 'Accueil admin'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default RequirePermission;
