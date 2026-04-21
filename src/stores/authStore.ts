import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { normalizeInvisible } from '@/lib/utils';

// Strip zero-width + control chars, lowercase, and trim. Used before
// handing an email off to Supabase so a paste from Slack/Notion (which
// often drags ZWSP along) doesn't return a confusing "invalid credentials"
// rejection for a correct-looking address.
function normalizeEmail(email: string): string {
  return normalizeInvisible(email).trim().toLowerCase();
}

export type UserRole = 'president' | 'admin' | 'salesman' | 'vendor' | 'client';

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

// --- Client-side signIn rate limiting (Task 14.5) ---
// Supabase handles real server-side rate limiting; this is belt-and-
// suspenders UX that prevents casual brute-force + accidental double-
// submits from spamming the auth endpoint. 5 failures in 5 minutes
// triggers a 30s lockout per email. Success clears the counter.
const RATE_LIMIT_KEY = 'vision-auth-attempts';
const RATE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const RATE_MAX_ATTEMPTS = 5;
const RATE_LOCKOUT_MS = 30 * 1000; // 30 seconds

interface AttemptEntry {
  count: number;
  firstAt: number;
  lockedUntil?: number;
}
type AttemptMap = Record<string, AttemptEntry>;

function readAttempts(): AttemptMap {
  try {
    const raw = localStorage.getItem(RATE_LIMIT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object') ? parsed as AttemptMap : {};
  } catch {
    return {};
  }
}

function writeAttempts(map: AttemptMap): void {
  try {
    localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(map));
  } catch { /* private mode / quota */ }
}

/** How many seconds remain on the lockout for this email, or 0 if unlocked. */
export function getSignInLockoutRemaining(email: string): number {
  const key = normalizeEmail(email);
  if (!key) return 0;
  const map = readAttempts();
  const entry = map[key];
  if (!entry?.lockedUntil) return 0;
  const remaining = entry.lockedUntil - Date.now();
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}

function clearAttempts(key: string): void {
  const map = readAttempts();
  if (map[key]) {
    delete map[key];
    writeAttempts(map);
  }
}

function recordFailure(key: string): void {
  const now = Date.now();
  const map = readAttempts();
  const existing = map[key];
  // Reset the window if it expired, otherwise keep accumulating.
  if (!existing || (now - existing.firstAt) > RATE_WINDOW_MS) {
    map[key] = { count: 1, firstAt: now };
  } else {
    existing.count += 1;
    if (existing.count >= RATE_MAX_ATTEMPTS) {
      existing.lockedUntil = now + RATE_LOCKOUT_MS;
    }
    map[key] = existing;
  }
  writeAttempts(map);
}

function lockoutMessage(seconds: number): string {
  let isEn = false;
  try { isEn = localStorage.getItem('vision-lang') === 'en'; } catch { /* private mode */ }
  return isEn
    ? `Too many attempts. Try again in ${seconds} seconds.`
    : `Trop de tentatives. Réessaie dans ${seconds} secondes.`;
}

async function fetchProfile(userId: string) {
  // Retry with exponential backoff on actual errors (network blip, 5xx,
  // RLS reconfiguration in-flight). A missing row is NOT an error —
  // maybeSingle() returns { data: null, error: null } for that case
  // and we should not waste time/retries on a legitimate "no profile
  // yet" outcome. Without this, a transient 500 on page load silently
  // downgrades an admin to 'client' until they hard-refresh.
  const delays = [0, 250, 750];
  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt] > 0) await new Promise(r => setTimeout(r, delays[attempt]));
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, title')
      .eq('id', userId)
      .maybeSingle();
    if (!error) return (data as { id: string; email: string; full_name: string | null; role: UserRole; title: string | null } | null) ?? null;
    if (attempt === delays.length - 1) {
      console.warn('[authStore] fetchProfile gave up after retries:', error.message);
      return null;
    }
  }
  return null;
}

