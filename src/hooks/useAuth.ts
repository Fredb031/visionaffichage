import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';

export type UserRole = 'president' | 'admin' | 'vendor' | 'client';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  title: string | null;
  active: boolean;
}

export interface AuthState {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
}

const SITE_URL = typeof window !== 'undefined' ? window.location.origin : 'https://visionaffichage.com';

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    loading: true,
    error: null,
  });

  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, title, active')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      console.error('fetchProfile error:', error);
      return null;
    }
    return data as Profile | null;
  }, []);

  useEffect(() => {
    let mounted = true;

    // Initial session check
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        if (!mounted) return;
        setState({ user: session.user, profile, loading: false, error: null });
      } else {
        setState({ user: null, profile: null, loading: false, error: null });
      }
    })();

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        if (!mounted) return;
        setState({ user: session.user, profile, loading: false, error: null });
      } else {
        setState({ user: null, profile: null, loading: false, error: null });
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    setState(s => ({ ...s, error: null }));
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) {
      setState(s => ({ ...s, error: friendlyError(error.message) }));
      return { ok: false };
    }
    return { ok: true };
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName?: string) => {
    setState(s => ({ ...s, error: null }));
    const { error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${SITE_URL}/admin/login`,
      },
    });
    if (error) {
      setState(s => ({ ...s, error: friendlyError(error.message) }));
      return { ok: false };
    }
    return { ok: true };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    setState(s => ({ ...s, error: null }));
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${SITE_URL}/admin/reset-password`,
    });
    if (error) {
      setState(s => ({ ...s, error: friendlyError(error.message) }));
      return { ok: false };
    }
    return { ok: true };
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    setState(s => ({ ...s, error: null }));
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setState(s => ({ ...s, error: friendlyError(error.message) }));
      return { ok: false };
    }
    return { ok: true };
  }, []);

  const clearError = useCallback(() => setState(s => ({ ...s, error: null })), []);

  return {
    ...state,
    signIn,
    signUp,
    signOut,
    sendPasswordReset,
    updatePassword,
    clearError,
    isAdmin: state.profile?.role === 'admin' || state.profile?.role === 'president',
    isPresident: state.profile?.role === 'president',
    isVendor: state.profile?.role === 'vendor' || state.profile?.role === 'admin' || state.profile?.role === 'president',
  };
}

function friendlyError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('invalid login') || m.includes('invalid_credentials')) {
    return 'Courriel ou mot de passe invalide';
  }
  if (m.includes('email not confirmed')) return 'Confirme ton courriel avant de te connecter';
  if (m.includes('user already registered')) return 'Un compte existe déjà avec ce courriel';
  if (m.includes('rate limit')) return 'Trop de tentatives. Réessaie dans quelques minutes.';
  if (m.includes('weak password') || m.includes('password should')) return 'Mot de passe trop faible (minimum 6 caractères)';
  return msg;
}
