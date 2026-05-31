import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateXlsx, type Row } from "@/lib/xlsx";
import { formatGT } from "@/lib/date";

export const dynamic = "force-dynamic";

/**
 * Descarga un comprobante .xlsx con los pronósticos del jugador autenticado
 * para una ronda. Sólo se permite si están TODOS los pronósticos cargados.
 *
 *   GET /api/pronosticos/export?round=GROUPS
 *
 * El archivo incluye metadata de auditoría (usuario, timestamp, hash SHA-256
 * del contenido) para detectar manipulación posterior.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const roundCode = url.searchParams.get("round") ?? "GROUPS";

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "no-session" }, { status: 401 });
  }

  const [profileRes, roundRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, full_name, is_active")
      .eq("id", user.id)
      .single(),
    supabase
      .from("rounds")
      .select("id, name, code, closes_at, is_locked")
      .eq("code", roundCode)
      .maybeSingle(),
  ]);

  if (!profileRes.data?.is_active) {
    return NextResponse.json({ error: "inactive" }, { status: 403 });
  }
  if (!roundRes.data) {
    return NextResponse.json({ error: "round-not-found" }, { status: 404 });
  }

  const round = roundRes.data;
  const profile = profileRes.data;

  const [matchesRes, predsRes, teamsRes] = await Promise.all([
    supabase
      .from("matches")
      .select(
        "id, group_letter, kickoff_at, venue, home_team_id, away_team_id, home_score, away_score, status",
      )
      .eq("round_id", round.id)
      .order("kickoff_at", { ascending: true }),
    supabase
      .from("predictions")
      .select("match_id, home_score, away_score, created_at, updated_at")
      .eq("user_id", user.id),
    supabase.from("teams").select("id, name, iso_code"),
  ]);

  const matches = matchesRes.data ?? [];
  const preds = predsRes.data ?? [];
  const teams = teamsRes.data ?? [];

  if (matches.length === 0) {
    return NextResponse.json({ error: "no-matches" }, { status: 404 });
  }

  const teamById = new Map(teams.map((t) => [t.id, t]));
  const predByMatch = new Map(preds.map((p) => [p.match_id, p]));

  // ↳ exigir cobertura total antes de permitir descarga.
  const filledForRound = matches.filter((m) => predByMatch.has(m.id)).length;
  if (filledForRound < matches.length) {
    return NextResponse.json(
      {
        error: "incomplete",
        filled: filledForRound,
        total: matches.length,
        message: `Necesitas cargar los ${matches.length} pronósticos antes de descargar (llevas ${filledForRound}).`,
      },
      { status: 400 },
    );
  }

  // ── Construir filas ──
  const headers = [
    "Partido #",
    "Grupo",
    "Fecha (GT)",
    "Local",
    "Visitante",
    "Mi pronóstico",
    "Resultado oficial",
    "Estado",
    "Pronóstico creado",
    "Última edición",
  ];

  const rows: Row[] = matches.map((m) => {
    const pred = predByMatch.get(m.id)!;
    const home = teamById.get(m.home_team_id);
    const away = teamById.get(m.away_team_id);
    const official =
      m.home_score !== null && m.away_score !== null
        ? `${m.home_score} - ${m.away_score}`
        : "—";
    return [
      m.id,
      m.group_letter ?? "—",
      formatGT(m.kickoff_at, { dateStyle: "short", timeStyle: "short" }),
      home?.name ?? `Equipo ${m.home_team_id}`,
      away?.name ?? `Equipo ${m.away_team_id}`,
      `${pred.home_score} - ${pred.away_score}`,
      official,
      statusLabel(m.status),
      formatGT(pred.created_at, { dateStyle: "short", timeStyle: "short" }),
      formatGT(pred.updated_at, { dateStyle: "short", timeStyle: "short" }),
    ];
  });

  // ── Hash de auditoría: invariante ante reformateo ──
  // Forma canónica: matchId|home-away|updated_at, ordenada por matchId.
  const canonical = matches
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
    `Quiniela Mundial 2026 · Comprobante de pronósticos`,
    `Ronda: ${round.name} (${round.code})`,
    `Jugador: ${profile.display_name}${profile.full_name && profile.full_name !== profile.display_name ? ` (${profile.full_name})` : ""}`,
    `Email: ${user.email ?? "—"}`,
    `Generado: ${formatGT(now, { dateStyle: "full", timeStyle: "long" })} GT`,
    `Total: ${matches.length} de ${matches.length} pronósticos cargados`,
    `Hash SHA-256 (auditoría): ${hash}`,
  ];

  const xlsx = generateXlsx({
    sheetName: `Pronósticos ${round.code}`.slice(0, 31),
    metadata,
    headers,
    rows,
  });

  const safeName = (profile.display_name || "usuario")
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
  const filename = `pronosticos-${round.code}-${safeName}-${stamp}.xlsx`;

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

function statusLabel(s: string): string {
  switch (s) {
    case "scheduled": return "Programado";
    case "live":      return "En curso";
    case "finished":  return "Finalizado";
    case "cancelled": return "Cancelado";
    default:          return s;
  }
}
