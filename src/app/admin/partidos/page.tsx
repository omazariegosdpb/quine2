import { createSupabaseServerClient } from "@/lib/supabase/server";
import { RoundSelector } from "@/app/pronosticos/RoundSelector";
import { Alert } from "@/components/ui/Alert";
import { Flag } from "@/components/flags/Flag";
import { formatGT } from "@/lib/date";
import { CreateMatchForm, EditMatchToggle } from "@/app/admin/partidos/MatchForm";

export const metadata = { title: "Partidos · Admin" };

export default async function AdminMatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ round?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const { round: requestedCode } = await searchParams;

  const [{ data: rounds }, { data: teams }] = await Promise.all([
    supabase.from("rounds").select("*").order("closes_at", { ascending: true }),
    supabase.from("teams").select("id, name, iso_code, group_letter").order("name", { ascending: true }),
  ]);

  let round = null as null | NonNullable<typeof rounds>[number];
  if (requestedCode && rounds) round = rounds.find((r) => r.code === requestedCode) ?? null;
  if (!round && rounds) round = rounds[0] ?? null;

  if (!round) {
    return (
      <Alert tone="info">
        No hay rondas creadas. Andá a <strong>/admin/rondas</strong> y crea una primero.
      </Alert>
    );
  }

  const { data: matches } = await supabase
    .from("matches")
    .select("*")
    .eq("round_id", round.id)
    .order("kickoff_at", { ascending: true });

  const teamById = new Map((teams ?? []).map((t) => [t.id, t]));

  // Para defaultear nuevo partido en el cierre - 1 día (suele ser razonable)
  const close = round.closes_at ? new Date(round.closes_at) : new Date();
  const suggestion = new Date(close.getTime() - 24 * 3600 * 1000);
  const defaultKickoffLocal = toGTLocalInput(suggestion.toISOString());

  return (
    <div className="flex flex-col gap-5">
      <RoundSelector
        options={(rounds ?? []).map((r) => ({ code: r.code, name: r.name, is_locked: r.is_locked }))}
        current={round.code}
      />

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-muted)]">
            {round.code}
          </p>
          <h2 className="font-display text-2xl text-[var(--color-text)]">
            Partidos de {round.name}
          </h2>
          <p className="text-sm text-[var(--color-text-soft)]">
            {(matches ?? []).length} partido{(matches ?? []).length === 1 ? "" : "s"}
            {round.is_locked && " · ronda sellada (solo lectura)"}
            {!round.is_active && " · ronda inactiva"}
          </p>
        </div>
        {!round.is_locked && (teams?.length ?? 0) > 0 && (
          <CreateMatchForm
            roundId={round.id}
            teams={(teams ?? []) as { id: number; name: string; iso_code: string | null; group_letter: string | null }[]}
            defaultKickoffLocal={defaultKickoffLocal}
          />
        )}
      </header>

      {round.is_locked && (
        <Alert tone="info">
          Esta ronda ya está sellada. No se pueden modificar ni crear partidos en ella.
        </Alert>
      )}

      <ul className="flex flex-col gap-2">
        {(matches ?? []).map((m) => {
          const home = teamById.get(m.home_team_id);
          const away = teamById.get(m.away_team_id);
          return (
            <li key={m.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
              <div className="grid grid-cols-1 gap-3 px-4 py-3 sm:grid-cols-[auto_1fr_auto] sm:items-center">
                <div className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
                  <span className="font-mono">#{m.id}</span>
                  {m.group_letter && (
                    <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[var(--color-primary)] px-1.5 text-[10px] font-bold text-white">
                      {m.group_letter}
                    </span>
                  )}
                  <span>{formatGT(m.kickoff_at, { dateStyle: "short", timeStyle: "short" })} GT</span>
                  <StatusChip status={m.status} />
                </div>

                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <div className="flex items-center gap-1.5">
                    <Flag fifa={home?.iso_code ?? undefined} size={20} alt={home?.name ?? ""} />
                    <span className="font-semibold">{home?.name ?? `Equipo ${m.home_team_id}`}</span>
                  </div>
                  <span className="text-[var(--color-muted)]">vs</span>
                  <div className="flex items-center gap-1.5">
                    <Flag fifa={away?.iso_code ?? undefined} size={20} alt={away?.name ?? ""} />
                    <span className="font-semibold">{away?.name ?? `Equipo ${m.away_team_id}`}</span>
                  </div>
                  {m.venue && (
                    <span className="hidden text-xs text-[var(--color-muted)] sm:inline">· {m.venue}</span>
                  )}
                </div>

                {!round.is_locked && (
                  <EditMatchToggle
                    match={m}
                    teams={(teams ?? []) as { id: number; name: string; iso_code: string | null; group_letter: string | null }[]}
                    kickoffAtLocal={toGTLocalInput(m.kickoff_at)}
                  />
                )}
              </div>
            </li>
          );
        })}
        {(!matches || matches.length === 0) && (
          <li className="rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-6 text-center text-sm text-[var(--color-text-soft)]">
            Esta ronda no tiene partidos todavía.
          </li>
        )}
      </ul>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    scheduled: { label: "programado", cls: "bg-[var(--color-stone-200)] text-[var(--color-stone-700)]" },
    live:      { label: "en vivo",    cls: "bg-[var(--color-danger)] text-white" },
    finished:  { label: "final",      cls: "bg-[var(--color-info)] text-white" },
    cancelled: { label: "cancelado",  cls: "bg-[var(--color-danger)] text-white" },
  };
  const m = map[status] ?? map.scheduled;
  return (
    <span className={["inline-block rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide", m.cls].join(" ")}>
      {m.label}
    </span>
  );
}

function toGTLocalInput(iso: string): string {
  const d = new Date(iso);
  const gt = new Date(d.getTime() - 6 * 60 * 60 * 1000);
  const yyyy = gt.getUTCFullYear();
  const mm = String(gt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(gt.getUTCDate()).padStart(2, "0");
  const HH = String(gt.getUTCHours()).padStart(2, "0");
  const MM = String(gt.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${HH}:${MM}`;
}
