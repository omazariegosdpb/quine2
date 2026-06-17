import Link from "next/link";
import { Flag } from "@/components/flags/Flag";
import { formatGT } from "@/lib/date";
import type { DayMatch, NearbyMatches } from "@/lib/dashboard";

type Tone = "today" | "future";

const TONES: Record<Tone, {
  border: string;
  bar: string;
  label: string;
  emoji: string;
  caption: string;
}> = {
  today: {
    border: "border-[var(--color-pitch-300)] ring-1 ring-[var(--color-pitch-200)]",
    bar: "bg-tricolor",
    label: "Hoy",
    emoji: "⚽️",
    caption: "Día de partido",
  },
  future: {
    border: "border-[var(--color-border)]",
    bar: "bg-[var(--color-azure-300)]",
    label: "Mañana",
    emoji: "🗓️",
    caption: "Próximamente",
  },
};

export function MatchesStrip({ matches }: { matches: NearbyMatches }) {
  const hasAny = matches.today.length + matches.tomorrow.length > 0;

  return (
    <section className="mt-6">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-display text-xl text-[var(--color-text)]">
          Calendario de partidos
        </h2>
      </div>

      {!hasAny ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-white px-4 py-8 text-center">
          <p className="text-2xl">🌴</p>
          <p className="mt-1 text-sm text-[var(--color-text-soft)]">
            Sin partidos cerca de hoy. Volvé pronto.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <DayColumn tone="today" matches={matches.today} />
          <DayColumn tone="future" matches={matches.tomorrow} />
        </div>
      )}
    </section>
  );
}

function DayColumn({ tone, matches }: { tone: Tone; matches: DayMatch[] }) {
  const t = TONES[tone];
  const first = matches[0] ?? null;

  return (
    <div
      className={[
        "overflow-hidden rounded-xl border bg-white shadow-sm transition-all duration-150 ease-out hover:shadow-md",
        t.border,
      ].join(" ")}
    >
      <div className={`h-1 ${t.bar}`} aria-hidden />
      <div className="flex items-center justify-between px-4 pt-3">
        <span className="font-display text-xs uppercase tracking-widest text-[var(--color-text-soft)]">
          {t.emoji} {t.label}
        </span>
        {first && (
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            {formatGT(first.kickoffAt, { weekday: "short", day: "numeric", month: "short" })}
            {matches.length > 1 && ` · ${matches.length} partidos`}
          </span>
        )}
      </div>

      <div className="px-4 pb-4 pt-2">
        {matches.length === 0 ? (
          <EmptyRow tone={tone} />
        ) : (
          <ul className="flex flex-col gap-3">
            {matches.map((m) => (
              <li
                key={m.id}
                className="border-t border-[var(--color-border-soft)] pt-3 first:border-t-0 first:pt-0"
              >
                <MatchRow m={m} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function EmptyRow({ tone }: { tone: Tone }) {
  const msg = tone === "today" ? "Sin partido hoy." : "Sin partido mañana.";
  return (
    <p className="rounded-md bg-[var(--color-surface-2)] px-3 py-4 text-center text-xs text-[var(--color-muted)]">
      {msg}
    </p>
  );
}

function MatchRow({ m }: { m: DayMatch }) {
  const finished = m.status === "finished" && m.homeScore !== null && m.awayScore !== null;
  const live = m.status === "live";
  const kickoffLabel = formatGT(m.kickoffAt, { timeStyle: "short" });

  return (
    <div className="flex flex-col gap-2">
      <TeamLine
        name={m.home.name}
        iso={m.home.iso}
        score={finished || live ? m.homeScore : null}
        emphasized={
          finished && m.homeScore !== null && m.awayScore !== null && m.homeScore > m.awayScore
        }
      />
      <TeamLine
        name={m.away.name}
        iso={m.away.iso}
        score={finished || live ? m.awayScore : null}
        emphasized={
          finished && m.homeScore !== null && m.awayScore !== null && m.awayScore > m.homeScore
        }
      />

      <div className="mt-1 flex items-center justify-between text-[11px]">
        <span className="text-[var(--color-muted)]">
          {m.group ? `Grupo ${m.group} · ` : ""}
          {finished
            ? "Final"
            : live
              ? "En curso"
              : `${kickoffLabel} GT`}
        </span>
        {live && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-danger)]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-danger)]">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-danger)]" />
            En vivo
          </span>
        )}
      </div>

      {m.venue && (
        <p className="flex items-center gap-1 text-[11px] text-[var(--color-muted)]">
          <span aria-hidden>📍</span>
          <span className="min-w-0 truncate">{m.venue}</span>
        </p>
      )}

      <PredictionLine m={m} finished={finished} />
    </div>
  );
}

function TeamLine({
  name,
  iso,
  score,
  emphasized,
}: {
  name: string;
  iso: string | null;
  score: number | null;
  emphasized: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <Flag fifa={iso} size={22} alt={name} />
      <span
        className={[
          "min-w-0 flex-1 truncate text-sm",
          emphasized ? "font-bold text-[var(--color-text)]" : "text-[var(--color-text)]",
        ].join(" ")}
      >
        {name}
      </span>
      <span
        className={[
          "shrink-0 font-display text-lg tabular-nums",
          score === null
            ? "text-[var(--color-muted)]"
            : emphasized
              ? "text-[var(--color-pitch-700)]"
              : "text-[var(--color-text-soft)]",
        ].join(" ")}
      >
        {score === null ? "–" : score}
      </span>
    </div>
  );
}

function PredictionLine({
  m,
  finished,
}: {
  m: DayMatch;
  finished: boolean;
}) {
  if (!m.myPrediction) {
    if (finished) {
      return (
        <p className="rounded-md bg-[var(--color-stone-100)] px-2 py-1 text-[11px] text-[var(--color-muted)]">
          No hiciste pronóstico.
        </p>
      );
    }
    return (
      <Link
        href="/pronosticos"
        className="rounded-md bg-[var(--color-pitch-50)] px-2 py-1 text-[11px] font-semibold text-[var(--color-pitch-700)] transition-colors hover:bg-[var(--color-pitch-100)]"
      >
        ⚡ Hacé tu pronóstico →
      </Link>
    );
  }

  const { home, away } = m.myPrediction;
  if (finished && m.homeScore !== null && m.awayScore !== null) {
    const exact = home === m.homeScore && away === m.awayScore;
    const result =
      !exact &&
      Math.sign(home - away) === Math.sign(m.homeScore - m.awayScore);
    const label = exact ? "+3 exacto" : result ? "+1 resultado" : "0";
    const cls = exact
      ? "bg-[var(--color-pitch-100)] text-[var(--color-pitch-800)]"
      : result
        ? "bg-[var(--color-info-50)] text-[var(--color-info-700)]"
        : "bg-[var(--color-stone-100)] text-[var(--color-muted)]";
    return (
      <div className={`flex items-center justify-between rounded-md px-2 py-1 text-[11px] ${cls}`}>
        <span>
          Tu pronóstico: <strong className="tabular-nums">{home} – {away}</strong>
        </span>
        <span className="font-semibold">{label}</span>
      </div>
    );
  }

  return (
    <p className="rounded-md bg-[var(--color-stone-100)] px-2 py-1 text-[11px] text-[var(--color-text-soft)]">
      Tu pronóstico: <strong className="tabular-nums text-[var(--color-text)]">{home} – {away}</strong>
    </p>
  );
}
