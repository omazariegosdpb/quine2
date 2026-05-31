# Supabase — Migraciones y seed

## Aplicar al proyecto Supabase

La forma más simple para v1 es pegar los archivos en orden desde el SQL Editor de Supabase.

### Orden

1. `migrations/20260512000000_init_schema.sql` — tablas, índices, triggers de updated_at, vista de ranking, helpers de seguridad.
2. `migrations/20260512000100_rls.sql` — habilita RLS y aplica policies.
3. `migrations/20260512000200_seal_round.sql` — función para sellar la ronda con hash SHA-256.
4. `migrations/20260512000300_storage_policies.sql` — RLS del bucket `payment-receipts` (requiere bucket creado primero).
5. `migrations/20260512000400_force_delete_snapshots.sql` — helper para limpiar snapshots de la ronda de simulacro.
6. `seed/seed.sql` — 1 ronda (GROUPS), 48 equipos y 72 partidos.

### Pasos en la consola

1. Entrá a `https://supabase.com/dashboard/project/pvytlgnkdodhafzuqrhm/sql/new`.
2. Pegá el contenido de cada archivo y ejecutá uno por uno.
3. Verificá con `select count(*) from public.matches;` → debería dar 72.

## Crear admin#1

Después de migrar, en SQL Editor:

```sql
-- Reemplazar el UUID por el id del usuario creado en auth.users
update public.profiles
set role = 'admin', must_change_password = false
where id = '<uuid-de-oscar>';
```

Para crear el primer admin a mano:
- Authentication → Users → "Add user" → email `oscarmazariegoss5@gmail.com` y contraseña temporal.
- Copiar el `id` (uuid) y correr el UPDATE de arriba.

## Re-generar seed

Si cambia la lista oficial de partidos:

```powershell
node supabase/seed/build_seed.mjs
```

Esto lee `supabase/matches.csv` (extraído de `docs/quiniela mundial 2026.xlsx`) y reescribe `seed.sql`.

## Configuración manual en la consola Supabase

- **Authentication → Providers**: dejar solo Email habilitado.
- **Authentication → MFA**: habilitar TOTP (Time-Based OTP).
- **Authentication → URL Configuration**: agregar `http://localhost:3000` y la URL de Vercel en allowed redirect URLs.
- **Authentication → Password Settings**: mínimo 12 caracteres, requerir mayúscula + número.
- **Storage**: crear bucket privado `payment-receipts` (luego se configuran sus policies).
