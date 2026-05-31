// =============================================================================
// Quiniela Mundial 2026 — Setup de simulacro
// =============================================================================
// Crea una ronda "SIM" con 6 partidos cortos para validar el flujo end-to-end:
//   - Pronósticos
//   - Cierre y sellado con hash
//   - Captura de resultados oficiales
//   - Cálculo de ranking
//
// Uso:
//   node --env-file=.env.local scripts/sim-setup.mjs
//
// Requiere SUPABASE_SERVICE_ROLE_KEY válida en .env.local.
// =============================================================================

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key || /PEGAR_AQUI/.test(key)) {
  console.error("✗ Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SIM_ROUND_CODE = "SIM";
const SIM_MATCH_IDS = [1001, 1002, 1003, 1004, 1005, 1006];

// IDs reales del seed (no se tocan)
const TEAMS = {
  Mexico: 2,
  Brazil: 9,
  Spain: 31,
  Argentina: 38,
};

// 1. Ronda SIM con cierre 48h adelante
const closesAt = new Date(Date.now() + 48 * 3600 * 1000).toISOString();

console.log("→ Creando/actualizando ronda SIM...");
const { data: round, error: rErr } = await admin
  .from("rounds")
  .upsert(
    { code: SIM_ROUND_CODE, name: "Simulacro", closes_at: closesAt, is_locked: false },
    { onConflict: "code" },
  )
  .select("*")
  .single();
if (rErr) { console.error(rErr); process.exit(1); }
console.log(`  ✓ Ronda "${round.name}" (id=${round.id}) cierra ${closesAt}`);

// 2. 6 partidos en mini round-robin (México, Brasil, España, Argentina)
const now = Date.now();
const fixtures = [
  { id: 1001, home: TEAMS.Mexico,    away: TEAMS.Brazil,    h:  3 },
  { id: 1002, home: TEAMS.Spain,     away: TEAMS.Argentina, h:  6 },
  { id: 1003, home: TEAMS.Mexico,    away: TEAMS.Spain,     h:  9 },
  { id: 1004, home: TEAMS.Brazil,    away: TEAMS.Argentina, h: 12 },
  { id: 1005, home: TEAMS.Mexico,    away: TEAMS.Argentina, h: 15 },
  { id: 1006, home: TEAMS.Brazil,    away: TEAMS.Spain,     h: 18 },
];

const matchRows = fixtures.map((m) => ({
  id: m.id,
  round_id: round.id,
  group_letter: null,
  home_team_id: m.home,
  away_team_id: m.away,
  kickoff_at: new Date(now + m.h * 3600 * 1000).toISOString(),
  venue: "Estadio Simulacro",
  status: "scheduled",
  home_score: null,
  away_score: null,
}));

console.log(`→ Cargando ${matchRows.length} partidos de simulacro...`);
const { error: mErr } = await admin.from("matches").upsert(matchRows, { onConflict: "id" });
if (mErr) { console.error(mErr); process.exit(1); }
console.log(`  ✓ Partidos ${SIM_MATCH_IDS[0]}..${SIM_MATCH_IDS[SIM_MATCH_IDS.length - 1]} listos`);

console.log("");
console.log("LISTO. Próximos pasos:");
console.log("  1. Crea 5 usuarios de prueba desde /admin/usuarios");
console.log("  2. Entra como cada uno → /pronosticos?round=SIM y llena pronósticos");
console.log("  3. Vuelve como admin → /admin/rondas: cambia 'closes_at' de SIM a un tiempo cercano o sellala manualmente");
console.log("  4. Captura resultados desde /admin/resultados?round=SIM");
console.log("  5. Verifica /ranking");
console.log("");
console.log("Para limpiar todo después:  npm run sim:cleanup");
