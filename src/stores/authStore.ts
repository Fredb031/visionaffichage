import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';

export type UserRole = 'president' | 'admin' | 'vendor' | 'client';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  initials: string;
  title?: string;
}

interface AuthState {
  user: AuthUser | null;
  error: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; role?: UserRole }>;
  signUp: (email: string, password: string, name: string) => Promise<{ ok: boolean }>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<{ ok: boolean }>;
  updatePassword: (newPassword: string) => Promise<{ ok: boolean }>;
  hydrateFromSession: () => Promise<void>;
  setError: (error: string | null) => void;
  clearError: () => void;
}

function toInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function friendlyError(msg: string): string {
  // Read the user's active language from the same localStorage key
  // langContext writes to — avoids having to thread `lang` through every
  // auth call. Falls back to French (the default Québec audience).
  let isEn = false;
  try { isEn = localStorage.getItem('vision-lang') === 'en'; } catch { /* private mode */ }
  const m = msg.toLowerCase();
  if (m.includes('invalid login') || m.includes('invalid_credentials')) {
    return isEn ? 'Invalid email or password' : 'Courriel ou mot de passe invalide';
  }
  if (m.includes('email not confirmed')) {
    return isEn ? 'Please confirm your email before signing in' : 'Confirme ton courriel avant de te connecter';
  }
  if (m.includes('user already registered')) {
    return isEn ? 'An account already exists with this email' : 'Un compte existe déjà avec ce courriel';
  }
  if (m.includes('rate limit')) {
    return isEn ? 'Too many attempts. Try again in a few minutes.' : 'Trop de tentatives. Réessaie dans quelques minutes.';
  }
  if (m.includes('weak password') || m.includes('password should')) {
    return isEn ? 'Password too weak (minimum 6 characters)' : 'Mot de passe trop faible (minimum 6 caractères)';
  }
  return msg;
}

const SITE_URL = typeof window !== 'undefined' ? window.location.origin : 'https://visionaffichage.com';

async function fetchProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, title')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as { id: string; email: string; full_name: string | null; role: UserRole; title: string | null };
}

// Emails that ALWAYS resolve to the president role, regardless of what
// the profiles table says. This is the owner's failsafe: even if the
// profile row is stale (e.g. mistakenly set to 'client' by an admin
// action), Frederick stays in control of the site.
const PRESIDENT_EMAILS = new Set<string>([
  'contact@fredbouchard.ca',
]);

function buildUser(authUser: { id: string; email?: string }, profile: Awaited<ReturnType<typeof fetchProfile>>): AuthUser | null {
  const email = (profile?.email ?? authUser.email ?? '').toLowerCase();
  if (!email) return null;
  const name = profile?.full_name ?? email.split('@')[0];
  // Owner fallback: PRESIDENT_EMAILS beats whatever the profile row says.
  const role: UserRole = PRESIDENT_EMAILS.has(email)
    ? 'president'
    : (profile?.role ?? 'client');
  const title = profile?.title ?? (role === 'president' ? 'Président' : undefined);
  return {
    id: authUser.id,
    email,
    name,
    role,
    title,
    initials: toInitials(name),
  };
}

/** Best-effort upsert of the profile row after sign-in. Guarantees that
 * the owner's row exists and stays role='president' even if something
 * wiped it. RLS allows users to edit their own row (id = auth.uid()). */
async function syncOwnerProfile(authUser: { id: string; email?: string }, fullName?: string) {
  const email = (authUser.email ?? '').toLowerCase();
  if (!email) return;
  const isOwner = PRESIDENT_EMAILS.has(email);
  try {
    // Build the row: only force role when this is a known owner email,
    // otherwise we leave role untouched (don't overwrite legitimate
    // manual role assignments by admins).
    const row: Record<string, unknown> = {
      id: authUser.id,
      email,
      active: true,
    };
    if (fullName) row.full_name = fullName;
    if (isOwner) {
      row.role = 'president';
      row.title = 'Président';
    }
    await supabase.from('profiles').upsert(row, { onConflict: 'id' });
  } catch (e) {
    // Non-fatal: the user can still sign in; the email fallback in
    // buildUser covers the owner case.
    console.warn('[authStore] Could not upsert profile row on sign-in:', e);
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  error: null,
  loading: true,

  hydrateFromSession: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      // Keep the owner's profile row consistent every time we rehydrate
      // (first load, returning visit) — not just on manual sign-in.
      await syncOwnerProfile(session.user);
      const profile = await fetchProfile(session.user.id);
      const user = buildUser(session.user, profile);
      set({ user, loading: false });
    } else {
      set({ user: null, loading: false });
    }
  },

  signIn: async (email, password) => {
    set({ error: null });
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error || !data.user) {
      set({ error: friendlyError(error?.message ?? 'Connexion échouée') });
      return { ok: false };
    }
    // Ensure the profile row exists + owner role is correct. Runs
    // BEFORE fetchProfile so the subsequent read sees the corrected
    // state instead of stale data.
    await syncOwnerProfile(data.user);
    const profile = await fetchProfile(data.user.id);
    const user = buildUser(data.user, profile);
    set({ user, error: null });
    return { ok: true, role: user?.role };
  },

  signUp: async (email, password, name) => {
    set({ error: null });
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: { full_name: name.trim() },
        emailRedirectTo: `${SITE_URL}/admin/login`,
      },
    });
    if (error) {
      set({ error: friendlyError(error.message) });
      return { ok: false };
    }
    // Seed the profile row right away when we have a user. If the
    // project requires email confirmation, data.user is still returned
    // but the session isn't live yet — syncOwnerProfile writes are
    // idempotent so it's fine.
    if (data?.user) await syncOwnerProfile(data.user, name.trim());
    return { ok: true };
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null });
    // Wipe customer-scoped persisted state so the next user who signs in
    // on this browser doesn't inherit the previous session's cart / in-
    // progress customization / admin filters.
    try {
      const keys = ['va-customizer', 'vision-cart', 'shopify-cart', 'vision-pending-checkout', 'vision-recently-viewed', 'vision-wishlist'];
      keys.forEach(k => localStorage.removeItem(k));
    } catch (e) {
      console.warn('[authStore] Could not clear persisted stores on signOut:', e);
    }
  },

  sendPasswordReset: async (email) => {
    set({ error: null });
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${SITE_URL}/admin/reset-password`,
    });
    if (error) {
      set({ error: friendlyError(error.message) });
      return { ok: false };
    }
    return { ok: true };
  },

  updatePassword: async (newPassword) => {
    set({ error: null });
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      set({ error: friendlyError(error.message) });
      return { ok: false };
    }
    return { ok: true };
  },

  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),
}));

// Auto-hydrate + subscribe to auth changes so the store always reflects Supabase
if (typeof window !== 'undefined') {
  useAuthStore.getState().hydrateFromSession();
  supabase.auth.onAuthStateChange(async (_event, session) => {
    if (session?.user) {
      await syncOwnerProfile(session.user);
      const profile = await fetchProfile(session.user.id);
      const user = buildUser(session.user, profile);
      useAuthStore.setState({ user });
    } else {
      useAuthStore.setState({ user: null });
    }
  });
}
