-- =============================================================================
-- Quiniela Mundial 2026 — seal_round()
-- =============================================================================
-- Función para sellar una ronda:
--   1. Bloquea ronda (is_locked = true).
--   2. Copia todos los pronósticos a prediction_snapshots (write-once).
--   3. Calcula y guarda hash SHA-256 del contenido sellado.
--   4. Registra en audit_log.
-- Solo puede ser llamada por:
--   - usuario admin desde la app, o
--   - cron de Vercel con service_role.
-- =============================================================================

create or replace function public.seal_round(p_round_id uuid)
returns table (round_id uuid, sealed_rows int, content_hash text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_locked     boolean;
  v_actor      uuid;
  v_is_admin   boolean;
  v_inserted   int;
  v_hash       text;
  v_concat     text;
begin
  v_actor := auth.uid();

  -- Permite el llamado desde service_role (auth.uid() es NULL) o desde admin autenticado.
  if v_actor is not null then
    select role = 'admin' into v_is_admin from public.profiles where id = v_actor;
    if not coalesce(v_is_admin, false) then
      raise exception 'seal_round: solo admin puede sellar (actor=%)', v_actor
        using errcode = '42501';
    end if;
  end if;

  select is_locked into v_locked from public.rounds where id = p_round_id for update;
  if v_locked is null then
    raise exception 'seal_round: round_id % no existe', p_round_id;
  end if;
  if v_locked then
    raise exception 'seal_round: la ronda % ya está sellada', p_round_id
      using errcode = '0L000';
  end if;

  -- Bloquear primero para que ninguna escritura entre durante el copiado.
  update public.rounds
     set is_locked = true,
         snapshot_at = now()
   where id = p_round_id;

  -- Copia inmutable
  insert into public.prediction_snapshots (round_id, user_id, match_id, home_score, away_score)
  select p_round_id, pr.user_id, pr.match_id, pr.home_score, pr.away_score
    from public.predictions pr
    join public.matches m on m.id = pr.match_id
   where m.round_id = p_round_id
  on conflict (round_id, user_id, match_id) do nothing;

  get diagnostics v_inserted = row_count;

  -- Hash determinístico del contenido (concatenamos ordenado)
  select string_agg(
           user_id::text || '|' || match_id::text || '|' ||
           coalesce(home_score::text, '') || '-' || coalesce(away_score::text, ''),
           E'\n'
           order by user_id, match_id
         )
    into v_concat
    from public.prediction_snapshots
   where round_id = p_round_id;

  v_hash := encode(digest(coalesce(v_concat, ''), 'sha256'), 'hex');

  update public.rounds
     set snapshot_hash = v_hash
   where id = p_round_id;

  insert into public.audit_log (actor_id, action, entity, entity_id, after_val)
  values (
    v_actor,
    'seal_round',
    'rounds',
    p_round_id::text,
    jsonb_build_object('sealed_rows', v_inserted, 'hash', v_hash)
  );

  return query select p_round_id, v_inserted, v_hash;
end;
$$;

-- Habilitar pgcrypto para digest()
create extension if not exists pgcrypto;

-- Permisos
revoke all on function public.seal_round(uuid) from public;
grant execute on function public.seal_round(uuid) to authenticated, service_role;
