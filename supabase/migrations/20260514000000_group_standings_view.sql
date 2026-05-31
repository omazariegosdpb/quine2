-- =============================================================================
-- Quiniela Mundial 2026 — Tabla de posiciones por grupo (vista derivada)
-- =============================================================================
-- group_standings_view: una fila por equipo del Mundial, agregando los partidos
-- finished de su grupo (ronda activa). Equipos sin partidos jugados aparecen
-- con ceros para que la tabla siempre muestre 4 filas por grupo.
--
-- Orden: dentro de cada grupo por Pts ↓, DG ↓, GF ↓, nombre ↑.
-- (Head-to-head de la regla FIFA queda fuera; en una quiniela interna
--  los desempates finos se ven cuando todos juegan la última fecha.)
-- =============================================================================

drop view if exists public.group_standings_view;

create view public.group_standings_view
with (security_invoker = true) as
with finished as (
  select
    m.group_letter,
    m.home_team_id,
    m.away_team_id,
    m.home_score,
    m.away_score
  from public.matches m
  join public.rounds  r on r.id = m.round_id
  where m.status = 'finished'
    and m.home_score is not null
    and m.away_score is not null
    and m.group_letter is not null
    and r.is_active = true
),
team_rows as (
  -- Perspectiva del local
  select
    group_letter,
    home_team_id as team_id,
    home_score   as gf,
    away_score   as gc,
    case when home_score >  away_score then 1 else 0 end as won,
    case when home_score =  away_score then 1 else 0 end as drawn,
    case when home_score <  away_score then 1 else 0 end as lost,
    case
      when home_score >  away_score then 3
      when home_score =  away_score then 1
      else 0
    end as pts
  from finished
  union all
  -- Perspectiva del visitante
  select
    group_letter,
    away_team_id as team_id,
    away_score   as gf,
    home_score   as gc,
    case when away_score >  home_score then 1 else 0 end as won,
    case when away_score =  home_score then 1 else 0 end as drawn,
    case when away_score <  home_score then 1 else 0 end as lost,
    case
      when away_score >  home_score then 3
      when away_score =  home_score then 1
      else 0
    end as pts
  from finished
),
aggregated as (
  select
    team_id,
    group_letter,
    count(*)::int                  as pj,
    coalesce(sum(won),   0)::int   as g,
    coalesce(sum(drawn), 0)::int   as e,
    coalesce(sum(lost),  0)::int   as p,
    coalesce(sum(gf),    0)::int   as gf,
    coalesce(sum(gc),    0)::int   as gc,
    coalesce(sum(pts),   0)::int   as pts
  from team_rows
  group by team_id, group_letter
)
select
  t.id                                       as team_id,
  t.name                                     as team_name,
  t.iso_code,
  t.group_letter,
  coalesce(a.pj,  0)::int                    as pj,
  coalesce(a.g,   0)::int                    as g,
  coalesce(a.e,   0)::int                    as e,
  coalesce(a.p,   0)::int                    as p,
  coalesce(a.gf,  0)::int                    as gf,
  coalesce(a.gc,  0)::int                    as gc,
  (coalesce(a.gf, 0) - coalesce(a.gc, 0))::int as dg,
  coalesce(a.pts, 0)::int                    as pts
from public.teams t
left join aggregated a on a.team_id = t.id
where t.group_letter is not null;

grant select on public.group_standings_view to authenticated;
grant select on public.group_standings_view to anon;
