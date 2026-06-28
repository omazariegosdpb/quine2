import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { requireSession } from "@/lib/auth/session";
import {
  createSupabaseServerClient,
  createSupabaseAdminClient,
} from "@/lib/supabase/server";

export const metadata = { title: "Ranking · Quiniela Mundial 2026" };

type StandingRow = {
  user_id: string;
  display_name: string;
  is_active: boolean;
  points: number;
  exact_count: number;
  result_count: number;
};

// Orden del leaderboard: pts ↓, exactos ↓, resultados ↓, nombre ↑.
function compareStandings(a: StandingRow, b: StandingRow) {
  return (
    b.points - a.points
    || b.exact_count - a.exact_count
    || b.result_count - a.result_count
    || a.display_name.localeCompare(b.display_name)
  );
}

export default async function RankingPage({
  searchParams,
}: {
  searchParams: Promise<{ grupo?: string }>;
}) {
  const session = await requireSession();
  const supabase = await createSupabaseServerClient();
  const { grupo } = await searchParams;

  // Rondas activas: sirven para las pestañas y para acotar el conteo de partidos.
  const { data: roundRows } = await supabase
    .from("rounds")
    .select("id, code, is_locked, ranking_group")
    .eq("is_active", true);
  const activeRounds = roundRows ?? [];

  // Grupos de ranking disponibles = rondas activas que fueron "amarradas".
  const groups = Array.from(
    new Set(activeRounds.map((r) => r.ranking_group).filter((g): g is string => !!g)),
  ).sort((a, b) => a.localeCompare(b));

  // Pestaña activa: "general" (la de siempre) o uno de los grupos amarrados.
  const selectedGroup = grupo && groups.includes(grupo) ? grupo : null;

  // Rondas relevantes a la pestaña actual:
  //   - General → rondas SIN grupo (cada ronda cuenta en un solo ranking).
  //   - Grupo   → rondas con ese grupo.
  const relevantRounds = activeRounds.filter((r) =>
    selectedGroup ? r.ranking_group === selectedGroup : r.ranking_group == null,
  );
  const relevantRoundIds = relevantRounds.map((r) => r.id);

  // --- Leaderboard según pestaña --------------------------------------------
  let sorted: StandingRow[] = [];
  if (selectedGroup) {
    const { data } = await supabase
      .from("v_standings_by_group")
      .select("*")
      .eq("ranking_group", selectedGroup)
      .eq("is_active", true);
    sorted = (data ?? []).slice().sort(compareStandings);
  } else {
    const { data } = await supabase
      .from("v_standings")
      .select("*")
      .eq("is_active", true);
    sorted = (data ?? []).slice().sort(compareStandings);
  }

  // --- Conteo de partidos acotado a las rondas de la pestaña ----------------
  let finishedMatches = 0;
  let totalMatches = 0;
  const relevantMatchIds = new Set<number>();
  if (relevantRoundIds.length > 0) {
    const { data: matchRows } = await supabase
      .from("matches")
      .select("id, status")
      .in("round_id", relevantRoundIds);
    for (const m of matchRows ?? []) {
      relevantMatchIds.add(m.id);
      if (m.status === "finished") finishedMatches++;
    }
    totalMatches = relevantMatchIds.size;
  }

  // --- Datos extra SOLO para el ranking general -----------------------------
  // (progreso por jugador y delta del último partido; quedan en el General.)
  let locked = false;
  let lastMatchLabel: string | null = null;
  const completedByUser = new Map<string, number>();
  const lastDeltaByUser = new Map<string, number>();
  let lastMatch: { id: number } | null = null;

  if (!selectedGroup) {
    // "Bloqueado" = la fase de grupos ya está sellada (misma regla que antes).
    const groupsRound = activeRounds.find((r) => r.code === "GROUPS");
    locked = groupsRound?.is_locked ?? false;

    // Conteo de pronósticos por usuario, acotado a los partidos del General.
    //
    // Visibilidad: con el cliente de sesión, RLS solo deja a un jugador leer SUS
    // propios pronósticos antes del cierre, así que los demás le salían 0/72.
    // Para que TODOS vean el conteo (solo el número, nunca las jugadas ajenas)
    // agregamos con el service-role (salta RLS). Sin service role, el jugador
    // solo verá el suyo. Paginamos porque PostgREST devuelve máx. 1000 filas.
    let counter = supabase;
    try {
      counter = createSupabaseAdminClient();
    } catch {
      // sin service role: el jugador solo verá el conteo propio.
    }

    if (!locked && relevantMatchIds.size > 0) {
      const pageSize = 1000;
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await counter
          .from("predictions")
          .select("user_id, match_id")
          // orden por clave única (user_id, match_id) → paginación estable
          .order("user_id", { ascending: true })
          .order("match_id", { ascending: true })
          .range(from, from + pageSize - 1);
        if (error || !data || data.length === 0) break;
        for (const r of data) {
          if (relevantMatchIds.has(r.match_id)) {
            completedByUser.set(r.user_id, (completedByUser.get(r.user_id) ?? 0) + 1);
          }
        }
        if (data.length < pageSize) break;
      }
    }

    // Último partido con resultado dentro del General (kickoff más reciente).
    const { data: lastMatchRows } = await supabase
      .from("matches")
      .select("id, home_team_id, away_team_id, home_score, away_score")
      .in("round_id", relevantRoundIds)
      .eq("status", "finished")
      .not("home_score", "is", null)
      .not("away_score", "is", null)
      .order("kickoff_at", { ascending: false })
      .limit(1);
    const lm = lastMatchRows?.[0] ?? null;

    if (lm) {
      lastMatch = { id: lm.id };
      const rHome = lm.home_score ?? 0;
      const rAway = lm.away_score ?? 0;

      const { data: lmTeams } = await supabase
        .from("teams")
        .select("id, name")
        .in("id", [lm.home_team_id, lm.away_team_id]);
      const nameById = new Map((lmTeams ?? []).map((t) => [t.id, t.name]));
      lastMatchLabel = `${nameById.get(lm.home_team_id) ?? "?"} vs ${nameById.get(lm.away_team_id) ?? "?"}`;

      const { data: lmPreds } = await counter
        .from("predictions")
        .select("user_id, home_score, away_score")
        .eq("match_id", lm.id);
      for (const p of lmPreds ?? []) {
        const exact = p.home_score === rHome && p.away_score === rAway;
        const result = Math.sign(p.home_score - p.away_score) === Math.sign(rHome - rAway);
        lastDeltaByUser.set(p.user_id, exact ? 3 : result ? 1 : 0);
      }
    }
  }

  const showProgress = !selectedGroup && !locked;

  return (
    <>
      <Header profile={session.profile} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-3 py-6 sm:px-4">
        <p className="font-display text-xs uppercase tracking-widest text-[var(--color-pitch-700)]">
          {selectedGroup ? "Ranking por grupo" : "Tabla general"}
        </p>
        <h1 className="font-display text-3xl text-[var(--color-text)] md:text-4xl">
          {selectedGroup ? selectedGroup : "Ranking"}
        </h1>

        <p className="mt-1 text-sm text-[var(--color-text-soft)]">
          Partidos jugados: {finishedMatches} / {totalMatches}
          {selectedGroup
            ? " · suma solo las rondas de este grupo"
            : !locked && " · pronósticos visibles después del cierre"}
        </p>

        {groups.length > 0 && (
          <RankingTabs groups={groups} selected={selectedGroup} />
        )}

        {!selectedGroup && lastMatchLabel && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-info-100)] bg-[var(--color-info-50)] px-3 py-2 text-sm text-[var(--color-info-800)]">
            <span aria-hidden>⚽️</span>
            <span>
              Tras <strong>{lastMatchLabel}</strong>, lo que sumó cada quien:
            </span>
          </p>
        )}

        <ol className="mt-5 flex flex-col gap-2">
          {sorted.map((row, idx) => (
            <li key={row.user_id}>
              <Row
                pos={idx + 1}
                name={row.display_name}
                points={row.points}
                exact={row.exact_count}
                result={row.result_count}
                isSelf={row.user_id === session.userId}
                progress={showProgress ? completedByUser.get(row.user_id) ?? 0 : null}
                progressMax={totalMatches}
                lastDelta={!selectedGroup && lastMatch ? lastDeltaByUser.get(row.user_id) ?? 0 : null}
              />
            </li>
          ))}
          {sorted.length === 0 && (
            <li className="rounded-md border border-dashed border-[var(--color-border)] px-4 py-6 text-center text-sm text-[var(--color-text-soft)]">
              Aún no hay puntos. El ranking se llena cuando se capturen resultados oficiales.
            </li>
          )}
        </ol>
      </main>
    </>
  );
}

