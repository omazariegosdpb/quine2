import { Header } from "@/components/layout/Header";
import { Alert } from "@/components/ui/Alert";
import { requireSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatGT, daysUntil } from "@/lib/date";
import { PredictionsClient, type MatchVM } from "@/app/pronosticos/PredictionsClient";
import { RoundSelector } from "@/app/pronosticos/RoundSelector";

export const metadata = {
  title: "Pronósticos · Quiniela Mundial 2026",
};

export default async function PronosticosPage({
  searchParams,
}: {
  searchParams: Promise<{ round?: string }>;
}) {
  const session = await requireSession();
  const supabase = await createSupabaseServerClient();
  const { round: requestedCode } = await searchParams;

  // Admins ven todas las rondas (activas e inactivas); jugadores solo las activas.
  const isAdmin = session.profile.role === "admin";
  // Gate de pago: solo confirmed (o admin) puede capturar pronósticos.
  const paymentBlocked = !isAdmin && session.profile.payment_status !== "confirmed";

  const { data: allRounds } = await supabase
    .from("rounds")
    .select("*")
    .order("closes_at", { ascending: true });
  const rounds = isAdmin ? allRounds : (allRounds ?? []).filter((r) => r.is_active);

  // Default: ronda activa con menor closes_at no sellada; sino la primera activa.
  let round = null as null | NonNullable<typeof rounds>[number];
  if (requestedCode && rounds) {
    round = rounds.find((r) => r.code === requestedCode) ?? null;
  }
  if (!round && rounds) {
    round = rounds.find((r) => !r.is_locked && r.is_active) ?? rounds.find((r) => r.is_active) ?? rounds[0] ?? null;
  }

  if (!round) {
    return (
      <>
        <Header profile={session.profile} />
        <main className="mx-auto w-full max-w-3xl flex-1 px-3 py-5 sm:px-4">
          <Alert tone="info">No hay rondas configuradas todavía.</Alert>
        </main>
      </>
    );
  }

  const isLocked = round.is_locked;
  const closesAt = round.closes_at ? new Date(round.closes_at) : null;

  const [matchesRes, predsRes, teamsRes] = await Promise.all([
    supabase
      .from("matches")
      .select("*")
      .eq("round_id", round.id)
      .order("kickoff_at", { ascending: true }),
    supabase
      .from("predictions")
      .select("match_id, home_score, away_score")
      .eq("user_id", session.userId),
    supabase.from("teams").select("id, name, iso_code, group_letter"),
  ]);

  const matches = matchesRes.data ?? [];
  const predictions = predsRes.data ?? [];
  const teams = teamsRes.data ?? [];

  const teamById = new Map(teams.map((t) => [t.id, t]));
  const predByMatch = new Map(predictions.map((p) => [p.match_id, p]));

  const items: MatchVM[] = matches.map((m) => {
    const home = teamById.get(m.home_team_id);
    const away = teamById.get(m.away_team_id);
    const pred = predByMatch.get(m.id);
    return {
      id: m.id,
      group: m.group_letter ?? "—",
      kickoffAt: m.kickoff_at,
      venue: m.venue,
      status: m.status,
      homeScore: m.home_score,
      awayScore: m.away_score,
      home: {
        id: m.home_team_id,
        name: home?.name ?? `Equipo ${m.home_team_id}`,
        iso: home?.iso_code ?? null,
      },
      away: {
        id: m.away_team_id,
        name: away?.name ?? `Equipo ${m.away_team_id}`,
        iso: away?.iso_code ?? null,
      },
      pred: pred ? { home: pred.home_score, away: pred.away_score } : null,
    };
  });

  const matchIdsInRound = new Set(matches.map((m) => m.id));
  const totalDone = predictions.filter((p) => matchIdsInRound.has(p.match_id)).length;
  const total = matches.length;

  return (
    <>
      <Header profile={session.profile} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-3 py-5 sm:px-4">
        <div className="mb-3 flex flex-col gap-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="font-display text-xs uppercase tracking-widest text-[var(--color-pitch-700)]">
                {round.name}
              </p>
              <h1 className="font-display text-3xl text-[var(--color-text)] md:text-4xl">
                Mis pronósticos
              </h1>
            </div>
            <span className="rounded-full bg-[var(--color-pitch-50)] px-3 py-1 text-sm font-semibold text-[var(--color-pitch-700)]">
              {totalDone} / {total}
            </span>
          </div>

          <RoundSelector
            options={(rounds ?? []).map((r) => ({ code: r.code, name: r.name, is_locked: r.is_locked }))}
            current={round.code}
          />
        </div>

        {!round.is_active && (
          <div className="mb-4">
            <Alert tone="warning" title="Ronda inactiva">
              Esta ronda está desactivada. Los jugadores no la ven y los pronósticos no suman al ranking.
            </Alert>
          </div>
        )}

        <ExportRow
          roundCode={round.code}
          done={totalDone}
          total={total}
        />

        {paymentBlocked && (
          <div className="mb-4">
            <Alert tone="warning" title="Pago pendiente de confirmación">
              Para poder ingresar pronósticos necesitás que el organizador confirme tu pago.{" "}
              <a
                href="/pago"
                className="font-semibold underline underline-offset-2 hover:text-[var(--color-primary)]"
              >
                Ir a mi pago →
              </a>
            </Alert>
          </div>
        )}

        {isLocked ? (
          <div className="mb-4">
            <Alert tone="info" title="Ronda sellada">
              La ronda fue cerrada el {round.snapshot_at ? formatGT(round.snapshot_at) : ""}.
              Ya no se aceptan cambios.
            </Alert>
          </div>
        ) : closesAt ? (
          <div className="mb-4 rounded-md border border-[var(--color-pitch-200)] bg-[var(--color-pitch-50)] px-4 py-3 text-sm text-[var(--color-pitch-800)]">
            <strong>Cierre:</strong> {formatGT(closesAt, { dateStyle: "long", timeStyle: "short" })} GT
            {(() => {
              const d = daysUntil(closesAt);
              if (d > 0) return ` · en ${d} día${d === 1 ? "" : "s"}`;
              if (d === 0) return " · hoy";
              return " · cerrado";
            })()}
          </div>
        ) : null}

        <PredictionsClient items={items} locked={isLocked || paymentBlocked} />
      </main>
    </>
  );
}

