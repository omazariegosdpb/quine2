# Plan de desarrollo — Quiniela Mundial 2026

App web para administrar la quiniela interna del Mundial 2026 (fase de grupos en v1, eliminatorias en v2). Reemplaza el flujo actual de Excel + WhatsApp + PDF de respaldo manteniendo las mismas reglas y nivel de transparencia.

Stack: **Next.js (App Router) + TypeScript + Tailwind** en **Vercel**, base de datos y autenticación en **Supabase** (Postgres + Auth + RLS + Storage).

---

## 1. Reglas de negocio (fuente única de verdad)

Extraídas del PDF "Bases Oficiales v1.3" más las decisiones tomadas en planificación.

### Rondas y cierre
- La app trabaja por **rondas**. Cada ronda tiene su propio set de partidos y su propio `closes_at`.
- **Ronda 1 — Fase de Grupos**: 72 partidos. Cierre **global** el `2026-06-08 23:59 America/Guatemala` (UTC-6). Después de ese instante ningún pronóstico de esta ronda se puede crear ni modificar. (ESA FECHA ES PROVISIONAL, SE DEBE DE PODER MODIFICAR POR EL ADMINISTRADOR)
- **Ronda 2 — Eliminatorias** (futuro): el admin cargará los partidos cuando se definan las llaves y establecerá un nuevo cierre. Misma lógica.
- Antes del cierre: el usuario puede editar libremente sus pronósticos. Pronósticos faltantes valen 0.

### Puntuación
- **3 puntos** por marcador exacto (ej. predijo 2-1, real 2-1).
- **1 punto** por acertar resultado (W/D/L) sin marcador exacto.
- **0 puntos** si no se acierta o si la celda está vacía.

### Premios
- **60% / 25% / 15%** del pozo total al 1°, 2° y 3°.
- Entrega: **1 día después del último partido de la fase de grupos**.
- Forma de pago: transferencia o efectivo (fuera de la app).

### Desempates
1. Mayor cantidad de **marcadores exactos**.
2. Mayor cantidad de **resultados acertados** (no exactos).
3. Sorteo público con seed verificable (commit-reveal: admin publica hash antes, revela seed después).

### Transparencia ("PDF de respaldo")
- Al cierre, el sistema genera un **snapshot inmutable** de todos los pronósticos.
- El snapshot se exporta como PDF descargable, visible para todos los participantes.
- **Ventana de revisión de 24h** para reportar inconsistencias. Después el snapshot es final.
- Hash SHA-256 del snapshot se publica para que cualquiera pueda verificar que no fue alterado.

### Privacidad
- Visible públicamente en la app: nombre, puntos, ranking, estadísticas.
- Nunca visible: email, comprobantes de pago, datos personales.
- Pronósticos de otros usuarios: **ocultos hasta el cierre**, visibles para todos después.

---

## 2. Roles

| Rol     | Permisos |
|---------|----------|
| `admin` | Crear/editar usuarios, partidos, rondas. Confirmar pagos. Capturar resultados oficiales. Generar snapshots. Reembolsar. Ver auditoría. **2FA obligatorio.** |
| `player` | Ver partidos, hacer/editar sus pronósticos antes del cierre, subir comprobante, ver ranking. **2FA opcional pero recomendado.** |

No hay registro público. El admin crea las cuentas manualmente con un correo y una contraseña temporal que el usuario debe cambiar en su primer login.

---

## 3. Modelo de datos (Supabase / Postgres)

