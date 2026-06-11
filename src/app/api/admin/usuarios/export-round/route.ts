import { NextResponse } from "next/server";
import crypto from "node:crypto";
import {
  createSupabaseServerClient,
  createSupabaseAdminClient,
} from "@/lib/supabase/server";
import { generateXlsx, type Row } from "@/lib/xlsx";
import { formatGT } from "@/lib/date";

export const dynamic = "force-dynamic";

/**
 * Descarga un .xlsx con los pronósticos de TODOS los jugadores para una ronda,
 * comparados contra el resultado oficial y con los puntos obtenidos. Solo admin.
 *
 *   GET /api/admin/usuarios/export-round?round=GROUPS
 *
 * Una fila por (jugador × partido pronosticado), ordenada por jugador y fecha.
 * Incluye metadata de auditoría (ronda, admin que descarga, timestamp y hash
 * SHA-256 del contenido) y deja constancia en audit_log de quién lo exportó.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const roundCode = url.searchParams.get("round");
  if (!roundCode) {
    return NextResponse.json({ error: "missing-round" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "no-session" }, { status: 401 });
  }

  // ↳ exigir que quien descarga sea admin activo.
  const { data: me } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();
  if (!me || me.role !== "admin" || !me.is_active) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { data: round } = await supabase
    .from("rounds")
    .select("id, name, code")
    .eq("code", roundCode)
    .maybeSingle();
  if (!round) {
    return NextResponse.json({ error: "round-not-found" }, { status: 404 });
  }

  const { data: matchesData } = await supabase
    .from("matches")
    .select(
      "id, group_letter, kickoff_at, home_team_id, away_team_id, home_score, away_score, status",
    )
    .eq("round_id", round.id)
    .order("kickoff_at", { ascending: true });

  const matches = matchesData ?? [];
  if (matches.length === 0) {
    return NextResponse.json({ error: "no-matches" }, { status: 404 });
  }
  const matchIds = matches.map((m) => m.id);

  const [playersRes, predsRes, teamsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, full_name, payment_status, is_active")
      .eq("role", "player")
      .order("display_name", { ascending: true }),
    supabase
      .from("predictions")
      .select("user_id, match_id, home_score, away_score, created_at, updated_at")
      .in("match_id", matchIds),
    supabase.from("teams").select("id, name, iso_code"),
  ]);

  const players = playersRes.data ?? [];
  const preds = predsRes.data ?? [];
  const teams = teamsRes.data ?? [];

  const teamById = new Map(teams.map((t) => [t.id, t]));
  // predicciones indexadas por jugador → (match_id → pred)
  const predByUser = new Map<string, Map<number, (typeof preds)[number]>>();
  for (const p of preds) {
    let byMatch = predByUser.get(p.user_id);
    if (!byMatch) {
      byMatch = new Map();
      predByUser.set(p.user_id, byMatch);
    }
    byMatch.set(p.match_id, p);
  }

  const headers = [
    "Jugador",
    "Nombre completo",
    "Estado",
    "Partido #",
    "Grupo",
    "Fecha (GT)",
    "Local",
    "Visitante",
    "Pronóstico",
    "Resultado oficial",
    "Acierto",
    "Puntos",
    "Última edición",
  ];

  const rows: Row[] = [];
  let totalPredsAll = 0;
  // recolectar líneas canónicas para el hash (ordenadas determinísticamente)
  const canonicalLines: string[] = [];

  for (const player of players) {
    const byMatch = predByUser.get(player.id);
    if (!byMatch || byMatch.size === 0) continue; // jugador sin pronósticos en esta ronda

    for (const m of matches) {
      const pred = byMatch.get(m.id);
      if (!pred) continue;
      totalPredsAll += 1;

      const home = teamById.get(m.home_team_id);
      const away = teamById.get(m.away_team_id);
      const officialDone =
        m.status === "finished" && m.home_score !== null && m.away_score !== null;
      const official = officialDone ? `${m.home_score} - ${m.away_score}` : "—";

      let acierto = "—";
      let pts: number | string = "—";
      if (officialDone) {
        const kind = classify(pred.home_score, pred.away_score, m.home_score!, m.away_score!);
        if (kind === "exact") {
          acierto = "Exacto";
          pts = 3;
        } else if (kind === "result") {
          acierto = "Resultado";
          pts = 1;
        } else {
          acierto = "Fallo";
          pts = 0;
        }
      }

      rows.push([
        player.display_name,
        player.full_name && player.full_name !== player.display_name ? player.full_name : "",
        player.is_active ? "activo" : "retirado",
        m.id,
        m.group_letter ?? "—",
        formatGT(m.kickoff_at, { dateStyle: "short", timeStyle: "short" }),
        home?.name ?? `Equipo ${m.home_team_id}`,
        away?.name ?? `Equipo ${m.away_team_id}`,
        `${pred.home_score} - ${pred.away_score}`,
        official,
        acierto,
        pts,
        formatGT(pred.updated_at, { dateStyle: "short", timeStyle: "short" }),
      ]);

      canonicalLines.push(`${player.id}|${m.id}|${pred.home_score}-${pred.away_score}|${pred.updated_at}`);
    }
  }

  // ── Hash de auditoría: invariante ante reformateo ──
  const hash = crypto
    .createHash("sha256")
    .update(canonicalLines.sort().join("\n"))
    .digest("hex");

  const playersWithPreds = new Set(
    [...predByUser.entries()].filter(([, m]) => m.size > 0).map(([id]) => id),
  ).size;

  const now = new Date();
  const metadata = [
    `Quiniela Mundial 2026 · Auditoría por ronda`,
    `Ronda: ${round.name} (${round.code})`,
    `Partidos de la ronda: ${matches.length}`,
    `Jugadores con pronósticos: ${playersWithPreds} de ${players.length}`,
    `Filas (jugador × partido): ${totalPredsAll}`,
    `Exportado por: ${user.email ?? "admin"} (${user.id})`,
    `Generado: ${formatGT(now, { dateStyle: "full", timeStyle: "long" })} GT`,
    `Hash SHA-256 (auditoría): ${hash}`,
  ];

  const xlsx = generateXlsx({
    sheetName: `Auditoría ${round.code}`.slice(0, 31),
    metadata,
    headers,
    rows,
  });

  // ── Dejar constancia de la exportación ──
  try {
    const admin = createSupabaseAdminClient();
    await admin.from("audit_log").insert({
      actor_id: user.id,
      action: "export_round_results",
      entity: "rounds",
      entity_id: round.id,
      after_val: {
        round_code: round.code,
        players_with_predictions: playersWithPreds,
        rows: totalPredsAll,
        hash,
      },
    } as never);
  } catch {
    // Si falta el service role, no bloqueamos la descarga; solo no queda el log.
  }

  const stamp = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Guatemala",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(now)
    .replace(/-/g, "");
  const filename = `auditoria-ronda-${round.code}-${stamp}.xlsx`;

  return new NextResponse(new Uint8Array(xlsx), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store, private",
      "X-Audit-Hash": hash,
    },
  });
}

function classify(
  pHome: number,
  pAway: number,
  rHome: number,
  rAway: number,
): "exact" | "result" | "miss" {
  if (pHome === rHome && pAway === rAway) return "exact";
  if (Math.sign(pHome - pAway) === Math.sign(rHome - rAway)) return "result";
  return "miss";
}
