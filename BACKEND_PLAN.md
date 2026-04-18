# Backend Plan — Vision Affichage

Comprehensive backend roadmap to make admin/vendor/client access 100% functional, persistent, and secure. Built on Supabase (already wired in repo).

---

## 1. Supabase Schema (SQL — run in Supabase Studio)

### `profiles` (extends `auth.users`)
```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  role text not null check (role in ('president','admin','vendor','client')) default 'client',
  title text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  invited_by uuid references public.profiles(id),
  metadata jsonb default '{}'::jsonb
);

-- Auto-create profile on user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- President bootstrap (only contact@fredbouchard.ca starts as president)
create or replace function public.bootstrap_president()
returns trigger as $$
begin
  if new.email = 'contact@fredbouchard.ca' then
    update public.profiles set role = 'president', title = 'Président'
    where id = new.id;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_president_signup
  after insert on public.profiles
  for each row execute function public.bootstrap_president();
```

### `quotes` + `quote_items`
```sql
create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  vendor_id uuid not null references public.profiles(id),
  client_email text not null,
  client_name text,
  client_company text,
  status text not null check (status in ('draft','sent','viewed','accepted','paid','expired','cancelled')) default 'draft',
  subtotal numeric(10,2) not null default 0,
  discount_kind text check (discount_kind in ('percent','flat')),
  discount_value numeric(10,2),
  tax numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  currency text not null default 'CAD',
  notes text,
  client_logo_url text,
  terms_accepted boolean default false,
  sent_at timestamptz,
  viewed_at timestamptz,
  accepted_at timestamptz,
  paid_at timestamptz,
  expires_at timestamptz,
  shopify_order_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  product_sku text not null,
  product_name text not null,
  product_image text,
  color text,
  size text,
  quantity integer not null default 1,
  unit_price numeric(10,2) not null,
  placement_zones text[],
  placement_note text,
  created_at timestamptz not null default now()
);
```

### `vendor_invites`
```sql
create table public.vendor_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  full_name text not null,
  role text not null check (role in ('admin','vendor')) default 'vendor',
  invited_by uuid not null references public.profiles(id),
  token text not null unique,
  used_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now()
);
```

### Row Level Security (RLS)
```sql
alter table public.profiles enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
alter table public.vendor_invites enable row level security;

-- Profiles: anyone can read own; admin/president can read all
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Admins read all profiles" on public.profiles
  for select using (
    exists (select 1 from public.profiles
            where id = auth.uid() and role in ('admin','president'))
  );

create policy "Admins update profiles" on public.profiles
  for update using (
    exists (select 1 from public.profiles
            where id = auth.uid() and role in ('admin','president'))
  );

-- Quotes: vendors read own; admin/president read all; clients read by token via edge function
create policy "Vendors read own quotes" on public.quotes
  for select using (vendor_id = auth.uid());

create policy "Admins read all quotes" on public.quotes
  for select using (
    exists (select 1 from public.profiles
            where id = auth.uid() and role in ('admin','president'))
  );

create policy "Vendors create quotes" on public.quotes
  for insert with check (vendor_id = auth.uid());

create policy "Vendors update own quotes" on public.quotes
  for update using (vendor_id = auth.uid());

-- Same pattern for quote_items via parent quote
create policy "Vendors read own quote items" on public.quote_items
  for select using (
    exists (select 1 from public.quotes q
            where q.id = quote_id and q.vendor_id = auth.uid())
  );

-- vendor_invites: only admin/president
create policy "Admins manage invites" on public.vendor_invites
  for all using (
    exists (select 1 from public.profiles
            where id = auth.uid() and role in ('admin','president'))
  );
```

---

## 2. React-side Auth (Supabase Auth)

### `useAuth` hook (replaces dev-account authStore)
- Listens to `supabase.auth.onAuthStateChange`
- Exposes `user`, `profile` (joined with role), `signIn`, `signUp`, `signOut`, `resetPassword`, `updatePassword`
- Persists session via Supabase's localStorage automatically

### Pages
- `/admin/login` → `supabase.auth.signInWithPassword`
- `/admin/forgot-password` → `supabase.auth.resetPasswordForEmail` with redirect to `/admin/reset-password`
- `/admin/reset-password` → `supabase.auth.updateUser({ password })` (uses recovery token in URL)
- `/admin/accept-invite/:token` → validates token, lets user set password

### AuthGuard updates
- Reads role from `profiles` table joined with current user
- President bypass already in place

---

## 3. Admin Functions (require service role → edge function)

### `admin-invite-vendor` edge function
Takes `{ email, full_name, role }`. Server-side:
1. Generate invite token (UUID)
2. Insert into `vendor_invites`
3. Send email via Supabase Auth `admin.inviteUserByEmail` OR Resend API
4. Return success

### `admin-update-role` edge function
Takes `{ user_id, new_role }`. Verifies caller is admin/president, updates profile.

### `admin-deactivate-user` edge function
Takes `{ user_id }`. Sets `active = false`. Optionally calls `supabase.auth.admin.updateUserById(id, { ban_duration: 'forever' })`.

---

## 4. Migrate localStorage data → Supabase

- **Quotes**: `vendor-quotes` localStorage → `quotes` + `quote_items` tables
- **Vendors**: `vision-vendors` localStorage → `profiles` (managed via invite flow)
- **Shipped orders**: `vision-shipped-orders` → eventually a `fulfillments` table

For now: keep localStorage as offline cache, sync to Supabase on save. Real-time sync via Supabase realtime.

---

## 5. Implementation order

1. ✅ Fix env var name (`VITE_SUPABASE_PUBLISHABLE_KEY`)
2. Run SQL migration in Supabase Studio
3. Build `useAuth` hook
4. Replace `authStore` calls with `useAuth`
5. Wire `AdminLogin` to real Supabase auth
6. Build `/admin/forgot-password` + `/admin/reset-password`
7. Build invite edge function
8. Build `/admin/accept-invite/:token`
9. Wire AdminVendors invite to real flow
10. Migrate quotes to Supabase
11. Add `/admin/users` page (list, role change, deactivate)
12. Email integration (Resend) for transactional emails
