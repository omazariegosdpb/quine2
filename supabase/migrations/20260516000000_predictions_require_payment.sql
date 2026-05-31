-- =============================================================================
-- Quiniela Mundial 2026 — Pronósticos requieren pago confirmado
-- =============================================================================
-- Solo jugadores con payment_status = 'confirmed' pueden insertar/actualizar
-- pronósticos. Admin queda exento (puede probar o capturar manualmente).
-- =============================================================================

create or replace function public.payment_is_confirmed()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and payment_status = 'confirmed'
  );
$$;

drop policy if exists "predictions_insert_owner_open" on public.predictions;
create policy "predictions_insert_owner_open"
  on public.predictions for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.round_is_open(public.current_round_for_match(match_id))
    and (public.payment_is_confirmed() or public.is_admin())
  );

drop policy if exists "predictions_update_owner_open" on public.predictions;
create policy "predictions_update_owner_open"
  on public.predictions for update
  to authenticated
  using (
    user_id = auth.uid()
    and public.round_is_open(public.current_round_for_match(match_id))
    and (public.payment_is_confirmed() or public.is_admin())
  )
  with check (
    user_id = auth.uid()
    and public.round_is_open(public.current_round_for_match(match_id))
    and (public.payment_is_confirmed() or public.is_admin())
  );
