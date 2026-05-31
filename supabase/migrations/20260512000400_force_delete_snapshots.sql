-- =============================================================================
-- Quiniela Mundial 2026 — Helper para limpiar simulacro
-- =============================================================================
-- prediction_snapshots tiene triggers que bloquean UPDATE/DELETE (write-once).
-- Esta función permite borrar snapshots de UNA ronda específica desde admin/cron,
-- útil para limpiar la ronda de simulacro. NO se debe usar en la ronda real.
-- =============================================================================

create or replace function public.force_delete_snapshots(p_round_id uuid)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deleted int;
  v_actor   uuid;
  v_admin   boolean;
begin
  v_actor := auth.uid();

  -- Solo admin autenticado o service_role (auth.uid IS NULL).
  if v_actor is not null then
    select role = 'admin' into v_admin from public.profiles where id = v_actor;
    if not coalesce(v_admin, false) then
      raise exception 'force_delete_snapshots: solo admin' using errcode = '42501';
    end if;
  end if;

  alter table public.prediction_snapshots disable trigger snapshots_no_update;
  alter table public.prediction_snapshots disable trigger snapshots_no_delete;

  delete from public.prediction_snapshots where round_id = p_round_id;
  get diagnostics v_deleted = row_count;

  alter table public.prediction_snapshots enable trigger snapshots_no_update;
  alter table public.prediction_snapshots enable trigger snapshots_no_delete;

  -- Audit
  insert into public.audit_log (actor_id, action, entity, entity_id, after_val)
  values (
    v_actor,
    'force_delete_snapshots',
    'prediction_snapshots',
    p_round_id::text,
    jsonb_build_object('deleted_rows', v_deleted)
  );

  return v_deleted;
end;
$$;

revoke all on function public.force_delete_snapshots(uuid) from public;
grant execute on function public.force_delete_snapshots(uuid) to authenticated, service_role;