```sql
-- Perfiles (extiende auth.users)
profiles (
  id uuid pk references auth.users(id),
  full_name text not null,
  display_name text not null,        -- el que se muestra en rankings
  role text not null check (role in ('admin','player')) default 'player',
  payment_status text not null check (payment_status in ('pending','submitted','confirmed','refunded')) default 'pending',
  must_change_password bool not null default true,
  is_active bool not null default true,
  created_at timestamptz default now()
)

-- Rondas (Grupos = ronda 1; Octavos = ronda 2, etc.)
rounds (
  id uuid pk,
  code text unique not null,         -- 'GROUPS', 'R16', 'QF', ...
  name text not null,                -- 'Fase de Grupos'
  closes_at timestamptz not null,    -- cierre global de pronósticos de esta ronda
  is_locked bool not null default false,   -- se setea al cierre o manualmente
  snapshot_at timestamptz,           -- cuándo se selló
  snapshot_hash text,                -- SHA-256 del PDF inmutable
  created_at timestamptz default now()
)

-- Equipos
teams (
  id smallint pk,
  name text not null,
  iso_code text,                     -- MEX, BRA, ARG, etc. (para banderas)
  group_letter text                  -- 'A'..'L' (null para eliminatorias)
)

-- Partidos
matches (
  id int pk,                         -- MatchID del Excel (1..72 para grupos)
  round_id uuid not null references rounds(id),
  group_letter text,                 -- 'A'..'L' (null para eliminatorias)
  home_team_id smallint references teams(id),
  away_team_id smallint references teams(id),
  kickoff_at timestamptz not null,   -- hora oficial en UTC
  venue text,
  home_score smallint,               -- llena el admin al final
  away_score smallint,
  status text not null check (status in ('scheduled','live','finished','cancelled')) default 'scheduled'
)

-- Pronósticos
predictions (
  id bigserial pk,
  user_id uuid not null references profiles(id),
  match_id int not null references matches(id),
  home_score smallint not null check (home_score >= 0 and home_score <= 30),
  away_score smallint not null check (away_score >= 0 and away_score <= 30),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, match_id)
)

-- Pagos
payments (
  id uuid pk,
  user_id uuid not null references profiles(id),
  amount_quetzales numeric(10,2) not null default 100,
  receipt_url text,                  -- a Storage (bucket privado)
  status text not null check (status in ('submitted','confirmed','rejected','refunded')),
  confirmed_by uuid references profiles(id),
  confirmed_at timestamptz,
  notes text,
  created_at timestamptz default now()
)

-- Snapshot inmutable de pronósticos al cierre
prediction_snapshots (
  id uuid pk,
  round_id uuid not null references rounds(id),
  user_id uuid not null references profiles(id),
  match_id int not null references matches(id),
  home_score smallint,
  away_score smallint,
  snapshot_at timestamptz not null default now(),
  unique (round_id, user_id, match_id)
)
-- Esta tabla es WRITE-ONCE: insert habilitado solo en función edge, update/delete bloqueados por trigger.

-- Bitácora de auditoría
audit_log (
  id bigserial pk,
  actor_id uuid references profiles(id),
  action text not null,              -- 'login','create_user','confirm_payment','set_result','generate_snapshot',...
  entity text,
  entity_id text,
  before jsonb,
  after jsonb,
  ip inet,
  user_agent text,
  created_at timestamptz default now()
)

-- Vista para ranking (no es tabla; se calcula en SQL)
v_standings AS (
  -- por cada user_id:
  --   pts = SUM(CASE WHEN exact_match THEN 3 WHEN result_match THEN 1 ELSE 0 END)
  --   exactos = SUM(CASE WHEN exact_match THEN 1 ELSE 0 END)
  --   resultados = SUM(CASE WHEN result_match AND NOT exact_match THEN 1 ELSE 0 END)
  -- ORDER BY pts DESC, exactos DESC, resultados DESC
)
```

### Reglas RLS (Row Level Security) — críticas para evitar fraude

