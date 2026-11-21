-- MatriX Winterfest — run once in Supabase → SQL Editor → Run

create table if not exists matrix_meta (
  id int primary key default 1 check (id = 1),
  competition_id text not null,
  config jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists matrix_runs (
  run_id uuid primary key,
  competition_id text not null,
  company_name text not null,
  status text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists matrix_runs_comp_status_idx
  on matrix_runs (competition_id, status);

create table if not exists matrix_drafts (
  run_id uuid not null references matrix_runs (run_id) on delete cascade,
  round int not null,
  allocations jsonb not null default '[]'::jsonb,
  primary key (run_id, round)
);

create table if not exists matrix_sessions (
  token text primary key,
  created_at timestamptz not null default now()
);

-- Seed default competition + config (skip if already present)
insert into matrix_meta (id, competition_id, config)
values (
  1,
  gen_random_uuid()::text,
  jsonb_build_object(
    'configId', gen_random_uuid()::text,
    'version', 1,
    'isActive', true,
    'numRounds', 6,
    'sequence', jsonb_build_array(1, 2, 3, 4, 5, 6),
    'startBudgetM', 100,
    'budgetMode', 'A',
    'timerEnabled', false,
    'timerMinutes', 5,
    'alertMinutes', 1,
    'timerOverrides', '{}'::jsonb,
    'createdAt', now()
  )
)
on conflict (id) do nothing;
