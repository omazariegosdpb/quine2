-- =============================================================================
-- Quiniela Mundial 2026 — Admin: rondas activables, CASCADE en matches,
-- protección anti-borrado de partidos con predicciones, v_standings filtrada.
-- =============================================================================
-- Aplicar ANTES del deploy del código nuevo: la UI espera estas columnas y reglas.
-- =============================================================================

-- 1) Columna is_active en rounds ---------------------------------------------
alter table public.rounds
  add column if not exists is_active boolean not null default true;

create index if not exists rounds_is_active_idx on public.rounds(is_active);

-- 2) FK matches.round_id : RESTRICT -> CASCADE -------------------------------
-- Al eliminar una ronda (no sellada y sin predicciones, ver trigger abajo),
-- sus partidos se borran automáticamente.
alter table public.matches
  drop constraint if exists matches_round_id_fkey;

alter table public.matches
  add constraint matches_round_id_fkey
  foreign key (round_id) references public.rounds(id) on delete cascade;

-- 3) Trigger: no borrar match si tiene predicciones --------------------------
create or replace function public.tg_block_match_delete_with_predictions()
returns trigger
language plpgsql
as $$
declare
  v_count int;
begin
  select count(*) into v_count from public.predictions where match_id = old.id;
  if v_count > 0 then
    raise exception 'No se puede eliminar el partido % porque tiene % pronostico(s). Borra primero las predicciones (o desactiva la ronda en su lugar).', old.id, v_count
      using errcode = '23000';
  end if;
  return old;
end;
$$;

drop trigger if exists matches_block_delete_with_preds on public.matches;
create trigger matches_block_delete_with_preds
  before delete on public.matches
  for each row execute function public.tg_block_match_delete_with_predictions();

-- 4) v_standings: ignorar rondas inactivas -----------------------------------
create or replace view public.v_standings as
with scored as (
  select
    pr.user_id,
    pr.match_id,
    pr.home_score as p_home,
    pr.away_score as p_away,
    m.home_score  as r_home,
    m.away_score  as r_away
  from public.predictions pr
  join public.matches m on m.id = pr.match_id
  join public.rounds  r on r.id = m.round_id
  where m.status = 'finished'
    and m.home_score is not null
    and m.away_score is not null
    and r.is_active = true            -- NUEVO: solo rondas activas suman al ranking
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
  pr.id            as user_id,
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

-- 5) Trigger: no borrar team si está referenciado por matches ---------------
-- (Defensa adicional, además de la FK que ya restringe)
-- La FK actual de matches.home_team_id/away_team_id usa RESTRICT por defecto,
-- así que Postgres ya bloquea el delete. No agregamos lógica extra acá.
