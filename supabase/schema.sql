-- Margen Claro Almacén · Fase 4 Starter
-- Ejecuta este script en el SQL Editor de tu proyecto Supabase.

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan text not null default 'Pro',
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  full_name text,
  role text not null default 'admin',
  created_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  segment text,
  owner_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  client_name text,
  analysis_name text not null,
  params_json jsonb not null,
  products_json jsonb not null,
  summary_json jsonb not null,
  saved_by uuid references auth.users(id) on delete set null,
  saved_at timestamptz not null default now()
);

alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.analyses enable row level security;

create or replace function public.current_company_id()
returns uuid
language sql
stable
as $$
  select company_id from public.profiles where id = auth.uid()
$$;

-- Policies
create policy if not exists "Profiles can read own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy if not exists "Profiles can update own profile"
  on public.profiles for update
  using (id = auth.uid());

create policy if not exists "Members can read own company"
  on public.companies for select
  using (id = public.current_company_id());

create policy if not exists "Members can read company clients"
  on public.clients for select
  using (company_id = public.current_company_id());

create policy if not exists "Members can insert company clients"
  on public.clients for insert
  with check (company_id = public.current_company_id());

create policy if not exists "Members can update company clients"
  on public.clients for update
  using (company_id = public.current_company_id());

create policy if not exists "Members can read company analyses"
  on public.analyses for select
  using (company_id = public.current_company_id());

create policy if not exists "Members can insert company analyses"
  on public.analyses for insert
  with check (company_id = public.current_company_id());

-- Bootstrap demo
-- 1) Crea una empresa manualmente.
-- 2) Crea un usuario en Authentication.
-- 3) Inserta una fila en profiles con el mismo auth.users.id y el company_id correspondiente.