// Emails that ALWAYS resolve to the president role, regardless of what
// the profiles table says. This is the owner's failsafe: even if the
// profile row is stale (e.g. mistakenly set to 'client' by an admin
// action), Frederick stays in control of the site.
//
// Exported so Signup.tsx etc. can reference the same source of truth
// instead of hardcoding the address again and drifting out of sync.
export const PRESIDENT_EMAILS = new Set<string>([
  'contact@fredbouchard.ca',
]);

/** Check if a candidate email matches a known president. Uses the
 * same normalization pipeline as normalizeEmail so a Slack paste
 * with a ZWSP still matches. */
export function isPresidentEmailCandidate(raw: string): boolean {
  return PRESIDENT_EMAILS.has(normalizeEmail(raw));
}

const VALID_ROLES: readonly UserRole[] = ['president', 'admin', 'salesman', 'vendor', 'client'];
function coerceRole(raw: unknown): UserRole {
  return typeof raw === 'string' && (VALID_ROLES as readonly string[]).includes(raw)
    ? (raw as UserRole)
    : 'client';
}

function buildUser(authUser: { id: string; email?: string }, profile: Awaited<ReturnType<typeof fetchProfile>>): AuthUser | null {
  const email = (profile?.email ?? authUser.email ?? '').toLowerCase();
  if (!email) return null;
  const name = profile?.full_name ?? email.split('@')[0];
  // Owner fallback: PRESIDENT_EMAILS beats whatever the profile row says.
  // Also coerce the profile role to a valid enum value — the DB column
  // could have a legacy/manual row with e.g. 'staff' that would then
  // leak through fetchProfile's type assertion and break downstream
  // role checks that assume the UserRole union.
  const role: UserRole = PRESIDENT_EMAILS.has(email)
    ? 'president'
    : coerceRole(profile?.role);
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
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // Keep the owner's profile row consistent every time we rehydrate
        // (first load, returning visit) — not just on manual sign-in.
        await syncOwnerProfile(session.user);
        const profile = await fetchProfile(session.user.id);
        const user = buildUser(session.user, profile);
        set({ user });
      } else {
        set({ user: null });
      }
    } catch (e) {
      // Network failure, Supabase down, RLS change — any of these would
      // throw and leave loading stuck at true, which in turn leaves
      // every AuthGuard-wrapped admin/vendor page showing a forever-
      // spinning skeleton. Treat the failure as 'no session' so at
      // least the login page renders.
      console.error('[authStore] hydrateFromSession failed:', e);
      set({ user: null });
    } finally {
      set({ loading: false });
    }
  },

  signIn: async (email, password) => {
    set({ error: null });
    const normalized = normalizeEmail(email);
    // Client-side rate limit (Task 14.5). Check BEFORE hitting Supabase
    // so a locked-out user doesn't burn server quota during the 30s
    // cooldown window.
    const lockRemaining = getSignInLockoutRemaining(normalized);
    if (lockRemaining > 0) {
      set({ error: lockoutMessage(lockRemaining) });
      return { ok: false };
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalized,
      password,
    });
    if (error || !data.user) {
      // Record the failure for throttling BEFORE surfacing the message
      // so the next attempt sees the incremented counter.
      recordFailure(normalized);
      // Re-check lockout: if this failure just tripped the threshold,
      // show the lockout copy immediately instead of the generic
      // "invalid credentials" one.
      const remaining = getSignInLockoutRemaining(normalized);
      if (remaining > 0) {
        set({ error: lockoutMessage(remaining) });
        return { ok: false };
      }
      // Default error uses its own lang detection (localStorage 'vision-lang')
      // since friendlyError's fallback-through returns the input unchanged
      // and hardcoding French here would flash French to English users.
      let isEn = false;
      try { isEn = localStorage.getItem('vision-lang') === 'en'; } catch { /* private mode */ }
      const fallback = isEn ? 'Sign-in failed' : 'Connexion échouée';
      set({ error: friendlyError(error?.message ?? fallback) });
      return { ok: false };
    }
    // Success: wipe the counter for this email so a previously-troubled
    // user starts fresh.
    clearAttempts(normalized);
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
    // Strip invisibles on the name for the same reason as the email
    // path — a Slack/Notion paste could carry a ZWSP that nobody can
    // see but which lives in the Supabase auth user_metadata + the
    // profiles row forever and breaks strict name comparisons later.
    const cleanName = normalizeInvisible(name).trim();
    const { data, error } = await supabase.auth.signUp({
      email: normalizeEmail(email),
      password,
      options: {
        data: { full_name: cleanName },
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
    if (data?.user) await syncOwnerProfile(data.user, cleanName);
    return { ok: true };
  },

  signOut: async () => {
    // Try Supabase first, but always clear local state afterward — if
    // Supabase is unreachable we still want the UI to reflect 'signed out'
    // for this session, otherwise the user sees their avatar + dashboard
    // links on the navbar even though they just clicked 'Sign out'.
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('[authStore] supabase.auth.signOut failed; clearing local state anyway:', e);
    }
    set({ user: null });
    // Wipe customer-scoped AND admin/vendor-scoped persisted state so the
    // next user on this browser doesn't inherit the previous session's
    // cart, in-progress customization, saved quotes, AI API keys, or
    // custom vendor list. API keys are the most sensitive of these —
    // a shared admin browser would otherwise leak the previous user's
    // Replicate/OpenAI credentials into the next admin's settings page.
    try {
      const keys = [
        'va-customizer', 'vision-cart', 'shopify-cart',
        'vision-pending-checkout', 'vision-recently-viewed', 'vision-wishlist',
        'vision-quotes', 'vision-quotes-seq',
        'vision-shipped-orders', 'vision-vendors',
        'vision-image-provider', 'vision-image-key-replicate', 'vision-image-key-openai',
        'vision-admin-settings',
      ];
      keys.forEach(k => localStorage.removeItem(k));
    } catch (e) {
      console.warn('[authStore] Could not clear persisted stores on signOut:', e);
    }
    // Also wipe sessionStorage entries so the AIChat transcript and any
    // future session-scoped admin caches don't leak across sign-out
    // boundaries on a shared browser.
    try {
      sessionStorage.removeItem('vision-aichat-transcript');
    } catch (e) {
      console.warn('[authStore] Could not clear sessionStorage on signOut:', e);
    }
    // Reset the stores' IN-MEMORY state too. localStorage.removeItem
    // clears the persisted payload but Zustand keeps its current
    // in-memory state until next hydration (which only happens on
    // page reload). Without this, the user signs out and the navbar
    // avatar disappears but the cart badge still shows items + the
    // customizer still has their in-progress logo. Dynamic imports
    // avoid top-level circular deps with cartStore/localCartStore.
    try {
      const [{ useCartStore: useLocalCart }, { useCartStore: useShopifyCart }, { useCustomizerStore }] = await Promise.all([
        import('@/stores/localCartStore'),
        import('@/stores/cartStore'),
        import('@/stores/customizerStore'),
      ]);
      useLocalCart.getState().clear();
      useShopifyCart.getState().clearCart();
      useCustomizerStore.getState().reset();
    } catch (e) {
      console.warn('[authStore] Could not reset in-memory stores on signOut:', e);
    }
  },

  sendPasswordReset: async (email) => {
    set({ error: null });
    const { error } = await supabase.auth.resetPasswordForEmail(normalizeEmail(email), {
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
    // Wrap the whole subscriber in try/catch. syncOwnerProfile and
    // fetchProfile can both reject on network/RLS changes — an
    // unhandled rejection from this callback used to surface as
    // "Uncaught (in promise)" noise in the console, and on some
    // supabase-js versions a throw here breaks the subscription
    // (no subsequent auth events fire until page reload).
    try {
      if (session?.user) {
        await syncOwnerProfile(session.user);
        const profile = await fetchProfile(session.user.id);
        const user = buildUser(session.user, profile);
        useAuthStore.setState({ user });
      } else {
        useAuthStore.setState({ user: null });
      }
    } catch (err) {
      console.error('[authStore] onAuthStateChange handler failed:', err);
      // Keep the existing user state — a transient error shouldn't
      // sign the user out mid-session. If the session itself became
      // invalid, the next event will fire with session=null and
      // the else branch above will clear user properly.
    }
  });
}
