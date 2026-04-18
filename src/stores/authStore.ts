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
  const m = msg.toLowerCase();
  if (m.includes('invalid login') || m.includes('invalid_credentials')) return 'Courriel ou mot de passe invalide';
  if (m.includes('email not confirmed')) return 'Confirme ton courriel avant de te connecter';
  if (m.includes('user already registered')) return 'Un compte existe déjà avec ce courriel';
  if (m.includes('rate limit')) return 'Trop de tentatives. Réessaie dans quelques minutes.';
  if (m.includes('weak password') || m.includes('password should')) return 'Mot de passe trop faible (minimum 6 caractères)';
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

function buildUser(authUser: { id: string; email?: string }, profile: Awaited<ReturnType<typeof fetchProfile>>): AuthUser | null {
  const email = (profile?.email ?? authUser.email ?? '').toLowerCase();
  if (!email) return null;
  const name = profile?.full_name ?? email.split('@')[0];
  // Hardcoded president fallback for the owner email if profile row hasn't been created yet
  const role: UserRole = profile?.role ?? (email === 'contact@fredbouchard.ca' ? 'president' : 'client');
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

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  error: null,
  loading: true,

  hydrateFromSession: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
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
    const profile = await fetchProfile(data.user.id);
    const user = buildUser(data.user, profile);
    set({ user, error: null });
    return { ok: true, role: user?.role };
  },

  signUp: async (email, password, name) => {
    set({ error: null });
    const { error } = await supabase.auth.signUp({
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
    return { ok: true };
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null });
    // Wipe customer-scoped persisted state so the next user who signs in
    // on this browser doesn't inherit the previous session's cart / in-
    // progress customization / admin filters.
    try {
      const keys = ['va-customizer', 'vision-cart', 'shopify-cart', 'vision-pending-checkout', 'vision-recently-viewed'];
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
      const profile = await fetchProfile(session.user.id);
      const user = buildUser(session.user, profile);
      useAuthStore.setState({ user });
    } else {
      useAuthStore.setState({ user: null });
    }
  });
}
