-- =============================================================================
-- Quiniela Mundial 2026 — Textos configurables por admin
-- =============================================================================
-- Tabla singleton `app_texts` con listas editables que aparecen en el home
-- (reglas rápidas) y en /pago (pasos para pagar).
-- =============================================================================

create table if not exists public.app_texts (
  id              text primary key default 'singleton'
                  check (id = 'singleton'),
  quick_rules     jsonb not null default '[
    "3 puntos por marcador exacto, 1 punto por acertar el resultado.",
    "Pronósticos en blanco = 0 puntos. Antes del cierre podés editarlos cuantas veces quieras.",
    "Premios: 60 / 25 / 15% del pozo. Desempate: exactos → resultados → sorteo."
  ]'::jsonb,
  payment_steps   jsonb not null default '[
    "Depositá Q100.00 en la cuenta de Banco Nexa, alcancía “Quiniela”.",
    "Tomá foto o guardá el PDF del comprobante.",
    "Subilo aquí abajo. El organizador lo revisa y confirma."
  ]'::jsonb,
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.profiles(id)
);

create trigger app_texts_set_updated_at
  before update on public.app_texts
  for each row execute function public.tg_set_updated_at();

insert into public.app_texts (id) values ('singleton')
  on conflict (id) do nothing;

-- =============================================================================
-- RLS: select público, update solo admin
-- =============================================================================

alter table public.app_texts enable row level security;

drop policy if exists "app_texts_select_public" on public.app_texts;
create policy "app_texts_select_public"
  on public.app_texts for select
  to anon, authenticated
  using (true);

drop policy if exists "app_texts_update_admin" on public.app_texts;
create policy "app_texts_update_admin"
  on public.app_texts for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