function ExportRow({
  roundCode,
  done,
  total,
}: {
  roundCode: string;
  done: number;
  total: number;
}) {
  if (total === 0) return null;
  const complete = done >= total;

  if (!complete) {
    return (
      <div className="mb-4 flex items-center gap-3 rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 text-sm text-[var(--color-text-soft)]">
        <span
          aria-hidden
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-stone-200)] text-[var(--color-text-soft)]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 17v.01" />
            <path d="M12 13a2 2 0 1 0-2-2" />
            <circle cx="12" cy="12" r="10" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[var(--color-text)]">
            Comprobante en Excel — disponible al completar
          </p>
          <p className="text-xs">
            Llevas <strong className="text-[var(--color-text)]">{done}</strong> de{" "}
            <strong className="text-[var(--color-text)]">{total}</strong>. Termina los
            {" "}{total - done} pronóstico{total - done === 1 ? "" : "s"} restante
            {total - done === 1 ? "" : "s"} para poder descargarlo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-lg border border-[var(--color-pitch-300)] bg-[var(--color-pitch-50)] px-4 py-3 sm:flex-row sm:items-center">
      <span
        aria-hidden
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-white shadow-sm"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold text-[var(--color-pitch-800)]">
          ¡Quiniela completa! {done}/{total} pronósticos cargados.
        </p>
        <p className="text-xs text-[var(--color-pitch-800)]/80">
          Descargá tu comprobante .xlsx con sello de auditoría (hash SHA-256, fecha y usuario).
        </p>
      </div>
      <a
        href={`/api/pronosticos/export?round=${encodeURIComponent(roundCode)}`}
        download
        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-150 ease-out hover:bg-[var(--color-primary-700)] hover:shadow-md active:scale-[0.97] active:bg-[var(--color-primary-800)] active:shadow-inner"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        Descargar Excel
      </a>
    </div>
  );
}
