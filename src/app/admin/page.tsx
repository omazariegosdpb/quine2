import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatGT } from "@/lib/date";
import { StatCard } from "@/components/ui/StatCard";

export default async function AdminHomePage() {
  const supabase = await createSupabaseServerClient();

  const [
    { count: usersCount },
    { count: paidCount },
    { count: pendingPayCount },
    { data: round },
    { count: matchesPlayed },
    { count: matchesTotal },
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "player").eq("is_active", true),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "player").eq("payment_status", "confirmed"),
    supabase.from("payments").select("id", { count: "exact", head: true }).eq("status", "submitted"),
    supabase.from("rounds").select("*").eq("code", "GROUPS").maybeSingle(),
    supabase.from("matches").select("id", { count: "exact", head: true }).eq("status", "finished"),
    supabase.from("matches").select("id", { count: "exact", head: true }),
  ]);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        tone="green"
        title="Jugadores activos"
        big={`${usersCount ?? 0}`}
        sub={`${paidCount ?? 0} pagos confirmados`}
        cta={{ href: "/admin/usuarios", label: "Gestionar" }}
      />
      <StatCard
        tone={pendingPayCount && pendingPayCount > 0 ? "red" : "neutral"}
        title="Pagos pendientes"
        big={`${pendingPayCount ?? 0}`}
        sub="Comprobantes por revisar"
        cta={{ href: "/admin/pagos", label: "Revisar" }}
      />
      <StatCard
        tone="blue"
        title="Ronda Fase de Grupos"
        big={round?.is_locked ? "Sellada" : "Abierta"}
        sub={
          round?.closes_at
            ? `Cierre: ${formatGT(round.closes_at, { dateStyle: "medium", timeStyle: "short" })} GT`
            : "Sin configurar"
        }
        cta={{ href: "/admin/rondas", label: "Configurar" }}
      />
      <StatCard
        tone="gold"
        title="Partidos jugados"
        big={`${matchesPlayed ?? 0} / ${matchesTotal ?? 0}`}
        sub="Resultados oficiales capturados"
        cta={{ href: "/admin/resultados", label: "Capturar" }}
      />
    </div>
  );
}
