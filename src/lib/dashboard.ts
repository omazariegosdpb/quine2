import { createSupabaseServerClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";

const TZ = publicEnv.appTimezone; // America/Guatemala (UTC-6, sin DST)

export type DayMatch = {
  id: number;
  kickoffAt: string;
  venue: string | null;
  status: "scheduled" | "live" | "finished" | "cancelled";
  homeScore: number | null;
  awayScore: number | null;
  group: string | null;
  home: { id: number; name: string; iso: string | null };
  away: { id: number; name: string; iso: string | null };
  myPrediction: { home: number; away: number } | null;
};

export type NearbyMatches = {
  today: DayMatch[];
  tomorrow: DayMatch[];
};

export type MyStandings = {
  points: number;
  exactCount: number;
  resultCount: number;
  missCount: number;
  rank: number | null;
  totalPlayers: number;
};

/** Devuelve YYYY-MM-DD según el calendario GT. */
function gtDayBucket(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * Partidos de hoy / mañana con info de equipos y la predicción del jugador.
 * Usa zona horaria GT (UTC-6 fijo, Guatemala no tiene DST).
 */
export async function getNearbyMatches(userId: string): Promise<NearbyMatches> {
  const supabase = await createSupabaseServerClient();
  const now = new Date();

  const todayStr = gtDayBucket(now);
  const [y, m, d] = todayStr.split("-").map(Number);

  // GT midnight = UTC 06:00. Rango desde la medianoche GT de hoy hasta el
  // final del día de mañana (ya no incluimos ayer).
  const start = new Date(Date.UTC(y, m - 1, d, 6, 0, 0)).toISOString();
  const end = new Date(Date.UTC(y, m - 1, d + 2, 5, 59, 59)).toISOString();

  const tomorrowStr = gtDayBucket(new Date(now.getTime() + 86400 * 1000));

  const { data: matches } = await supabase
    .from("matches")
    .select(
      "id, kickoff_at, venue, status, home_score, away_score, group_letter, home_team_id, away_team_id",
    )
    .gte("kickoff_at", start)
    .lte("kickoff_at", end)
    .order("kickoff_at", { ascending: true });

  const list = matches ?? [];
  if (list.length === 0) {
    return { today: [], tomorrow: [] };
  }

  const teamIds = new Set<number>();
  for (const m of list) {
    teamIds.add(m.home_team_id);
    teamIds.add(m.away_team_id);
  }
  const matchIds = list.map((m) => m.id);

  const [{ data: teams }, { data: preds }] = await Promise.all([
    supabase.from("teams").select("id, name, iso_code").in("id", Array.from(teamIds)),
    supabase
      .from("predictions")
      .select("match_id, home_score, away_score")
      .eq("user_id", userId)
      .in("match_id", matchIds),
  ]);

  const teamById = new Map((teams ?? []).map((t) => [t.id, t]));
  const predByMatch = new Map(
    (preds ?? []).map((p) => [p.match_id, { home: p.home_score, away: p.away_score }]),
  );

  const buckets: NearbyMatches = { today: [], tomorrow: [] };

  for (const m of list) {
    const bucket = gtDayBucket(new Date(m.kickoff_at));
    const home = teamById.get(m.home_team_id);
    const away = teamById.get(m.away_team_id);
    const vm: DayMatch = {
      id: m.id,
      kickoffAt: m.kickoff_at,
      venue: m.venue,
      status: m.status,
      homeScore: m.home_score,
      awayScore: m.away_score,
      group: m.group_letter,
      home: {
        id: m.home_team_id,
        name: home?.name ?? `#${m.home_team_id}`,
        iso: home?.iso_code ?? null,
      },
      away: {
        id: m.away_team_id,
        name: away?.name ?? `#${m.away_team_id}`,
        iso: away?.iso_code ?? null,
      },
      myPrediction: predByMatch.get(m.id) ?? null,
    };
    if (bucket === todayStr) buckets.today.push(vm);
    else if (bucket === tomorrowStr) buckets.tomorrow.push(vm);
  }

  return buckets;
}

/**
 * Puntos y posición del jugador en el ranking global.
 * Usa la vista `v_standings`, que ya filtra rondas inactivas.
 */
export async function getMyStandings(userId: string): Promise<MyStandings> {
  const supabase = await createSupabaseServerClient();
  const { data: rows } = await supabase
    .from("v_standings")
    .select("user_id, points, exact_count, result_count, miss_count, is_active");

  const players = (rows ?? []).filter((r) => r.is_active);
  const sorted = players.slice().sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.exact_count !== a.exact_count) return b.exact_count - a.exact_count;
    return b.result_count - a.result_count;
  });

  const myRow = sorted.find((r) => r.user_id === userId);
  const rank = myRow ? sorted.indexOf(myRow) + 1 : null;

  return {
    points: myRow?.points ?? 0,
    exactCount: myRow?.exact_count ?? 0,
    resultCount: myRow?.result_count ?? 0,
    missCount: myRow?.miss_count ?? 0,
    rank,
    totalPlayers: players.length,
  };
}
