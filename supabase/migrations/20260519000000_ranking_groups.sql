-- =============================================================================
-- Quiniela Mundial 2026 — Rankings por grupo de rondas ("amarrar" rondas)
-- =============================================================================
-- Permite agrupar varias rondas bajo una misma etiqueta (ranking_group) para
-- tener un leaderboard independiente que SUMA solo esas rondas, sin tocar el
-- ranking general (v_standings, que sigue sumando TODAS las rondas activas).
--
-- Ejemplo: marcar 16AVOS y OCTAVOS con ranking_group = 'ELIMINATORIAS' produce
-- un ranking aparte "Eliminatorias" = puntos de esas dos rondas combinadas.
--
-- Aplicar ANTES del deploy del código nuevo: la UI espera la columna y la vista.
-- =============================================================================

-- 1) Columna ranking_group en rounds -----------------------------------------
-- NULL = la ronda solo cuenta en el ranking general (comportamiento actual).
alter table public.rounds
  add column if not exists ranking_group text;

create index if not exists rounds_ranking_group_idx on public.rounds(ranking_group);

-- 2) Vista: v_standings_by_group ---------------------------------------------
-- Una fila por (grupo, jugador). Misma lógica de puntos que v_standings
-- (3 exacto / 1 resultado / 0 falla) pero acotada a las rondas de cada grupo.
-- Todos los jugadores activos aparecen aunque tengan 0 (cross join), igual que
-- en el ranking general. Solo se consideran rondas ACTIVAS con ranking_group.
create or replace view public.v_standings_by_group as
with groups as (
  select distinct r.ranking_group
  from public.rounds r
  where r.ranking_group is not null
    and r.is_active = true
),
scored as (
  select
    pr.user_id,
    r.ranking_group,
    case
      when pr.home_score = m.home_score and pr.away_score = m.away_score then 'exact'
      when sign(pr.home_score - pr.away_score) = sign(m.home_score - m.away_score) then 'result'
      else 'miss'
    end as kind
  from public.predictions pr
  join public.matches m on m.id = pr.match_id
  join public.rounds  r on r.id = m.round_id
  where m.status = 'finished'
    and m.home_score is not null
    and m.away_score is not null
    and r.is_active = true
    and r.ranking_group is not null
),
agg as (
  select
    user_id,
    ranking_group,
    coalesce(sum(case kind when 'exact'  then 3 when 'result' then 1 else 0 end), 0)::int as points,
    coalesce(sum(case kind when 'exact'  then 1 else 0 end), 0)::int as exact_count,
    coalesce(sum(case kind when 'result' then 1 else 0 end), 0)::int as result_count,
    coalesce(sum(case kind when 'miss'   then 1 else 0 end), 0)::int as miss_count
  from scored
  group by user_id, ranking_group
)
select
  g.ranking_group,
  pr.id                          as user_id,
  pr.display_name,
  pr.is_active,
  coalesce(a.points, 0)          as points,
  coalesce(a.exact_count, 0)     as exact_count,
  coalesce(a.result_count, 0)    as result_count,
  coalesce(a.miss_count, 0)      as miss_count
from groups g
cross join public.profiles pr
left join agg a on a.user_id = pr.id and a.ranking_group = g.ranking_group
where pr.role = 'player';

-- Mismo modelo de visibilidad que v_standings: la vista corre con los permisos
-- del owner (no security_invoker), así cualquier jugador autenticado ve el
-- leaderboard completo (solo agregados, nunca jugadas ajenas).
grant select on public.v_standings_by_group to authenticated;
