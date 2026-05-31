import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/brand/BrandMark";
import { Header } from "@/components/layout/Header";
import { getSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Alert } from "@/components/ui/Alert";
import { StatCard, type StatTone } from "@/components/ui/StatCard";
import { formatGT, daysUntil } from "@/lib/date";
import { getBranding } from "@/lib/branding";
import { getAppTexts } from "@/lib/app-texts";
import { getNearbyMatches, getMyStandings } from "@/lib/dashboard";
import { MatchesStrip } from "@/components/dashboard/MatchesStrip";

type Tone = StatTone;

export default async function HomePage() {
  const session = await getSession();
  if (!session) return <Landing />;
  // Defensa en profundidad: el proxy ya redirige, pero si por algún motivo llega aquí,
  // forzamos el cambio de contraseña antes de mostrar nada.
  if (session.profile.must_change_password) redirect("/cambio-password");
  if (!session.profile.is_active) redirect("/login?inactive=1");
  return <Dashboard session={session} />;
}

async function Landing() {
  const branding = await getBranding();
  return (
    <main className="min-h-screen bg-[var(--color-bg)]">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="h-1 bg-tricolor-soft" aria-hidden />
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <BrandMark branding={branding} />
          <Link
            href="/login"
            className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[var(--color-primary-700)] active:scale-[0.97] active:bg-[var(--color-primary-800)] active:shadow-inner"
          >
            Entrar
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-4 py-12 text-center">
        <p className="font-display text-sm uppercase tracking-widest text-[var(--color-info)]">
          {branding.companyName}
        </p>
        <h1 className="mt-2 font-display text-4xl leading-tight text-[var(--color-text)] md:text-6xl">
          Quiniela Mundial <span className="text-[var(--color-danger)]">2026</span>
        </h1>
        <p className="mt-4 text-base text-[var(--color-text-soft)] md:text-lg">
          Hacé tus pronósticos, mirá el ranking en vivo y revisá los resultados oficiales.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/login"
            className="inline-flex h-12 items-center justify-center rounded-md bg-[var(--color-primary)] px-6 font-semibold text-white shadow transition-all hover:bg-[var(--color-primary-700)] active:scale-[0.97] active:bg-[var(--color-primary-800)] active:shadow-inner"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/reglas"
            className="inline-flex h-12 items-center justify-center rounded-md border border-[var(--color-info)] bg-white px-6 font-semibold text-[var(--color-info)] transition-all hover:bg-[var(--color-info-50)] active:scale-[0.97] active:bg-[var(--color-info-100)] active:shadow-inner"
          >
            Ver reglas
          </Link>
        </div>
      </section>

      <footer className="mt-auto border-t border-[var(--color-border)] py-6 text-center text-xs text-[var(--color-muted)]">
        v0.1 · {branding.companyName} · Quetzales (Q) · Hora Guatemala (UTC-6)
      </footer>
    </main>
  );
}

