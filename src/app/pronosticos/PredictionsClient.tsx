"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { Flag } from "@/components/flags/Flag";
import { formatGT } from "@/lib/date";

export type MatchVM = {
  id: number;
  group: string;
  kickoffAt: string;
  venue: string | null;
  status: "scheduled" | "live" | "finished" | "cancelled";
  homeScore: number | null;
  awayScore: number | null;
  home: { id: number; name: string; iso: string | null };
  away: { id: number; name: string; iso: string | null };
  pred: { home: number; away: number } | null;
};

type SaveState = "idle" | "saving" | "saved" | "error" | "locked" | "payment";

type DayGroup = {
  key: string;
  label: string;
  fullLabel: string;
  matches: MatchVM[];
};

type PredMap = Map<number, { home: number; away: number } | null>;

export function PredictionsClient({
  items,
  locked,
  focusToday = false,
  todayKey,
}: {
  items: MatchVM[];
  locked: boolean;
  focusToday?: boolean;
  todayKey?: string;
}) {
  // Fuente única de verdad para el estado de pronósticos.
  // Inicializa con lo que vino del server; cada guardado exitoso lo actualiza
  // y eso recalcula contadores de tabs y de la fecha en vivo.
  const [preds, setPreds] = useState<PredMap>(
    () => new Map(items.map((m) => [m.id, m.pred])),
  );

  // Si el server revalida y manda items nuevos, reconciliamos.
  useEffect(() => {
    setPreds(new Map(items.map((m) => [m.id, m.pred])));
  }, [items]);

  const days = useMemo<DayGroup[]>(() => {
    const map = new Map<string, DayGroup>();
    for (const m of items) {
      const key = isoDayInGT(m.kickoffAt);
      if (!map.has(key)) {
        map.set(key, {
          key,
          label: shortLabel(m.kickoffAt),
          fullLabel: longLabel(m.kickoffAt),
          matches: [],
        });
      }
      map.get(key)!.matches.push(m);
    }
    return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [items]);

  const initial = useMemo(() => {
    if (days.length === 0) return 0;
    // Ronda cerrada/jugándose: abrir en el día de hoy (el partido actual).
    if (focusToday && todayKey) {
      const exact = days.findIndex((d) => d.key === todayKey);
      if (exact !== -1) return exact;
      // Si hoy no tiene partidos, ir al día más cercano hacia adelante (o el último).
      const upcoming = days.findIndex((d) => d.key >= todayKey);
      return upcoming === -1 ? days.length - 1 : upcoming;
    }
    const firstIncomplete = days.findIndex((d) => d.matches.some((m) => !m.pred));
    return firstIncomplete === -1 ? 0 : firstIncomplete;
  }, [days, focusToday, todayKey]);

  const [activeIdx, setActiveIdx] = useState<number>(initial);
  const active = days[activeIdx];

  function handleSaved(matchId: number, home: number, away: number) {
    setPreds((prev) => {
      const next = new Map(prev);
      next.set(matchId, { home, away });
      return next;
    });
  }

  if (days.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-6 text-center text-sm text-[var(--color-text-soft)]">
        Aún no hay partidos cargados.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <DayTabs days={days} preds={preds} activeIdx={activeIdx} onChange={setActiveIdx} />

      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl text-[var(--color-text)] capitalize">
          {active.fullLabel}
        </h2>
        <DayCounter day={active} preds={preds} />
      </div>

      <ul className="flex flex-col gap-2.5">
        {active.matches.map((m) => (
          <li key={m.id}>
            <MatchCard
              match={m}
              pred={preds.get(m.id) ?? null}
              locked={locked}
              onSaved={handleSaved}
            />
          </li>
        ))}
      </ul>

      <DayNav
        prev={activeIdx > 0 ? days[activeIdx - 1] : null}
        next={activeIdx < days.length - 1 ? days[activeIdx + 1] : null}
        onPrev={() => setActiveIdx(activeIdx - 1)}
        onNext={() => setActiveIdx(activeIdx + 1)}
      />
    </div>
  );
}

// ============================================================================
// Tab bar: scroll horizontal uniforme con auto-centrado del activo
// ============================================================================
function DayTabs({
  days,
  preds,
  activeIdx,
  onChange,
}: {
  days: DayGroup[];
  preds: PredMap;
  activeIdx: number;
  onChange: (i: number) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Centra el tab activo cuando cambia
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const el = scroller.querySelector<HTMLButtonElement>(`[data-tab-idx="${activeIdx}"]`);
    if (!el) return;
    const offset = el.offsetLeft - scroller.clientWidth / 2 + el.clientWidth / 2;
    scroller.scrollTo({ left: offset, behavior: "smooth" });
  }, [activeIdx]);

  return (
    <div className="relative -mx-3 sm:mx-0">
      {/* Fade lateral para insinuar scroll */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-[var(--color-bg)] to-transparent" aria-hidden />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-[var(--color-bg)] to-transparent" aria-hidden />

      <div
        ref={scrollerRef}
        role="tablist"
        aria-label="Días de partidos"
        className="no-scrollbar flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-pl-3 px-3 pb-1"
      >
        {days.map((d, idx) => {
          const done = d.matches.filter((m) => preds.get(m.id) != null).length;
          const total = d.matches.length;
          const complete = done === total;
          const isActive = idx === activeIdx;
          return (
            <button
              key={d.key}
              data-tab-idx={idx}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(idx)}
              className={[
                "flex min-w-[112px] shrink-0 snap-center flex-col items-center gap-0.5 rounded-xl border px-3 py-2 transition-all",
                isActive
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white shadow-md"
                  : complete
                    ? "border-[var(--color-primary-100)] bg-[var(--color-primary-50)] text-[var(--color-primary-700)] hover:border-[var(--color-primary)]"
                    : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-soft)] hover:border-[var(--color-info)] hover:text-[var(--color-info)]",
              ].join(" ")}
            >
              <span className="text-xs font-semibold uppercase tracking-wide">
                {d.label}
              </span>
              <span
                className={[
                  "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none",
                  isActive
                    ? "bg-white/25 text-white"
                    : complete
                      ? "bg-[var(--color-primary)] text-white"
                      : "bg-[var(--color-bg)] text-[var(--color-text-soft)]",
                ].join(" ")}
              >
                {complete && <span aria-hidden>✓</span>}
                {done}/{total}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DayCounter({ day, preds }: { day: DayGroup; preds: PredMap }) {
  const done = day.matches.filter((m) => preds.get(m.id) != null).length;
  const total = day.matches.length;
  const complete = done === total;
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        complete
          ? "bg-[var(--color-primary)] text-white"
          : "bg-[var(--color-info-50)] text-[var(--color-info-700)]",
      ].join(" ")}
    >
      {complete && "✓ "}
      {done}/{total} listos
    </span>
  );
}

function DayNav({
  prev, next, onPrev, onNext,
}: {
  prev: DayGroup | null;
  next: DayGroup | null;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="mt-2 flex items-stretch justify-between gap-2">
      <button
        type="button"
        disabled={!prev}
        onClick={onPrev}
        className="flex flex-1 items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-left text-sm font-medium text-[var(--color-text-soft)] shadow-sm transition-colors hover:border-[var(--color-info)] hover:text-[var(--color-info)] disabled:opacity-40 disabled:hover:border-[var(--color-border)] disabled:hover:text-[var(--color-text-soft)]"
      >
        <span className="text-lg leading-none">‹</span>
        <span className="min-w-0 flex-1 truncate">{prev ? prev.label : "—"}</span>
      </button>
      <button
        type="button"
        disabled={!next}
        onClick={onNext}
        className="flex flex-1 items-center justify-end gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-right text-sm font-medium text-[var(--color-text-soft)] shadow-sm transition-colors hover:border-[var(--color-info)] hover:text-[var(--color-info)] disabled:opacity-40 disabled:hover:border-[var(--color-border)] disabled:hover:text-[var(--color-text-soft)]"
      >
        <span className="min-w-0 flex-1 truncate">{next ? next.label : "—"}</span>
        <span className="text-lg leading-none">›</span>
      </button>
    </div>
  );
}

// ============================================================================
// MatchCard — visual por estado
// ============================================================================
function MatchCard({
  match,
  pred,
  locked,
  onSaved,
}: {
  match: MatchVM;
  pred: { home: number; away: number } | null;
  locked: boolean;
  onSaved: (matchId: number, home: number, away: number) => void;
}) {
  const [home, setHome] = useState<number | null>(pred ? pred.home : null);
  const [away, setAway] = useState<number | null>(pred ? pred.away : null);
  const [state, setState] = useState<SaveState>(locked ? "locked" : "idle");

  const finished = match.status === "finished";
  const readonly = locked || match.status !== "scheduled";

  // ¿Hay pronóstico cargado actualmente?
  const hasPick = home !== null && away !== null;

  function setHomeVal(v: number) {
    if (readonly) return;
    setHome(v);
    if (away !== null) commit(v, away);
  }
  function setAwayVal(v: number) {
    if (readonly) return;
    setAway(v);
    if (home !== null) commit(home, v);
  }
  function commit(h: number, a: number) {
    saveDebounced(match.id, h, a, setState, () => onSaved(match.id, h, a));
  }

  // Estado visual de la card:
  //   - finished  -> azul Hermes  (resultado oficial)
  //   - hasPick   -> verde        (ya pronosticado, listo)
  //   - vacío     -> rojo Antorcha (llamada a la acción)
  type Mood = "finished" | "done" | "todo";
  const mood: Mood = finished ? "finished" : hasPick ? "done" : "todo";

  const moodStyles: Record<Mood, { header: string; chip: string; side: string; tag?: { text: string; cls: string } }> = {
    finished: {
      header: "bg-[var(--color-info-50)] text-[var(--color-info-800)] border-[var(--color-info-100)]",
      chip:   "bg-[var(--color-info)] text-white",
      side:   "border-l-4 border-l-[var(--color-info)]",
      tag:    { text: "Final", cls: "bg-[var(--color-info)] text-white" },
    },
    done: {
      header: "bg-[var(--color-primary-50)] text-[var(--color-primary-800)] border-[var(--color-primary-100)]",
      chip:   "bg-[var(--color-primary)] text-white",
      side:   "border-l-4 border-l-[var(--color-primary)]",
      tag:    { text: "Pronosticado", cls: "bg-[var(--color-primary)] text-white" },
    },
    todo: {
      header: "bg-[var(--color-danger-50)] text-[var(--color-danger-700)] border-[var(--color-danger-100)]",
      chip:   "bg-[var(--color-danger)] text-white",
      side:   "border-l-4 border-l-[var(--color-danger)]",
      tag:    { text: "Pendiente", cls: "bg-[var(--color-danger)] text-white" },
    },
  };

  const m = moodStyles[mood];

  return (
    <div
      className={[
        "overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm transition-shadow hover:shadow-md",
        m.side,
      ].join(" ")}
    >
      <div className={["flex items-center justify-between gap-2 border-b px-3 py-2.5 text-xs", m.header].join(" ")}>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className={["inline-flex h-6 min-w-[1.5rem] shrink-0 items-center justify-center rounded-full px-2 text-[11px] font-bold", m.chip].join(" ")}>
              {match.group}
            </span>
            <span className="font-bold leading-none">
              {formatGT(match.kickoffAt, { timeStyle: "short" })} GT
            </span>
          </div>
          {match.venue && (
            <span className="flex min-w-0 items-center gap-1 opacity-75">
              <span aria-hidden>📍</span>
              <span className="truncate">{match.venue}</span>
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {m.tag && (
            <span className={["inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase leading-none tracking-wide", m.tag.cls].join(" ")}>
              {m.tag.text}
            </span>
          )}
          <SaveIndicator state={state} />
        </div>
      </div>

      <div className="flex flex-col">
        <TeamRow
          team={match.home}
          value={home}
          onChange={setHomeVal}
          disabled={readonly}
          realScore={finished ? match.homeScore : null}
        />
        <div className="mx-3 h-px bg-[var(--color-border-soft)]" />
        <TeamRow
          team={match.away}
          value={away}
          onChange={setAwayVal}
          disabled={readonly}
          realScore={finished ? match.awayScore : null}
        />
      </div>

      {finished && match.homeScore !== null && match.awayScore !== null && (
        <div className="border-t border-[var(--color-info-100)] bg-[var(--color-info-50)] px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-info-700)]">
              Resultado oficial
            </span>
            <span className="font-display text-2xl text-[var(--color-info)]">
              {match.homeScore} <span className="text-[var(--color-info-700)]">–</span> {match.awayScore}
            </span>
          </div>
          {pred && (
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="text-[var(--color-info-700)]/70">
                Tu pronóstico: <strong>{pred.home} – {pred.away}</strong>
              </span>
              <PointsBadge
                pred={pred}
                real={{ home: match.homeScore, away: match.awayScore }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TeamRow({
  team,
  value,
  onChange,
  disabled,
  realScore,
}: {
  team: MatchVM["home"];
  value: number | null;
  onChange: (n: number) => void;
  disabled: boolean;
  realScore: number | null;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <Flag fifa={team.iso ?? undefined} size={32} alt={team.name} />
        <span className="truncate text-sm font-semibold sm:text-base">{team.name}</span>
      </div>
      <Stepper
        value={value}
        onChange={onChange}
        disabled={disabled}
        ariaLabel={`Goles de ${team.name}`}
        realScore={realScore}
      />
    </div>
  );
}

function Stepper({
  value,
  onChange,
  disabled,
  ariaLabel,
  realScore,
}: {
  value: number | null;
  onChange: (n: number) => void;
  disabled: boolean;
  ariaLabel: string;
  realScore: number | null;
}) {
  const display = value === null ? "—" : String(value);
  const canDec = !disabled && value !== null && value > 0;
  const canInc = !disabled && (value ?? 0) < 30;

  return (
    <div className="flex items-center gap-1">
      <StepperButton
        type="button"
        onClick={() => onChange(Math.max(0, (value ?? 0) - 1))}
        disabled={!canDec}
        aria-label={`Restar gol a ${ariaLabel}`}
      >
        −
      </StepperButton>
      <div
        role="status"
        aria-live="polite"
        aria-label={ariaLabel}
        className={[
          "flex h-11 w-12 items-center justify-center rounded-md border font-display text-2xl",
          disabled
            ? "border-[var(--color-stone-200)] bg-[var(--color-stone-50)] text-[var(--color-stone-500)]"
            : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)]",
          value === null ? "text-[var(--color-muted)]" : "",
        ].join(" ")}
      >
        {display}
      </div>
      {realScore !== null && (
        <span
          className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-info-50)] text-xs font-bold text-[var(--color-info-700)] ring-1 ring-[var(--color-info-100)]"
          title="Goles oficiales"
        >
          {realScore}
        </span>
      )}
      <StepperButton
        type="button"
        onClick={() => onChange(Math.min(30, (value ?? -1) + 1))}
        disabled={!canInc}
        aria-label={`Sumar gol a ${ariaLabel}`}
      >
        +
      </StepperButton>
    </div>
  );
}

function StepperButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={[
        "flex h-11 w-11 items-center justify-center rounded-md text-xl font-bold transition-colors",
        "bg-[var(--color-primary)] text-white shadow-sm hover:bg-[var(--color-primary-700)] active:bg-[var(--color-primary-800)]",
        "disabled:bg-[var(--color-stone-200)] disabled:text-[var(--color-stone-500)] disabled:cursor-not-allowed",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-primary)]",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "idle") return null;
  const map = {
    saving: { txt: "Guardando…",   cls: "text-[var(--color-muted)]" },
    saved:  { txt: "Guardado",     cls: "text-[var(--color-success)] font-semibold" },
    error:  { txt: "Error",        cls: "text-[var(--color-danger)] font-semibold" },
    locked: { txt: "Cerrado",      cls: "text-[var(--color-muted)]" },
    payment:{ txt: "Pago pendiente", cls: "text-[var(--color-danger)] font-semibold" },
  };
  const meta = map[state as keyof typeof map];
  if (!meta) return null;
  return <span className={["text-xs", meta.cls].join(" ")}>{meta.txt}</span>;
}

function PointsBadge({
  pred,
  real,
}: {
  pred: { home: number; away: number };
  real: { home: number; away: number };
}) {
  const exact = pred.home === real.home && pred.away === real.away;
  const result = Math.sign(pred.home - pred.away) === Math.sign(real.home - real.away);
  const pts = exact ? 3 : result ? 1 : 0;
  // Verde para 3 pts (exacto), azul para 1 pt (resultado), gris para 0 (falla).
  const cls = exact
    ? "bg-[var(--color-primary)] text-white"
    : result
      ? "bg-[var(--color-info)] text-white"
      : "bg-[var(--color-stone-200)] text-[var(--color-stone-700)]";
  return (
    <span className={["inline-block rounded-full px-2 py-0.5 text-[10px] font-bold", cls].join(" ")}>
      +{pts} pt{pts === 1 ? "" : "s"}
    </span>
  );
}

// ============================================================================
// Helpers de fecha
// ============================================================================
function isoDayInGT(iso: string): string {
  const d = new Date(iso);
  const gt = new Date(d.getTime() - 6 * 60 * 60 * 1000);
  return gt.toISOString().slice(0, 10);
}

function shortLabel(iso: string): string {
  const d = formatGT(iso, { weekday: "short", day: "2-digit", month: "2-digit" });
  return d.replace(/\.$/, "").replace(/,$/, "");
}

function longLabel(iso: string): string {
  return formatGT(iso, { weekday: "long", day: "2-digit", month: "long" });
}

// ============================================================================
// Save debounced
// ============================================================================
const TIMERS = new Map<number, ReturnType<typeof setTimeout>>();
const DEBOUNCE_MS = 600;

function saveDebounced(
  matchId: number,
  home: number,
  away: number,
  setState: (s: SaveState) => void,
  onOk: () => void,
) {
  const existing = TIMERS.get(matchId);
  if (existing) clearTimeout(existing);
  setState("saving");
  TIMERS.set(
    matchId,
    setTimeout(async () => {
      try {
        const res = await fetch("/api/predictions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ matchId, homeScore: home, awayScore: away }),
        });
        if (res.ok) {
          onOk();
          setState("saved");
          setTimeout(() => setState("idle"), 1200);
        } else if (res.status === 423) {
          setState("locked");
        } else if (res.status === 403) {
          // Lo más común: payment-required. Si fuera otra cosa, igual mejor mensaje que "Error".
          setState("payment");
        } else {
          setState("error");
        }
      } catch {
        setState("error");
      } finally {
        TIMERS.delete(matchId);
      }
    }, DEBOUNCE_MS),
  );
}
