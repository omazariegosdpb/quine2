import { Header } from "@/components/layout/Header";
import { Flag } from "@/components/flags/Flag";
import { requireSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Grupos · Quiniela Mundial 2026" };

type Row = {
  team_id: number;
  team_name: string;
  iso_code: string | null;
  group_letter: string;
  pj: number;
  g: number;
  e: number;
  p: number;
  gf: number;
  gc: number;
  dg: number;
  pts: number;
};

export default async function GroupsPage() {
  const session = await requireSession();
  const supabase = await createSupabaseServerClient();

  const { data: rows, error: viewError } = await supabase
    .from("group_standings_view")
    .select("*")
    .order("group_letter", { ascending: true })
    .order("pts", { ascending: false })
    .order("dg", { ascending: false })
    .order("gf", { ascending: false })
    .order("team_name", { ascending: true });

  const all = (rows ?? []) as Row[];
  const groups = new Map<string, Row[]>();
  for (const r of all) {
    const list = groups.get(r.group_letter) ?? [];
    list.push(r);
    groups.set(r.group_letter, list);
  }

  const { count: finishedAll } = await supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("status", "finished")
    .not("group_letter", "is", null);
  const { count: totalAll } = await supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .not("group_letter", "is", null);

  return (
    <>
      <Header profile={session.profile} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-3 py-6 sm:px-4">
        <div className="mb-5 flex flex-col gap-1">
          <p className="font-display text-xs uppercase tracking-widest text-[var(--color-pitch-700)]">
            Fase de Grupos
          </p>
          <h1 className="font-display text-3xl text-[var(--color-text)] md:text-4xl">
            Grupos del Mundial
          </h1>
          <p className="text-sm text-[var(--color-text-soft)]">
            Tabla actualizada con los resultados oficiales que carga el administrador.
            Partidos jugados:{" "}
            <strong className="text-[var(--color-text)]">{finishedAll ?? 0}</strong>{" "}
            / {totalAll ?? 0}
          </p>
        </div>

        {viewError ? (
          <div className="rounded-xl border border-dashed border-[var(--color-danger)] bg-white px-4 py-10 text-center text-sm text-[var(--color-danger)]">
            La vista <code>group_standings_view</code> no está disponible.
            Aplicá la migración <code>20260514000000_group_standings_view.sql</code> en Supabase.
          </div>
        ) : groups.size === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-white px-4 py-10 text-center text-sm text-[var(--color-text-soft)]">
            Todavía no hay equipos cargados.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from(groups.entries()).map(([letter, list]) => (
              <GroupCard key={letter} letter={letter} rows={list} />
            ))}
          </div>
        )}

        <p className="mt-6 text-center text-xs text-[var(--color-muted)]">
          Los dos primeros de cada grupo clasifican. Empates se resuelven por
          diferencia de gol y luego goles a favor.
        </p>
      </main>
    </>
  );
}

function GroupCard({ letter, rows }: { letter: string; rows: Row[] }) {
  const totalMatches = 6;
  const playedSum = rows.reduce((acc, r) => acc + r.pj, 0);
  const matchesPlayed = Math.round(playedSum / 2);

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-white shadow-sm">
      <header className="flex items-center justify-between bg-[var(--color-pitch-700)] px-4 py-2.5 text-white">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 font-display text-base">
            {letter}
          </span>
          <span className="font-display text-lg tracking-wide">Grupo {letter}</span>
        </div>
        <span className="text-xs text-white/80">
          {matchesPlayed} / {totalMatches} jugados
        </span>
      </header>

      <ol className="divide-y divide-[var(--color-border)]">
        {rows.map((r, idx) => (
          <TeamRow key={r.team_id} row={r} pos={idx + 1} />
        ))}
      </ol>
    </section>
  );
}

function TeamRow({ row, pos }: { row: Row; pos: number }) {
  const qualifies = pos <= 2;
  const posBg = qualifies
    ? "bg-[var(--color-pitch-50)] text-[var(--color-pitch-800)]"
    : "bg-[var(--color-bg)] text-[var(--color-text-soft)]";

  const dgLabel = row.dg > 0 ? `+${row.dg}` : `${row.dg}`;
  const dgClass =
    row.dg > 0
      ? "text-[var(--color-pitch-700)]"
      : row.dg < 0
        ? "text-[var(--color-danger)]"
        : "text-[var(--color-text-soft)]";

  return (
    <li
      className={[
        "flex items-center gap-3 px-3 py-2.5 sm:px-4",
        qualifies ? "bg-[var(--color-pitch-50)]/40" : "",
      ].join(" ")}
    >
      <span
        className={[
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-display text-sm",
          posBg,
        ].join(" ")}
        aria-label={`Posición ${pos}`}
      >
        {pos}
      </span>

      <Flag
        fifa={row.iso_code}
        size={28}
        alt={row.team_name}
        className="hidden sm:inline-flex"
      />
      <Flag
        fifa={row.iso_code}
        size={24}
        alt=""
        className="sm:hidden"
      />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[var(--color-text)]">
          {row.team_name}
        </p>
        <p className="text-[11px] text-[var(--color-text-soft)]">
          PJ {row.pj} · G {row.g} E {row.e} P {row.p} · {row.gf}:{row.gc}{" "}
          <span className={dgClass}>({dgLabel})</span>
        </p>
      </div>

      <div className="flex flex-col items-end">
        <span className="font-display text-xl leading-none text-[var(--color-pitch-700)]">
          {row.pts}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
          pts
        </span>
      </div>
    </li>
  );
}
