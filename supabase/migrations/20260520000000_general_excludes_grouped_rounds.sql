-- =============================================================================
-- Quiniela Mundial 2026 — El ranking General excluye las rondas amarradas
-- =============================================================================
-- Modelo: cada ronda cuenta en UN solo ranking.
--   - Rondas SIN grupo (ranking_group is null) → ranking General (v_standings).
--   - Rondas CON grupo                         → su ranking aparte (v_standings_by_group).
--
-- Esto evita el doble conteo: al amarrar una ronda (ej. 16avos) sale del General
-- y solo suma en su grupo. La fase de grupos NO está amarrada, así que sigue en
-- el General con los mismos puntos de siempre (no cambia nada de lo ya jugado).
--
-- Requiere que exista la columna rounds.ranking_group (migración 20260519...).
-- =============================================================================

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
    and r.is_active = true
    and r.ranking_group is null       -- NUEVO: las rondas amarradas salen del general
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
