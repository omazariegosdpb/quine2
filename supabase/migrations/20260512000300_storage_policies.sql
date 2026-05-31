-- =============================================================================
-- Quiniela Mundial 2026 — Políticas de Storage para bucket 'payment-receipts'
-- =============================================================================
-- Requiere que el bucket ya esté creado desde la consola (privado).
-- Estructura del path: <user_id>/<timestamp>.<ext>
-- =============================================================================

-- Solo el dueño puede leer su propio comprobante (vía URL firmada generada por server).
-- En la práctica, todos los SELECT desde clientes pasan por nosotros con service_role,
-- pero por defensa en profundidad bloqueamos lectura directa salvo dueño/admin.

drop policy if exists "receipts_select_owner_or_admin" on storage.objects;
create policy "receipts_select_owner_or_admin"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'payment-receipts'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or public.is_admin()
    )
  );

-- Los jugadores NO suben directamente desde el browser; el upload pasa por el server con service_role.
-- Por defecto bloqueamos INSERT desde authenticated en este bucket.
drop policy if exists "receipts_insert_admin_only" on storage.objects;
create policy "receipts_insert_admin_only"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'payment-receipts'
    and public.is_admin()
  );

-- Update / Delete solo admin (la app usa service_role, así que esto es defensa adicional).
drop policy if exists "receipts_modify_admin" on storage.objects;
create policy "receipts_modify_admin"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'payment-receipts' and public.is_admin())
  with check (bucket_id = 'payment-receipts' and public.is_admin());

drop policy if exists "receipts_delete_admin" on storage.objects;
create policy "receipts_delete_admin"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'payment-receipts' and public.is_admin());
