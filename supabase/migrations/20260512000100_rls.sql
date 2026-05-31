-- =============================================================================
-- Quiniela Mundial 2026 — Row Level Security
-- =============================================================================

-- Habilitar RLS en todas las tablas
alter table public.profiles               enable row level security;
alter table public.rounds                 enable row level security;
alter table public.teams                  enable row level security;
alter table public.matches                enable row level security;
alter table public.predictions            enable row level security;
alter table public.payments               enable row level security;
alter table public.prediction_snapshots   enable row level security;
alter table public.audit_log              enable row level security;

-- =============================================================================
-- profiles
-- =============================================================================
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "profiles_update_owner_safe" on public.profiles;
create policy "profiles_update_owner_safe"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select role from public.profiles where id = auth.uid())
    and payment_status = (select payment_status from public.profiles where id = auth.uid())
    and is_active = (select is_active from public.profiles where id = auth.uid())
  );

drop policy if exists "profiles_admin_all" on public.profiles;
create policy "profiles_admin_all"
  on public.profiles for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- =============================================================================
-- rounds / teams / matches — solo lectura para jugadores; admin todo
-- =============================================================================
drop policy if exists "rounds_select" on public.rounds;
create policy "rounds_select"
  on public.rounds for select
  to authenticated
  using (true);

drop policy if exists "rounds_admin_all" on public.rounds;
create policy "rounds_admin_all"
  on public.rounds for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "teams_select" on public.teams;
create policy "teams_select"
  on public.teams for select
  to authenticated
  using (true);

drop policy if exists "teams_admin_all" on public.teams;
create policy "teams_admin_all"
  on public.teams for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "matches_select" on public.matches;
create policy "matches_select"
  on public.matches for select
  to authenticated
  using (true);

drop policy if exists "matches_admin_all" on public.matches;
create policy "matches_admin_all"
  on public.matches for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- =============================================================================
-- predictions
-- =============================================================================

-- SELECT: el dueño siempre puede ver los suyos; el resto, solo si la ronda está bloqueada.
drop policy if exists "predictions_select_self_or_locked" on public.predictions;
create policy "predictions_select_self_or_locked"
  on public.predictions for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.matches m
      join public.rounds r on r.id = m.round_id
      where m.id = predictions.match_id
        and r.is_locked = true
    )
  );

-- INSERT/UPDATE: solo el dueño, solo si la ronda sigue abierta
drop policy if exists "predictions_insert_owner_open" on public.predictions;
create policy "predictions_insert_owner_open"
  on public.predictions for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.round_is_open(public.current_round_for_match(match_id))
  );

drop policy if exists "predictions_update_owner_open" on public.predictions;
create policy "predictions_update_owner_open"
  on public.predictions for update
  to authenticated
  using (
    user_id = auth.uid()
    and public.round_is_open(public.current_round_for_match(match_id))
  )
  with check (
    user_id = auth.uid()
    and public.round_is_open(public.current_round_for_match(match_id))
  );

-- DELETE: prohibido (las correcciones deben ser updates).
-- Sin policy de DELETE para el rol authenticated => bloqueado por RLS.

-- =============================================================================
-- payments
-- =============================================================================
drop policy if exists "payments_select_self_or_admin" on public.payments;
create policy "payments_select_self_or_admin"
  on public.payments for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "payments_insert_self" on public.payments;
create policy "payments_insert_self"
  on public.payments for insert
  to authenticated
  with check (user_id = auth.uid() and status = 'submitted');

-- El jugador puede actualizar SOLO mientras esté en 'submitted' (para reemplazar comprobante).
drop policy if exists "payments_update_self_submitted" on public.payments;
create policy "payments_update_self_submitted"
  on public.payments for update
  to authenticated
  using (user_id = auth.uid() and status = 'submitted')
  with check (user_id = auth.uid() and status = 'submitted');

drop policy if exists "payments_admin_all" on public.payments;
create policy "payments_admin_all"
  on public.payments for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- =============================================================================
-- prediction_snapshots — lectura abierta después del sellado, escritura nula desde clientes
-- =============================================================================
drop policy if exists "snapshots_select_after_lock" on public.prediction_snapshots;
create policy "snapshots_select_after_lock"
  on public.prediction_snapshots for select
  to authenticated
  using (
    exists (
      select 1 from public.rounds r
      where r.id = prediction_snapshots.round_id and r.is_locked = true
    )
  );

-- Sin policies de INSERT/UPDATE/DELETE: solo se escribe vía función seal_round
-- (que correrá con SECURITY DEFINER y como propietario de la tabla).

-- =============================================================================
-- audit_log — solo admin lee, escritura vía service role
-- =============================================================================
drop policy if exists "audit_admin_select" on public.audit_log;
create policy "audit_admin_select"
  on public.audit_log for select
  to authenticated
  using (public.is_admin());

-- Sin policies de INSERT/UPDATE/DELETE: solo desde servidor con service_role.

-- =============================================================================
-- Trigger: auto-crea profile al crear auth.user (lo crea admin con metadata)
-- =============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, display_name, role, must_change_password)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'display_name',
             new.raw_user_meta_data->>'full_name',
             split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'player'),
    coalesce((new.raw_user_meta_data->>'must_change_password')::boolean, true)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