```
profiles:
  SELECT: cualquier autenticado (solo expone full_name, display_name, role)
  UPDATE: solo el dueño, y solo full_name/display_name. role/payment_status solo admin.

rounds, teams, matches:
  SELECT: cualquier autenticado
  INSERT/UPDATE/DELETE: solo admin

predictions:
  SELECT antes del cierre: solo el dueño
  SELECT después del cierre: cualquier autenticado
  INSERT/UPDATE: solo el dueño Y solo si rounds.is_locked = false Y now() < rounds.closes_at
  DELETE: bloqueado

payments:
  SELECT: dueño + admin
  INSERT: dueño (un solo registro activo por usuario)
  UPDATE: solo admin (cambia status)
  receipt_url firmado, no público

prediction_snapshots:
  SELECT: cualquier autenticado (después de snapshot_at de la ronda)
  INSERT: solo función RPC `seal_round(round_id)` con SECURITY DEFINER
  UPDATE/DELETE: bloqueados por trigger AFTER que lanza exception

audit_log:
  SELECT: solo admin
  INSERT: solo desde servidor con service_role
```

---

## 4. Anti-fraude (es lo que más pediste)

Capas, de adentro hacia afuera:

1. **Auth fuerte**: passwords mínimo 8 caracteres, bloqueo tras 6 intentos fallidos.
2. **RLS en cada tabla**: el cliente nunca puede saltarse las reglas aunque manipule la request. Las claves del frontend son `anon` (sin permisos elevados).
3. **Cierre validado en servidor**: el endpoint que recibe pronósticos verifica `now() < rounds.closes_at` y `rounds.is_locked = false` en una transacción. No depende del reloj del cliente.
4. **Snapshot inmutable**: una vez sellada la ronda, los pronósticos se copian a `prediction_snapshots` que tiene triggers `BEFORE UPDATE/DELETE` que rechazan cualquier modificación. Para sellarla se calcula un SHA-256 de los datos y se almacena. El PDF descargable incluye ese hash; cualquiera puede recalcularlo y verificar.
5. **Audit log inmutable**: toda acción sensible (login, cambio de password, edición de pronóstico, confirmación de pago, ingreso de resultado, sellado de ronda, recálculo) deja huella con before/after, IP y user-agent.
6. **Cron de cierre automático**: Vercel Cron diario (plan Hobby permite 1/día) a las 00:05 GT corre `seal-rounds`, que sella cualquier ronda con `closes_at` vencido. La RLS ya bloquea escrituras en el instante exacto del cierre, así que el sweep diario solo genera snapshot + hash. El admin puede adelantarlo manualmente desde `/admin/rondas`.
7. **Service role solo en servidor**: la `SUPABASE_SERVICE_ROLE_KEY` jamás va al cliente. Solo se usa en Route Handlers de Next.js.
8. **Rate limiting**: máximo 30 escrituras/min por usuario en `predictions` (Upstash o middleware Vercel).
9. **Headers de seguridad**: CSP estricto, HSTS, no-store en endpoints de admin, sameSite=lax en cookies.
10. **Storage privado**: comprobantes de pago en bucket privado, acceso solo por URL firmada de 60s.
11. **Validación de scores**: 0 ≤ goles ≤ 30 (cualquier número raro = rechazo).
12. **Verificación de integridad opcional**: al final, exportar todos los pronósticos sellados + resultados + cálculos como CSV para que cualquier participante pueda reproducir el ranking en Excel.

---

## 5. Páginas / Rutas

### Lado jugador
- `/login` — email + password (+ 2FA si lo activó).
- `/cambio-password` — forzado en primer login.
- `/` — Dashboard personal: mis puntos, mi ranking actual, próximos partidos, % de mis pronósticos llenos, countdown al cierre.
- `/pronosticos` — vista tipo Excel, agrupada por día/grupo. Inputs de score con stepper grande (`-` `0` `+`) para móvil. Guarda con debounce. Indica "guardado" o "bloqueado".
- `/pago` — sube comprobante, ve estado.
- `/ranking` — tabla general con puntos, exactos, resultados acertados. Filtrable por grupo/jornada. Mi fila resaltada.
- `/partidos` — calendario con resultados oficiales y mi acierto/falla.
- `/reglas` — el PDF rendereado en HTML responsive.

