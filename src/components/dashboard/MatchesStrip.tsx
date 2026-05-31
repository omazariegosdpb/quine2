import Link from "next/link";
import { Flag } from "@/components/flags/Flag";
import { formatGT } from "@/lib/date";
import type { DayMatch, NearbyMatches } from "@/lib/dashboard";

type Tone = "past" | "today" | "future";

const TONES: Record<Tone, {
  border: string;
  bar: string;
  label: string;
  emoji: string;
  caption: string;
}> = {
  past: {
    border: "border-[var(--color-border)]",
    bar: "bg-[var(--color-stone-300)]",
    label: "Ayer",
    emoji: "📅",
    caption: "Resultado oficial",
  },
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
  const hasAny =
    matches.yesterday.length + matches.today.length + matches.tomorrow.length > 0;

  return (
    <section className="mt-6">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-display text-xl text-[var(--color-text)]">
          Calendario de partidos
        </h2>
        <Link
          href="/pronosticos"
          className="text-xs font-semibold text-[var(--color-info)] hover:underline"
        >
          Ver todos →
        </Link>
      </div>

      {!hasAny ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-white px-4 py-8 text-center">
          <p className="text-2xl">🌴</p>
          <p className="mt-1 text-sm text-[var(--color-text-soft)]">
            Sin partidos cerca de hoy. Volvé pronto.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <DayColumn tone="past" matches={matches.yesterday} />
          <DayColumn tone="today" matches={matches.today} />
          <DayColumn tone="future" matches={matches.tomorrow} />
        </div>
      )}
    </section>
  );
}

function DayColumn({ tone, matches }: { tone: Tone; matches: DayMatch[] }) {
  const t = TONES[tone];
  const main = matches[0] ?? null;
  const extra = matches.length - 1;

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
        {main && (
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            {formatGT(main.kickoffAt, { weekday: "short", day: "numeric", month: "short" })}
          </span>
        )}
      </div>

      <div className="px-4 pb-4 pt-2">
        {main ? <MatchRow m={main} tone={tone} /> : <EmptyRow tone={tone} />}
        {extra > 0 && (
          <Link
            href="/pronosticos"
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--color-info)] hover:underline"
          >
            + {extra} más {tone === "past" ? "ayer" : tone === "today" ? "hoy" : "mañana"}
            <span aria-hidden>›</span>
          </Link>
        )}
      </div>
    </div>
  );
}

function EmptyRow({ tone }: { tone: Tone }) {
  const msg =
    tone === "past" ? "Sin partido ayer." : tone === "today" ? "Sin partido hoy." : "Sin partido mañana.";
  return (
    <p className="rounded-md bg-[var(--color-surface-2)] px-3 py-4 text-center text-xs text-[var(--color-muted)]">
      {msg}
    </p>
  );
}

function MatchRow({ m, tone }: { m: DayMatch; tone: Tone }) {
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
          {tone === "past"
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

      <PredictionLine m={m} tone={tone} finished={finished} />
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
  tone,
  finished,
}: {
  m: DayMatch;
  tone: Tone;
  finished: boolean;
}) {
  if (!m.myPrediction) {
    if (tone === "past") {
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
