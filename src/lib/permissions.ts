// Role + permission matrix for the admin surface.
//
// The permission vocabulary is deliberately `resource:action` so we can
// grow it by appending new resources without renaming the existing ones.
// Components call hasPermission(role, perm, overrides) — the overrides
// list comes from localStorage and lets an admin grant/revoke individual
// permissions on top of the user's base role without having to invent a
// new role for every edge case.
//
// Note: the permission system's Role enum mirrors the auth store's
// UserRole — both now include 'salesman'. The Supabase profiles table
// still enforces a CHECK constraint, so the DB migration in
// supabase/migrations/0002_add_salesman_role.sql must be applied
// server-side before profile rows can persist role='salesman'.

import { readLS, writeLS } from './storage';

export type Permission =
  | 'orders:read' | 'orders:write'
  | 'customers:read' | 'customers:write'
  | 'products:read' | 'products:write'
  | 'vendors:read' | 'vendors:write'
  | 'quotes:read' | 'quotes:write'
  | 'settings:read' | 'settings:write'
  | 'emails:read' | 'emails:write'
  | 'images:read' | 'images:write'
  | 'automations:read' | 'automations:write'
  | 'users:read' | 'users:write'
  | 'billing:read' | 'billing:write';

export type Role = 'president' | 'admin' | 'salesman' | 'vendor' | 'client';

// Full catalogue in one place so the UI (permission matrix dialog) can
// render checkboxes without duplicating the list and drifting.
// Frozen at module load so a stray consumer can't mutate the catalogue
// mid-session (mirrors the pricing-tier freeze in ba33680 and the
// tax-rate freeze in 20d0b05). RBAC is the security source of truth —
// any push/splice on this array would silently expand or shrink every
// role's effective permission set.
export const ALL_PERMISSIONS: readonly Permission[] = Object.freeze<Permission[]>([
  'orders:read', 'orders:write',
  'customers:read', 'customers:write',
  'products:read', 'products:write',
  'vendors:read', 'vendors:write',
  'quotes:read', 'quotes:write',
  'settings:read', 'settings:write',
  'emails:read', 'emails:write',
  'images:read', 'images:write',
  'automations:read', 'automations:write',
  'users:read', 'users:write',
  'billing:read', 'billing:write',
]);

export const ROLE_LABEL: Record<Role, string> = {
  president: 'Président',
  admin: 'Admin',
  salesman: 'Vendeur interne',
  vendor: 'Fournisseur',
  client: 'Client',
};

// Human-readable description used in the permission dialog header so
// admins understand what each role gets by default before they start
// toggling overrides.
export const ROLE_DESCRIPTION: Record<Role, string> = {
  president: 'Contrôle total, incluant la facturation.',
  admin: 'Tout sauf la facturation.',
  salesman: 'Commandes, clients, produits (lecture) et soumissions.',
  vendor: 'Ses propres soumissions et bons de commande uniquement.',
  client: 'Ses propres commandes uniquement.',
};

// Default permission catalogue per role.
// Keep this table side-by-side with the product requirements so future
// reviewers can verify each role's scope at a glance.
//
// Deep-frozen at module load: the outer Record AND each role's array are
// immutable, so neither `ROLE_PERMISSIONS.admin = []` nor
// `ROLE_PERMISSIONS.client.push('billing:write')` can corrupt the matrix
// mid-session. RBAC is the security source-of-truth here — mutating the
// table would silently grant or revoke permissions on every subsequent
// hasPermission() call. Mirrors the freeze pattern from pricing.ts
// (ba33680) and tax.ts (20d0b05); the readonly type tightening makes the
// same guarantee a compile-time error rather than just a runtime no-op.
export const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> =
  Object.freeze({
    // President = everything. Don't hand-roll the list — reuse ALL_PERMISSIONS
    // so adding a new permission type automatically grants it.
    president: Object.freeze<Permission[]>([...ALL_PERMISSIONS]),

    // Admin = everything EXCEPT billing. Rationale: billing routes to the
    // company bank account / Stripe keys, which should stay with the
    // owner even if the owner hires more admins.
    admin: Object.freeze(ALL_PERMISSIONS.filter(p => !p.startsWith('billing:'))),

    // Salesman = read/write customer-facing flow, read-only on the
    // catalog, no access to platform plumbing (settings/users/emails
    // composition/automations/billing).
    salesman: Object.freeze<Permission[]>([
      'orders:read', 'orders:write',
      'customers:read', 'customers:write',
      'products:read',
      'quotes:read', 'quotes:write',
      'emails:read',
      'images:read',
      'automations:read',
      'vendors:read',
    ]),

    // Vendor = extremely limited; they only see their own quotes + the
    // vendor dashboard. The "own only" scoping is enforced by the
    // queries themselves (e.g. RLS, or the vendor dashboard filtering
    // by vendor_id); this table only answers "can they hit the endpoint
    // at all".
    vendor: Object.freeze<Permission[]>(['vendors:read', 'quotes:read']),

    // Client = public-storefront users with an account. They can read
    // their own orders (track page). Everything else stays locked.
    client: Object.freeze<Permission[]>(['orders:read']),
  });