### Lado admin (`/admin/*`)
- `/admin/usuarios` — alta, edición, desactivación, reset de password, ver estado de pago.
- `/admin/pagos` — bandeja de comprobantes pendientes, ver imagen, confirmar/rechazar.
- `/admin/rondas` — crear ronda, definir `closes_at`, sellar manualmente.
- `/admin/partidos` — CRUD partidos (antes del cierre); después solo capturar resultados.
- `/admin/resultados` — capturar `home_score`, `away_score`, marcar como `finished`. Recálculo automático del ranking.
- `/admin/snapshot` — generar PDF de respaldo, ver hash, descargar.
- `/admin/auditoria` — log de acciones.

---

## 6. Diseño visual

Estilo **fútbol serio** (no caricaturesco). Inspiración: app oficial FIFA / Onefootball / Sofascore.

- **Paleta**: verde cancha (`#0B6E4F` o `#1B5E20`) como primario, blanco hueso `#F8F9FA` de fondo, gris carbón `#1F2937` para texto, dorado `#D4A017` para acentos (premios, ganadores). Estados: verde acierto, ámbar pendiente, rojo fallo.
- **Tipografía**: Inter para UI, una serif gruesa (ej. Bebas Neue o Anton) para titulares grandes.
- **Iconografía**: banderas SVG circulares por equipo (de [flagcdn.com](https://flagcdn.com) o asset propio).
- **Mobile-first**: diseño en columna única hasta 768px, grid 2 columnas en tablet, 3 en desktop. Inputs táctiles de mínimo 44×44 px (Apple HIG). Sin hover-only.
- **Componentes clave**: `MatchCard` (banderas + countdown + inputs score), `RankingRow` (avatar+nombre+pts+chips de exactos/resultados), `CountdownBanner` (sticky arriba con tiempo al cierre).
- **Modo oscuro**: opcional, pero el verde+oro se ve muy bien.
- **Accesibilidad**: contraste AA, navegación por teclado, aria-labels en inputs de score.

---

## 7. Fases de desarrollo

Asumo que el cierre es **8 de junio de 2026** — hoy 12/05/2026, quedan ~4 semanas. Plan agresivo pero factible:

### Sprint 0 — Setup (2 días)
- Crear proyecto Vercel y Supabase. Configurar variables. Migraciones iniciales (schema + RLS + seeds de teams/matches desde el Excel).
- Layout base, sistema de design tokens, login y cambio de password forzado.

### Sprint 1 — Núcleo jugador (5 días)
- Pantalla de pronósticos con guardado en vivo.
- Subida de comprobante y bandeja admin.
- Calendario de partidos.

### Sprint 2 — Núcleo admin (4 días)
- CRUD usuarios + reset password.
- Confirmación de pagos.
- Captura de resultados oficiales.
- Cálculo de puntos (vista `v_standings`).
- Ranking público.

### Sprint 3 — Seguridad y transparencia (3 días)
- 2FA admin.
- Audit log.
- Función `seal_round` + cron de cierre.
- Generación de PDF/CSV de respaldo con hash.
- Rate limiting.

### Sprint 4 — Pulido + QA (4 días)
- Pruebas con 2-3 usuarios reales.
- Carga de los 72 partidos finales (verificar zona horaria y horas).
- Pruebas de carga (simular 30 usuarios guardando a la vez).
- Despliegue final.

**Buffer**: 1 semana antes del cierre para que los usuarios puedan llenar tranquilos.

---

## 8. Lo que necesito que configures antes de que codeemos

### 8.1 Cuenta Supabase
1. Crear proyecto en [supabase.com](https://supabase.com) (free tier alcanza).
2. Elegir región más cercana a Guatemala: **East US (North Virginia)** o **West US (Oregon)**.
3. En Authentication → Providers: dejar habilitado **Email** solamente.
4. En Authentication → Email Templates: editar plantillas en español.
5. En Authentication → MFA: habilitar TOTP.
6. En Storage: crear bucket privado llamado `payment-receipts`.
7. En Project Settings → API: copiar las 3 claves (te las pido abajo).
8. En Project Settings → Auth → Password requirements: mínimo 12 caracteres, requerir mayúscula + número.

### 8.2 Cuenta Vercel
1. Crear proyecto en [vercel.com](https://vercel.com), conectar al repo de GitHub (lo creamos después).
2. Plan Hobby es suficiente.
3. Habilitar **Vercel Cron** (incluido en Hobby).

### 8.3 Repositorio
- Crear repo en GitHub privado (yo te paso el comando exacto cuando lleguemos).

### 8.4 Variables de entorno que vas a pasarme

Para `.env.local` (desarrollo) y Vercel (producción):

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=          # de Project Settings → API
NEXT_PUBLIC_SUPABASE_ANON_KEY=     # de Project Settings → API (clave anon/public)
SUPABASE_SERVICE_ROLE_KEY=         # SECRETA, solo en servidor. Project Settings → API → service_role

# App
APP_TIMEZONE=America/Guatemala
APP_ROUND_GROUPS_CLOSES_AT=2026-06-08T23:59:00-06:00

# Cron y seguridad
CRON_SECRET=                       # genera con: openssl rand -hex 32
NEXTAUTH_URL=https://tu-dominio.vercel.app

# Opcional para rate limiting (Upstash Redis, free tier)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

### 8.5 Información adicional que necesito
- **Dominio**: ¿usarás un subdominio Vercel (`quiniela-xxx.vercel.app`) o un dominio propio?
- **Logo/branding**: ¿hay un logo de "Quiniela Mundial 2026" del organizador o lo diseñamos?
- **Cuenta de organizador inicial**: tu email para crearte como admin#1 cuando esté listo el alta.
- **Lista de partidos definitiva**: ¿confirmamos que los 72 partidos del Excel `quiniela mundial 2026.xlsx` son la lista oficial final (orden + sedes + horarios)? Las horas en el Excel parecen ser en hora local de la sede; confirmar si convertimos todo a `America/Guatemala` para mostrar.

---

## 9. Decisiones resueltas (sesión 12/05/2026)

1. **Visibilidad cruzada antes del cierre**: solo `display_name` + "X de 72 listos". Sin ver valores de pronósticos hasta el cierre.
2. **Notificaciones**: ninguna automática (ni email ni WhatsApp). Solo correos transaccionales nativos de Supabase Auth (alta, reset password).
3. **Retiro de cuenta**: anonimización (`is_active=false`, `display_name='Participante retirado'`, `full_name='[anonimizado]'`). No se borra para preservar auditoría.
4. **Marca de agua en PDF de respaldo**: ninguna. Solo hash SHA-256 al pie del PDF.
5. **Fecha de cierre**: la marcada en el PDF (`2026-06-08 23:59 GT`) es **provisional**. El admin puede editar `rounds.closes_at` desde `/admin/rondas` mientras `is_locked = false`. Cada cambio queda en `audit_log`.
6. **Zona horaria**: por defecto `America/Guatemala` vía `APP_TIMEZONE`. Configurable.
7. **Cuenta admin#1**: `oscarmazariegoss5@gmail.com`.

---

## 10. Resumen de decisiones tomadas

| Tema | Decisión |
|------|----------|
| Bloqueo de pronósticos | Cierre global único por ronda, configurable por el admin desde la app. |
| Alcance v1 | Solo fase de grupos (72 partidos). Eliminatorias = ronda 2 cargada por admin después. |
| Desempate | Exactos → Resultados → Sorteo público con commit-reveal. |
| Auth | Email + password. 2FA TOTP obligatorio admin, opcional jugador. |
| Registro | Manual por admin, sin signup público. |
| Notificaciones | Ninguna automática en v1. |
| Retiro | Anonimización (no borrado). |
| Visibilidad antes del cierre | Solo nombre + progreso (X/72). Valores ocultos. |
| Logo | SVG generado por el equipo de desarrollo. |
| Hosting | Vercel (frontend + serverless) + Supabase (DB + Auth + Storage). |
