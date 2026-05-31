// =============================================================================
// Quiniela Mundial 2026 — Limpieza del simulacro
// =============================================================================
// Borra la ronda SIM, sus partidos y todos los pronósticos relacionados.
// NO toca la ronda GROUPS ni los partidos del Mundial real.
//
// Uso:
//   node --env-file=.env.local scripts/sim-cleanup.mjs
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

// 1. Buscar la ronda SIM
const { data: round, error: rErr } = await admin
  .from("rounds")
  .select("id, code, name, is_locked")
  .eq("code", SIM_ROUND_CODE)
  .maybeSingle();

if (rErr) { console.error(rErr); process.exit(1); }
if (!round) {
  console.log("✓ No hay ronda SIM. Nada que limpiar.");
  process.exit(0);
}

console.log(`→ Limpiando ronda "${round.name}" (id=${round.id})...`);

// 2. Buscar partidos SIM para borrar predictions y luego matches.
const { data: matches } = await admin
  .from("matches")
  .select("id")
  .eq("round_id", round.id);

const matchIds = (matches ?? []).map((m) => m.id);

if (matchIds.length > 0) {
  console.log(`  → Borrando pronósticos de ${matchIds.length} partidos...`);
  // RLS delete está bloqueado, pero el service_role la salta.
  const { error } = await admin.from("predictions").delete().in("match_id", matchIds);
  if (error) { console.error("  ✗ predictions:", error.message); }
  else console.log(`  ✓ Pronósticos borrados`);

  // Snapshots si la ronda fue sellada. Bypass del trigger:
  // El trigger bloquea desde dentro de la DB. Necesitamos un SQL function temporal o desabilitarlo.
  // Más simple: dejar los snapshots como artefacto y borrar solo la ronda + matches.
  // Sin embargo, foreign keys de snapshots → matches/rounds bloquearán delete.

  if (round.is_locked) {
    console.log(`  → La ronda está sellada; intentando borrar snapshots...`);
    // Bajamos triggers vía un RPC custom? Por simplicidad, abortamos y avisamos.
    const { error: snapErr } = await admin.rpc("force_delete_snapshots" as never, { p_round_id: round.id } as never);
    if (snapErr) {
      console.error(`  ✗ No se pudieron borrar snapshots (probablemente falta la función helper).`);
      console.error(`    Mensaje: ${snapErr.message}`);
      console.error(`    Como workaround, ejecuta este SQL en el SQL Editor:`);
      console.error(`      ALTER TABLE public.prediction_snapshots DISABLE TRIGGER ALL;`);
      console.error(`      DELETE FROM public.prediction_snapshots WHERE round_id = '${round.id}';`);
      console.error(`      ALTER TABLE public.prediction_snapshots ENABLE TRIGGER ALL;`);
      process.exit(1);
    }
  }

  console.log(`  → Borrando partidos...`);
  const { error: mErr } = await admin.from("matches").delete().in("id", matchIds);
  if (mErr) { console.error("  ✗ matches:", mErr.message); process.exit(1); }
  console.log(`  ✓ Partidos borrados`);
}

// 3. Borrar la ronda
const { error: rdErr } = await admin.from("rounds").delete().eq("id", round.id);
if (rdErr) {
  console.error("  ✗ ronda:", rdErr.message);
  process.exit(1);
}
console.log(`  ✓ Ronda eliminada`);

console.log("");
console.log("✓ Simulacro limpiado.");
console.log("Recordá borrar manualmente los usuarios de prueba desde /admin/usuarios (botón 'Retirar').");