function RankingTabs({
  groups,
  selected,
}: {
  groups: string[];
  selected: string | null;
}) {
  const tabs: { key: string | null; label: string; href: string }[] = [
    { key: null, label: "General", href: "/ranking" },
    ...groups.map((g) => ({ key: g, label: g, href: `/ranking?grupo=${encodeURIComponent(g)}` })),
  ];
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      {tabs.map((t) => {
        const active = t.key === selected;
        return (
          <Link
            key={t.key ?? "__general__"}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={[
              "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
              active
                ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                : "border-[var(--color-border)] bg-white text-[var(--color-text-soft)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]",
            ].join(" ")}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}

function Row({
  pos, name, points, exact, result, isSelf, progress, progressMax, lastDelta,
}: {
  pos: number;
  name: string;
  points: number;
  exact: number;
  result: number;
  isSelf: boolean;
  progress: number | null;
  progressMax: number;
  lastDelta: number | null;
}) {
  const medal = pos === 1 ? "🥇" : pos === 2 ? "🥈" : pos === 3 ? "🥉" : null;
  return (
    <div
      className={[
        "flex items-center justify-between gap-3 rounded-xl border bg-white px-3 py-3 shadow-sm",
        isSelf ? "border-[var(--color-pitch-500)] ring-1 ring-[var(--color-pitch-200)]" : "border-[var(--color-border)]",
      ].join(" ")}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-pitch-50)] font-display text-lg text-[var(--color-pitch-800)]">
          {medal ?? pos}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {name}
            {isSelf && <span className="ml-1 text-xs font-normal text-[var(--color-pitch-700)]">(vos)</span>}
          </p>
          <p className="text-xs text-[var(--color-text-soft)]">
            {exact} exacto{exact === 1 ? "" : "s"} · {result} resultado{result === 1 ? "" : "s"}
            {progress !== null && <> · {progress}/{progressMax} listos</>}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {lastDelta !== null && <DeltaChip value={lastDelta} />}
        <div className="flex flex-col items-end">
          <span className="font-display text-2xl text-[var(--color-pitch-700)]">{points}</span>
          <span className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">pts</span>
        </div>
      </div>
    </div>
  );
}

function DeltaChip({ value }: { value: number }) {
  // +3 verde (exacto), +1 azul (resultado), +0 gris (sin acierto).
  const cls =
    value === 3
      ? "bg-[var(--color-pitch-100)] text-[var(--color-pitch-800)]"
      : value === 1
        ? "bg-[var(--color-info-50)] text-[var(--color-info-700)]"
        : "bg-[var(--color-stone-100)] text-[var(--color-muted)]";
  return (
    <span
      className={["inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold tabular-nums", cls].join(" ")}
      title="Puntos sumados en el último partido"
    >
      +{value}
    </span>
  );
}
