-- =============================================================================
-- Quiniela Mundial 2026 — Configuración de marca (logo + nombre de empresa)
-- =============================================================================
-- Crea una tabla singleton `branding` con el nombre de empresa y el path al
-- logo dentro del bucket público `branding`. Lectura abierta a todos; sólo
-- admins pueden modificar.
-- =============================================================================

-- 1) Tabla singleton ---------------------------------------------------------

create table if not exists public.branding (
  id            text primary key default 'singleton'
                check (id = 'singleton'),
  company_name  text not null default 'Quiniela Mundial 2026',
  logo_path     text,
  updated_at    timestamptz not null default now(),
  updated_by    uuid references public.profiles(id)
);

create trigger branding_set_updated_at
  before update on public.branding
  for each row execute function public.tg_set_updated_at();

insert into public.branding (id) values ('singleton')
  on conflict (id) do nothing;

-- 2) RLS ---------------------------------------------------------------------

alter table public.branding enable row level security;

-- Lectura abierta (incluye anónimos para la landing).
drop policy if exists "branding_select_public" on public.branding;
create policy "branding_select_public"
  on public.branding for select
  to anon, authenticated
  using (true);

-- Sólo admin puede actualizar.
drop policy if exists "branding_update_admin" on public.branding;
create policy "branding_update_admin"
  on public.branding for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 3) Bucket público para logo de marca --------------------------------------

insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do update set public = true;

-- 4) Políticas de storage para bucket `branding` ----------------------------

drop policy if exists "branding_logo_select_public" on storage.objects;
create policy "branding_logo_select_public"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'branding');

drop policy if exists "branding_logo_insert_admin" on storage.objects;
create policy "branding_logo_insert_admin"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'branding' and public.is_admin());

drop policy if exists "branding_logo_update_admin" on storage.objects;
create policy "branding_logo_update_admin"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'branding' and public.is_admin())
  with check (bucket_id = 'branding' and public.is_admin());

drop policy if exists "branding_logo_delete_admin" on storage.objects;
create policy "branding_logo_delete_admin"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'branding' and public.is_admin());
