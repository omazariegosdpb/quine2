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
 * Descarga un .xlsx con TODOS los pronósticos de un jugador (todas las rondas),
 * comparados contra el resultado oficial y con los puntos obtenidos. Solo admin.
 *
 *   GET /api/admin/usuarios/export?user=<uuid>
 *
 * Incluye metadata de auditoría (jugador, admin que descarga, timestamp y hash
 * SHA-256 del contenido) y deja constancia en audit_log de quién lo exportó.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const targetId = url.searchParams.get("user");
  if (!targetId) {
    return NextResponse.json({ error: "missing-user" }, { status: 400 });
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

  const { data: target } = await supabase
    .from("profiles")
    .select("id, display_name, full_name, payment_status, is_active")
    .eq("id", targetId)
    .single();
  if (!target) {
    return NextResponse.json({ error: "user-not-found" }, { status: 404 });
  }

  const [roundsRes, matchesRes, predsRes, teamsRes] = await Promise.all([
    supabase.from("rounds").select("id, name, code").order("closes_at", { ascending: true }),
    supabase
      .from("matches")
      .select(
        "id, round_id, group_letter, kickoff_at, home_team_id, away_team_id, home_score, away_score, status",
      )
      .order("kickoff_at", { ascending: true }),
    supabase
      .from("predictions")
      .select("match_id, home_score, away_score, created_at, updated_at")
      .eq("user_id", targetId),
    supabase.from("teams").select("id, name, iso_code"),
  ]);

  const rounds = roundsRes.data ?? [];
  const matches = matchesRes.data ?? [];
  const preds = predsRes.data ?? [];
  const teams = teamsRes.data ?? [];

  const roundById = new Map(rounds.map((r) => [r.id, r]));
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const predByMatch = new Map(preds.map((p) => [p.match_id, p]));

  // ── Construir filas: solo partidos donde el jugador tiene pronóstico ──
  const headers = [
    "Ronda",
    "Partido #",
    "Grupo",
    "Fecha (GT)",
    "Local",
    "Visitante",
    "Pronóstico",
    "Resultado oficial",
    "Acierto",
    "Puntos",
    "Estado",
    "Creado",
    "Última edición",
  ];

  const predicted = matches.filter((m) => predByMatch.has(m.id));

  let totalPoints = 0;
  let exactCount = 0;
  let resultCount = 0;
  let missCount = 0;

  const rows: Row[] = predicted.map((m) => {
    const pred = predByMatch.get(m.id)!;
    const home = teamById.get(m.home_team_id);
    const away = teamById.get(m.away_team_id);
    const round = roundById.get(m.round_id);

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
        totalPoints += 3;
        exactCount += 1;
      } else if (kind === "result") {
        acierto = "Resultado";
        pts = 1;
        totalPoints += 1;
        resultCount += 1;
      } else {
        acierto = "Fallo";
        pts = 0;
        missCount += 1;
      }
    }

    return [
      round?.name ?? "—",
      m.id,
      m.group_letter ?? "—",
      formatGT(m.kickoff_at, { dateStyle: "short", timeStyle: "short" }),
      home?.name ?? `Equipo ${m.home_team_id}`,
      away?.name ?? `Equipo ${m.away_team_id}`,
      `${pred.home_score} - ${pred.away_score}`,
      official,
      acierto,
      pts,
      statusLabel(m.status),
      formatGT(pred.created_at, { dateStyle: "short", timeStyle: "short" }),
      formatGT(pred.updated_at, { dateStyle: "short", timeStyle: "short" }),
    ];
  });

  // ── Hash de auditoría: invariante ante reformateo ──
  // Forma canónica: matchId|home-away|updated_at, ordenada por matchId.
  const canonical = predicted
    .slice()
    .sort((a, b) => a.id - b.id)
    .map((m) => {
      const p = predByMatch.get(m.id)!;
      return `${m.id}|${p.home_score}-${p.away_score}|${p.updated_at}`;
    })
    .join("\n");
  const hash = crypto.createHash("sha256").update(canonical).digest("hex");

  const now = new Date();
  const metadata = [
    `Quiniela Mundial 2026 · Auditoría de pronósticos`,
    `Jugador: ${target.display_name}${target.full_name && target.full_name !== target.display_name ? ` (${target.full_name})` : ""}`,
    `Estado del jugador: ${target.is_active ? "activo" : "retirado"} · Pago: ${target.payment_status}`,
    `Pronósticos cargados: ${predicted.length} de ${matches.length} partidos`,
    `Puntos: ${totalPoints} (exactos ${exactCount}, resultado ${resultCount}, fallos ${missCount})`,
    `Exportado por: ${me ? user.email ?? "admin" : "admin"} (${user.id})`,
    `Generado: ${formatGT(now, { dateStyle: "full", timeStyle: "long" })} GT`,
    `Hash SHA-256 (auditoría): ${hash}`,
  ];

  const xlsx = generateXlsx({
    sheetName: "Auditoría pronósticos",
    metadata,
    headers,
    rows,
  });

  // ── Dejar constancia de la exportación ──
  try {
    const admin = createSupabaseAdminClient();
    await admin.from("audit_log").insert({
      actor_id: user.id,
      action: "export_user_results",
      entity: "profiles",
      entity_id: targetId,
      after_val: {
        predictions: predicted.length,
        total_matches: matches.length,
        points: totalPoints,
        hash,
      },
    } as never);
  } catch {
    // Si falta el service role, no bloqueamos la descarga; solo no queda el log.
  }

  const safeName = (target.display_name || "usuario")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const stamp = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Guatemala",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(now)
    .replace(/-/g, "");
  const filename = `auditoria-${safeName}-${stamp}.xlsx`;

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

function statusLabel(s: string): string {
  switch (s) {
    case "scheduled": return "Programado";
    case "live":      return "En curso";
    case "finished":  return "Finalizado";
    case "cancelled": return "Cancelado";
    default:          return s;
  }
}