/**
 * Check whether a user with `userRole` is allowed to perform `perm`.
 * Overrides are additive/subtractive: if the override list contains a
 * permission, it's granted regardless of role; if it contains a negated
 * form (prefixed with `!`), it's revoked regardless of role.
 *
 * The negated form lets admins revoke a default role permission for one
 * specific user without having to invent a new role for them. We can't
 * just omit the permission from the list — the absence of a permission
 * means "fall through to role default", not "deny".
 */
export function hasPermission(
  userRole: Role,
  perm: Permission,
  overrides?: Permission[] | Array<Permission | `!${Permission}`>,
): boolean {
  if (overrides && overrides.length > 0) {
    // Explicit revoke wins over grant wins over role default — scan
    // once, noting both signals, then decide. Without this ordering a
    // user who has both a revoke entry (from an older admin action)
    // and a grant entry (from a newer one) would flip-flop based on
    // array order, which is brittle.
    let granted = false;
    let revoked = false;
    for (const entry of overrides) {
      if (entry === `!${perm}`) revoked = true;
      else if (entry === perm) granted = true;
    }
    if (revoked) return false;
    if (granted) return true;
  }
  const defaults = ROLE_PERMISSIONS[userRole];
  if (!defaults) return false;
  return defaults.includes(perm);
}

// localStorage key + helpers for per-user overrides. Exported so the
// AdminUsers dialog and RequirePermission both read from the same key
// without duplicating the string.
export const OVERRIDES_STORAGE_KEY = 'vision-permission-overrides';

export type OverrideMap = Record<string, Permission[]>;

// Pre-computed set of valid permission strings, including the `!`-prefixed
// revoke form that hasPermission accepts. Used by loadOverrides to drop
// unknown entries instead of trusting whatever was in localStorage. Built
// once at module load — ALL_PERMISSIONS is constant.
const VALID_OVERRIDE_ENTRIES: ReadonlySet<string> = new Set<string>([
  ...ALL_PERMISSIONS,
  ...ALL_PERMISSIONS.map(p => `!${p}`),
]);

export function loadOverrides(): OverrideMap {
  // Defensive: localStorage can throw in private mode, return
  // malformed JSON from a legacy build, or return a non-object from
  // a rogue extension. readLS handles parse + corrupted-entry failures;
  // any failure here falls through to 'no overrides' so the app falls
  // back to pure role defaults instead of crashing the permission guard
  // and locking the admin out of their own page.
  const parsed = readLS<unknown>(OVERRIDES_STORAGE_KEY, {});
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  const cleaned: OverrideMap = {};
  for (const [userId, perms] of Object.entries(parsed as Record<string, unknown>)) {
    // Reject empty/non-string keys — a bad userId would silently grant or
    // revoke the wrong account, far worse than dropping a malformed row.
    if (!userId || typeof userId !== 'string') continue;
    if (!Array.isArray(perms)) continue;
    // Validate each entry against the known permission catalogue (including
    // the `!`-prefixed revoke form). Previously we kept any string, which
    // meant a stale rename ('orders:edit' → 'orders:write'), a typo from a
    // hand-edited devtools session, or a key from an unrelated app reusing
    // the storage namespace would leak through and quietly do nothing — but
    // also bloat the saved map and confuse the AdminUsers permissions
    // dialog when it round-tripped the unknown entries back to disk.
    const valid = perms.filter(
      (p): p is Permission =>
        typeof p === 'string' && VALID_OVERRIDE_ENTRIES.has(p),
    ) as Permission[];
    cleaned[userId] = valid;
  }
  return cleaned;
}

export function saveOverrides(map: OverrideMap): void {
  // Private mode / quota exceeded — writeLS swallows and returns false.
  // Callers don't care about the boolean (best-effort persistence), so
  // we just fire-and-forget. A toast here would be nice but this
  // module shouldn't import toast (keep it pure).
  writeLS(OVERRIDES_STORAGE_KEY, map);
}

export function getUserOverrides(userId: string | undefined | null): Permission[] {
  if (!userId) return [];
  return loadOverrides()[userId] ?? [];
}

// UserRole (authStore) and Role (this module) are now identical, so
// this is effectively a pass-through. Kept as a function rather than
// deleted so callers importing coerceToPermissionRole still compile and
// so we retain the defensive "unknown string → 'client'" fallback for
// any legacy/malformed DB rows that somehow slip past coerceRole in
// authStore.
export function coerceToPermissionRole(raw: string | null | undefined): Role {
  if (raw === 'president' || raw === 'admin' || raw === 'salesman' ||
      raw === 'vendor' || raw === 'client') {
    return raw;
  }
  return 'client';
}
