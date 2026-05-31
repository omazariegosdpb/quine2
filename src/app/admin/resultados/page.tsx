import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ResultRow } from "@/app/admin/resultados/ResultRow";
import { RoundSelector } from "@/app/pronosticos/RoundSelector";
import { Alert } from "@/components/ui/Alert";

export const metadata = { title: "Resultados · Admin" };

export default async function AdminResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ round?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const { round: requestedCode } = await searchParams;

  const { data: rounds } = await supabase
    .from("rounds")
    .select("*")
    .order("closes_at", { ascending: true });

  let round = null as null | NonNullable<typeof rounds>[number];
  if (requestedCode && rounds) round = rounds.find((r) => r.code === requestedCode) ?? null;
  if (!round && rounds) round = rounds[0] ?? null;

  if (!round) {
    return <Alert tone="info">No hay rondas configuradas todavía.</Alert>;
  }

  const [matchesRes, teamsRes] = await Promise.all([
    supabase.from("matches").select("*").eq("round_id", round.id).order("kickoff_at", { ascending: true }),
    supabase.from("teams").select("id, name, iso_code"),
  ]);

  const teamById = new Map((teamsRes.data ?? []).map((t) => [t.id, t]));
  const rows = (matchesRes.data ?? []).map((m) => ({
    id: m.id,
    group: m.group_letter ?? "—",
    kickoffAt: m.kickoff_at,
    home: {
      name: teamById.get(m.home_team_id)?.name ?? "—",
      iso: teamById.get(m.home_team_id)?.iso_code ?? null,
    },
    away: {
      name: teamById.get(m.away_team_id)?.name ?? "—",
      iso: teamById.get(m.away_team_id)?.iso_code ?? null,
    },
    homeScore: m.home_score,
    awayScore: m.away_score,
    status: m.status,
  }));

  const finished = rows.filter((r) => r.status === "finished").length;

  return (
    <div className="flex flex-col gap-4">
      <RoundSelector
        options={(rounds ?? []).map((r) => ({ code: r.code, name: r.name, is_locked: r.is_locked }))}
        current={round.code}
      />
      <div className="rounded-xl border border-[var(--color-border)] bg-white shadow-sm">
        <header className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-muted)]">
              {round.name}
            </p>
            <h2 className="font-display text-xl text-[var(--color-text)]">Resultados oficiales</h2>
            <p className="text-sm text-[var(--color-text-soft)]">
              Llená cuando termine cada partido. Guardar recalcula el ranking automáticamente.
            </p>
          </div>
          <span className="text-sm text-[var(--color-text-soft)]">
            {finished} / {rows.length} jugados
          </span>
        </header>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--color-bg)] text-left text-xs uppercase tracking-wider text-[var(--color-text-soft)]">
              <tr>
                <th className="px-3 py-2">ID · Grupo</th>
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Local</th>
                <th className="px-3 py-2">Marcador</th>
                <th className="px-3 py-2">Visita</th>
                <th className="px-3 py-2">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {rows.map((r) => <ResultRow key={r.id} row={r} />)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
