-- ScaleSync schema v1 — harvests, strains, readings
-- RLS + Realtime publication included so the anon key can read/write from the browser.

-- 1. Tables
create table if not exists public.harvests (
  id uuid primary key default gen_random_uuid(),
  batch_name text not null,
  workflow_mode text not null check (workflow_mode in ('wet','dry')),
  status text not null check (status in ('active','completed','archived')) default 'active',
  total_plants int not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  device_id text,
  facility_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.harvest_strains (
  id uuid primary key,                    -- client-generated uuid
  harvest_id uuid not null references public.harvests(id) on delete cascade,
  strain text not null,
  plant_count int not null,
  position int not null,
  unique (harvest_id, position)
);

create table if not exists public.harvest_readings (
  id uuid primary key,                    -- client-generated uuid so offline writes are idempotent
  harvest_id uuid not null references public.harvests(id) on delete cascade,
  plant_number int not null,
  strain text not null,
  tag_id text not null,
  weight_grams numeric(10,2) not null,
  captured_at timestamptz not null,
  device_id text,
  created_at timestamptz not null default now(),
  unique (harvest_id, tag_id)             -- duplicate-tag enforcement
);

create index if not exists harvest_readings_by_harvest_time
  on public.harvest_readings (harvest_id, captured_at);

-- 2. Enable RLS (SQL-editor-created tables don't auto-enable)
alter table public.harvests         enable row level security;
alter table public.harvest_strains  enable row level security;
alter table public.harvest_readings enable row level security;

-- 3. Permissive anon policies for single-tenant internal tool.
--    Supabase advisor flags "always true" on INSERT/UPDATE — accepted trade-off for
--    MVP. Harden with auth-gated policies when multi-tenant is introduced.
create policy "anon read harvests"    on public.harvests         for select to anon using (true);
create policy "anon insert harvests"  on public.harvests         for insert to anon with check (true);
create policy "anon update harvests"  on public.harvests         for update to anon using (true) with check (true);

create policy "anon read strains"     on public.harvest_strains  for select to anon using (true);
create policy "anon insert strains"   on public.harvest_strains  for insert to anon with check (true);

create policy "anon read readings"    on public.harvest_readings for select to anon using (true);
create policy "anon insert readings"  on public.harvest_readings for insert to anon with check (true);
create policy "anon update readings"  on public.harvest_readings for update to anon using (true) with check (true);

-- 4. Realtime publication (tables aren't auto-published)
alter publication supabase_realtime add table public.harvest_readings;
alter publication supabase_realtime add table public.harvests;
