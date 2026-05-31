-- =============================================================================
-- Quiniela Mundial 2026 — Esquema inicial
-- =============================================================================
-- Crea tablas, tipos, índices, triggers de auditoría y vista de ranking.
-- Las políticas RLS se aplican en la migración 20260512000100_rls.sql.
-- =============================================================================

-- 1. Funciones utilitarias ----------------------------------------------------

create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- 2. Tabla: profiles ---------------------------------------------------------

create table if not exists public.profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  full_name            text not null,
  display_name         text not null,
  role                 text not null default 'player' check (role in ('admin','player')),
  payment_status       text not null default 'pending'
                       check (payment_status in ('pending','submitted','confirmed','refunded','rejected')),
  must_change_password boolean not null default true,
  is_active            boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles(role);
create index if not exists profiles_active_idx on public.profiles(is_active);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.tg_set_updated_at();

-- 3. Tabla: rounds -----------------------------------------------------------

create table if not exists public.rounds (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  name          text not null,
  closes_at     timestamptz not null,
  is_locked     boolean not null default false,
  snapshot_at   timestamptz,
  snapshot_hash text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger rounds_set_updated_at
  before update on public.rounds
  for each row execute function public.tg_set_updated_at();

-- 4. Tabla: teams ------------------------------------------------------------

create table if not exists public.teams (
  id           smallint primary key,
  name         text not null,
  iso_code     text,
  group_letter text check (group_letter ~ '^[A-L]$' or group_letter is null)
);

create index if not exists teams_group_idx on public.teams(group_letter);

-- 5. Tabla: matches ----------------------------------------------------------

create table if not exists public.matches (
  id            int primary key,
  round_id      uuid not null references public.rounds(id) on delete restrict,
  group_letter  text check (group_letter ~ '^[A-L]$' or group_letter is null),
  home_team_id  smallint not null references public.teams(id),
  away_team_id  smallint not null references public.teams(id),
  kickoff_at    timestamptz not null,
  venue         text,
  home_score    smallint check (home_score is null or (home_score >= 0 and home_score <= 30)),
  away_score    smallint check (away_score is null or (away_score >= 0 and away_score <= 30)),
  status        text not null default 'scheduled'
                check (status in ('scheduled','live','finished','cancelled')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint matches_distinct_teams check (home_team_id <> away_team_id)
);

create index if not exists matches_round_idx on public.matches(round_id);
create index if not exists matches_kickoff_idx on public.matches(kickoff_at);
create index if not exists matches_group_idx on public.matches(group_letter);
create index if not exists matches_status_idx on public.matches(status);

create trigger matches_set_updated_at
  before update on public.matches
  for each row execute function public.tg_set_updated_at();

-- 6. Tabla: predictions ------------------------------------------------------

create table if not exists public.predictions (
  id          bigserial primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  match_id    int  not null references public.matches(id) on delete cascade,
  home_score  smallint not null check (home_score >= 0 and home_score <= 30),
  away_score  smallint not null check (away_score >= 0 and away_score <= 30),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, match_id)
);

create index if not exists predictions_user_idx on public.predictions(user_id);
create index if not exists predictions_match_idx on public.predictions(match_id);

create trigger predictions_set_updated_at
  before update on public.predictions
  for each row execute function public.tg_set_updated_at();

-- 7. Tabla: payments ---------------------------------------------------------

create table if not exists public.payments (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles(id) on delete cascade,
  amount_quetzales   numeric(10,2) not null default 100,
  receipt_path       text,                  -- ruta en storage bucket 'payment-receipts'
  status             text not null default 'submitted'
                     check (status in ('submitted','confirmed','rejected','refunded')),
  confirmed_by       uuid references public.profiles(id),
  confirmed_at       timestamptz,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists payments_user_idx on public.payments(user_id);
create index if not exists payments_status_idx on public.payments(status);

create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function public.tg_set_updated_at();

-- 8. Tabla: prediction_snapshots (write-once) --------------------------------

create table if not exists public.prediction_snapshots (
  id           uuid primary key default gen_random_uuid(),
  round_id     uuid not null references public.rounds(id) on delete restrict,
  user_id      uuid not null references public.profiles(id) on delete restrict,
  match_id     int  not null references public.matches(id)  on delete restrict,
  home_score   smallint,
  away_score   smallint,
  snapshot_at  timestamptz not null default now(),
  unique (round_id, user_id, match_id)
);

create index if not exists snapshots_round_idx on public.prediction_snapshots(round_id);
create index if not exists snapshots_user_idx  on public.prediction_snapshots(user_id);

-- Bloquea UPDATE y DELETE en snapshots: solo INSERT vía función seal_round.
create or replace function public.tg_block_snapshot_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'prediction_snapshots es write-once: no se permite % en filas ya selladas', tg_op
    using errcode = '42501';
end;
$$;

create trigger snapshots_no_update
  before update on public.prediction_snapshots
  for each row execute function public.tg_block_snapshot_mutation();

create trigger snapshots_no_delete
  before delete on public.prediction_snapshots
  for each row execute function public.tg_block_snapshot_mutation();

-- 9. Tabla: audit_log --------------------------------------------------------

create table if not exists public.audit_log (
  id          bigserial primary key,
  actor_id    uuid references public.profiles(id),
  action      text not null,
  entity      text,
  entity_id   text,
  before_val  jsonb,
  after_val   jsonb,
  ip          inet,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index if not exists audit_action_idx on public.audit_log(action);
create index if not exists audit_actor_idx  on public.audit_log(actor_id);
create index if not exists audit_created_idx on public.audit_log(created_at desc);

-- 10. Vista: v_standings -----------------------------------------------------

create or replace view public.v_standings as
with scored as (
  select
    pr.user_id,
    pr.match_id,
    pr.home_score as p_home,
    pr.away_score as p_away,
    m.home_score  as r_home,
    m.away_score  as r_away,
    m.status
  from public.predictions pr
  join public.matches m on m.id = pr.match_id
  where m.status = 'finished'
    and m.home_score is not null
    and m.away_score is not null
),
classified as (
  select
    user_id,
    case
      when p_home = r_home and p_away = r_away then 'exact'
      when sign(p_home - p_away) = sign(r_home - r_away) then 'result'
      else 'miss'
    end as kind
  from scored
)
select
  pr.id                       as user_id,
  pr.display_name,
  pr.is_active,
  coalesce(sum(case c.kind when 'exact'  then 3 when 'result' then 1 else 0 end), 0)::int as points,
  coalesce(sum(case c.kind when 'exact'  then 1 else 0 end), 0)::int as exact_count,
  coalesce(sum(case c.kind when 'result' then 1 else 0 end), 0)::int as result_count,
  coalesce(sum(case c.kind when 'miss'   then 1 else 0 end), 0)::int as miss_count
from public.profiles pr
left join classified c on c.user_id = pr.id
where pr.role = 'player'
group by pr.id, pr.display_name, pr.is_active;

-- 11. Helpers de seguridad --------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_active = true
  );
$$;

create or replace function public.current_round_for_match(p_match_id int)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select round_id from public.matches where id = p_match_id;
$$;

create or replace function public.round_is_open(p_round_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select (is_locked = false and now() < closes_at) from public.rounds where id = p_round_id),
    false
  );
$$;
