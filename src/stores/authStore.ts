import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserRole = 'president' | 'admin' | 'vendor' | 'client';

export interface AuthUser {
  email: string;
  name: string;
  role: UserRole;
  initials: string;
  title?: string;
}

interface AuthState {
  user: AuthUser | null;
  error: string | null;
  signIn: (email: string, password: string) => { ok: boolean; role?: UserRole };
  signUp: (email: string, password: string, name: string) => { ok: boolean };
  signOut: () => void;
  clearError: () => void;
}

// Dev accounts — replace with Supabase Auth wiring when credentials provided.
// These let the full role-based UI flow be tested end-to-end without a backend.
const DEV_ACCOUNTS: Record<string, { password: string; role: UserRole; name: string; title?: string }> = {
  // Owner / ultimate admin — full access to everything
  'contact@fredbouchard.ca':    { password: 'president', role: 'president', name: 'Frederick Bouchard', title: 'Président' },
  'admin@visionaffichage.com':  { password: 'admin123', role: 'admin',  name: 'Frederick Bouchard' },
  'sophie@visionaffichage.com': { password: 'vendeur123', role: 'vendor', name: 'Sophie Tremblay' },
  'marc@visionaffichage.com':   { password: 'vendeur123', role: 'vendor', name: 'Marc-André Pelletier' },
};

function toInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      error: null,

      signIn: (email, password) => {
        const key = email.trim().toLowerCase();
        const account = DEV_ACCOUNTS[key];
        if (account && account.password === password) {
          const user: AuthUser = {
            email: key,
            name: account.name,
            role: account.role,
            initials: toInitials(account.name),
            title: account.title,
          };
          set({ user, error: null });
          return { ok: true, role: account.role };
        }
        // Any valid-looking email+password that's not admin/vendor becomes a client.
        if (/^[^@]+@[^@]+\.[^@]+$/.test(key) && password.length >= 6) {
          const user: AuthUser = {
            email: key,
            name: key.split('@')[0],
            role: 'client',
            initials: toInitials(key.split('@')[0]),
          };
          set({ user, error: null });
          return { ok: true, role: 'client' };
        }
        set({ error: 'Courriel ou mot de passe invalide' });
        return { ok: false };
      },

      signUp: (email, password, name) => {
        const key = email.trim().toLowerCase();
        if (!/^[^@]+@[^@]+\.[^@]+$/.test(key)) {
          set({ error: 'Courriel invalide' });
          return { ok: false };
        }
        if (password.length < 6) {
          set({ error: 'Mot de passe trop court (minimum 6 caractères)' });
          return { ok: false };
        }
        const user: AuthUser = {
          email: key,
          name: name.trim() || key.split('@')[0],
          role: 'client',
          initials: toInitials(name.trim() || key.split('@')[0]),
        };
        set({ user, error: null });
        return { ok: true };
      },

      signOut: () => set({ user: null, error: null }),
      clearError: () => set({ error: null }),
    }),
    { name: 'vision-auth' },
  ),
);
