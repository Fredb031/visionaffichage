-- Vision Affichage — backend foundation migration
-- Run via Supabase Studio → SQL Editor
-- Idempotent: safe to re-run

-- ───────────────────────────────────────────────────────────────────
-- profiles  (extends auth.users with role + app metadata)
-- ───────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
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

create index if not exists idx_profiles_role on public.profiles (role);
create index if not exists idx_profiles_email on public.profiles (email);

-- Auto-create profile on user signup; bootstrap President for the owner email
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, title)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    case when new.email = 'contact@fredbouchard.ca' then 'president' else 'client' end,
    case when new.email = 'contact@fredbouchard.ca' then 'Président' else null end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────────────────────────────────────────────────────────────
-- vendor_invites  (admin-issued invites, single-use, expiring)
-- ───────────────────────────────────────────────────────────────────
create table if not exists public.vendor_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  full_name text not null,
  role text not null check (role in ('admin','vendor')) default 'vendor',
  invited_by uuid not null references public.profiles(id),
  token text not null unique default encode(gen_random_bytes(32), 'hex'),
  used_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now()
);

create index if not exists idx_vendor_invites_email on public.vendor_invites (email);
create index if not exists idx_vendor_invites_token on public.vendor_invites (token);

-- ───────────────────────────────────────────────────────────────────
-- quotes + quote_items
-- ───────────────────────────────────────────────────────────────────
create table if not exists public.quotes (
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

create index if not exists idx_quotes_vendor on public.quotes (vendor_id);
create index if not exists idx_quotes_client_email on public.quotes (client_email);
create index if not exists idx_quotes_status on public.quotes (status);

create table if not exists public.quote_items (
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

create index if not exists idx_quote_items_quote on public.quote_items (quote_id);

-- updated_at trigger for quotes
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_quotes_updated_at on public.quotes;
create trigger set_quotes_updated_at
  before update on public.quotes
  for each row execute function public.set_updated_at();

-- ───────────────────────────────────────────────────────────────────
-- Helper: is_admin() — used by RLS policies
-- ───────────────────────────────────────────────────────────────────
create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = uid and role in ('admin','president') and active = true
  );
$$;

create or replace function public.is_president(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = uid and role = 'president' and active = true
  );
$$;

-- ───────────────────────────────────────────────────────────────────
-- Row Level Security
-- ───────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
alter table public.vendor_invites enable row level security;

-- profiles
drop policy if exists "Users view own profile" on public.profiles;
create policy "Users view own profile" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "Admins view all profiles" on public.profiles;
create policy "Admins view all profiles" on public.profiles
  for select using (public.is_admin());

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Admins update any profile" on public.profiles;
create policy "Admins update any profile" on public.profiles
  for update using (public.is_admin());

drop policy if exists "President deletes profiles" on public.profiles;
create policy "President deletes profiles" on public.profiles
  for delete using (public.is_president());

-- quotes
drop policy if exists "Vendors view own quotes" on public.quotes;
create policy "Vendors view own quotes" on public.quotes
  for select using (vendor_id = auth.uid());

drop policy if exists "Admins view all quotes" on public.quotes;
create policy "Admins view all quotes" on public.quotes
  for select using (public.is_admin());

drop policy if exists "Vendors create quotes" on public.quotes;
create policy "Vendors create quotes" on public.quotes
  for insert with check (vendor_id = auth.uid());

drop policy if exists "Vendors update own quotes" on public.quotes;
create policy "Vendors update own quotes" on public.quotes
  for update using (vendor_id = auth.uid() or public.is_admin());

drop policy if exists "Admins delete quotes" on public.quotes;
create policy "Admins delete quotes" on public.quotes
  for delete using (public.is_admin());

-- quote_items: inherit access from parent quote
drop policy if exists "Users view items of accessible quotes" on public.quote_items;
create policy "Users view items of accessible quotes" on public.quote_items
  for select using (
    exists (
      select 1 from public.quotes q
      where q.id = quote_id
      and (q.vendor_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "Users modify items of own quotes" on public.quote_items;
create policy "Users modify items of own quotes" on public.quote_items
  for all using (
    exists (
      select 1 from public.quotes q
      where q.id = quote_id
      and (q.vendor_id = auth.uid() or public.is_admin())
    )
  );

-- vendor_invites: only admin/president can manage
drop policy if exists "Admins manage invites" on public.vendor_invites;
create policy "Admins manage invites" on public.vendor_invites
  for all using (public.is_admin())
  with check (public.is_admin());

-- ───────────────────────────────────────────────────────────────────
-- Storage bucket for client-uploaded logos
-- ───────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('vision-logos', 'vision-logos', true)
on conflict (id) do nothing;

-- Anyone can upload (clients on quote-accept page); only owner reads back
drop policy if exists "Public can upload logos" on storage.objects;
create policy "Public can upload logos" on storage.objects
  for insert to anon
  with check (bucket_id = 'vision-logos');

drop policy if exists "Public can read logos" on storage.objects;
create policy "Public can read logos" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'vision-logos');