async function Dashboard({ session }: { session: NonNullable<Awaited<ReturnType<typeof getSession>>> }) {
  const supabase = await createSupabaseServerClient();
  const branding = await getBranding();
  const { quickRules } = await getAppTexts();

  const { data: round } = await supabase
    .from("rounds")
    .select("*")
    .eq("code", "GROUPS")
    .maybeSingle();

  const [predCountRes, matchesCountRes, standings, nearbyMatches] = await Promise.all([
    supabase
      .from("predictions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", session.userId),
    round
      ? supabase.from("matches").select("id", { count: "exact", head: true }).eq("round_id", round.id)
      : Promise.resolve({ count: 0 }),
    getMyStandings(session.userId),
    getNearbyMatches(session.userId),
  ]);

  const total = matchesCountRes.count ?? 0;
  const done = predCountRes.count ?? 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const closesAt = round?.closes_at ? new Date(round.closes_at) : null;
  const isLocked = round?.is_locked ?? false;
  const days = closesAt ? daysUntil(closesAt) : null;

  const payStatus = session.profile.payment_status;
  const payTone: Tone =
    payStatus === "confirmed" ? "green"
    : payStatus === "rejected" ? "red"
    : payStatus === "submitted" ? "gold"
    : "neutral";

  return (
    <>
      <Header profile={session.profile} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <div className="mb-6 flex flex-col gap-1">
          <p className="font-display text-sm uppercase tracking-widest text-[var(--color-info)]">
            {branding.companyName} · Hola, {session.profile.display_name}
          </p>
          <h1 className="font-display text-3xl text-[var(--color-text)] md:text-4xl">
            Tu panel
          </h1>
        </div>

        {isLocked && (
          <div className="mb-4">
            <Alert tone="info" title="Ronda cerrada">
              La fase de grupos ya fue sellada. Los pronósticos no se pueden modificar.
            </Alert>
          </div>
        )}

        <PointsHero
          roundName={round?.name ?? "Fase de Grupos"}
          points={standings.points}
          exact={standings.exactCount}
          result={standings.resultCount}
          rank={standings.rank}
          totalPlayers={standings.totalPlayers}
        />

        <MatchesStrip matches={nearbyMatches} />

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <StatCard
            tone="green"
            title="Mis pronósticos"
            big={`${done} / ${total}`}
            sub={`${pct}% completados`}
            cta={{ href: "/pronosticos", label: isLocked ? "Ver mis pronósticos" : "Continuar" }}
          />
          <StatCard
            tone="blue"
            title="Cierre de la ronda"
            big={closesAt ? formatGT(closesAt, { dateStyle: "long" }) : "—"}
            sub={
              closesAt
                ? days !== null && days > 0
                  ? `En ${days} día${days === 1 ? "" : "s"} · ${formatGT(closesAt, { timeStyle: "short" })} GT`
                  : isLocked
                    ? "Ronda cerrada"
                    : `Hoy · ${formatGT(closesAt, { timeStyle: "short" })} GT`
                : "—"
            }
          />
          <StatCard
            tone={payTone}
            title="Pago"
            big={paymentLabel(payStatus)}
            sub="Q100 por participante"
            cta={
              payStatus === "confirmed"
                ? undefined
                : { href: "/pago", label: "Registrar pago" }
            }
          />
        </div>

        <div className="mt-6">
          <Link
            href="/grupos"
            className="group flex items-center justify-between gap-4 rounded-xl border border-[var(--color-border)] bg-white px-5 py-4 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-muted)]">
                Tabla de grupos
              </p>
              <p className="mt-1 font-display text-lg text-[var(--color-text)]">
                Posiciones del Mundial
              </p>
              <p className="text-sm text-[var(--color-text-soft)]">
                Mirá cómo va cada grupo con los resultados oficiales.
              </p>
            </div>
            <span
              aria-hidden
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-pitch-50)] text-[var(--color-pitch-700)] transition-transform group-hover:translate-x-0.5"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="m13 6 6 6-6 6" />
              </svg>
            </span>
          </Link>
        </div>

        <div className="mt-6 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
          <div className="h-1 bg-tricolor" aria-hidden />
          <div className="p-5">
            <h2 className="font-display text-xl text-[var(--color-text)]">Reglas rápidas</h2>
            <ul className="mt-2 list-disc pl-5 text-sm text-[var(--color-text-soft)]">
              {quickRules.map((rule, i) => (
                <li key={i}>{rule}</li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-[var(--color-muted)]">
              Reglas completas en <Link href="/reglas" className="font-medium text-[var(--color-info)] underline">/reglas</Link>.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}

function paymentLabel(s: string) {
  switch (s) {
    case "confirmed": return "Confirmado";
    case "submitted": return "Revisión";
    case "rejected":  return "Rechazado";
    case "refunded":  return "Reembolsado";
    default:          return "Pendiente";
  }
}

function PointsHero({
  roundName,
  points,
  exact,
  result,
  rank,
  totalPlayers,
}: {
  roundName: string;
  points: number;
  exact: number;
  result: number;
  rank: number | null;
  totalPlayers: number;
}) {
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
  const showLeaderboardLine = rank !== null && totalPlayers > 0;
  return (
    <section
      aria-label="Mis puntos"
      className="relative mb-5 overflow-hidden rounded-2xl border border-[var(--color-pitch-700)]/30 bg-gradient-to-br from-[var(--color-pitch-700)] via-[var(--color-pitch-800)] to-[var(--color-azure-700)] p-5 text-white shadow-md"
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-tricolor" aria-hidden />
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/5 blur-2xl" aria-hidden />
      <div className="absolute -bottom-12 -left-6 h-32 w-32 rounded-full bg-[var(--color-gold-400)]/20 blur-2xl" aria-hidden />

      <div className="relative flex flex-col items-center gap-4 text-center">
        <p className="font-display text-[11px] uppercase tracking-[0.2em] text-white/70">
          Tus puntos · {roundName}
        </p>
        <div className="flex items-baseline justify-center gap-3">
          <span className="font-display text-5xl leading-none tracking-tight md:text-6xl">
            {points}
          </span>
          <span className="font-display text-base uppercase tracking-widest text-white/70">
            pts
          </span>
        </div>
        <p className="text-sm text-white/80">
          <strong className="text-white">{exact}</strong> exacto{exact === 1 ? "" : "s"}
          {" · "}
          <strong className="text-white">{result}</strong> resultado{result === 1 ? "" : "s"}
          {showLeaderboardLine && (
            <>
              {" · "}puesto{" "}
              <strong className="text-white">
                {medal ? `${medal} ` : ""}
                {rank}/{totalPlayers}
              </strong>
            </>
          )}
        </p>

        <Link
          href="/ranking"
          className="mt-1 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[var(--color-pitch-800)] shadow transition-all duration-150 ease-out hover:bg-[var(--color-stone-100)] hover:shadow-md active:scale-[0.97] active:shadow-inner"
        >
          Ver ranking
          <span aria-hidden>→</span>
        </Link>
      </div>
    </section>
  );
}

