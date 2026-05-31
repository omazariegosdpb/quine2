import { createSupabaseServerClient } from "@/lib/supabase/server";
import { RoundEditor } from "@/app/admin/rondas/RoundEditor";
import { CreateRoundForm } from "@/app/admin/rondas/CreateRoundForm";

export const metadata = { title: "Rondas · Admin" };

export default async function AdminRoundsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: rounds } = await supabase
    .from("rounds")
    .select("*")
    .order("closes_at", { ascending: true });

  // Sugerencia de cierre por defecto para "Nueva ronda": 7 días adelante
  const suggestion = new Date(Date.now() + 7 * 86400 * 1000);
  const defaultCloseLocal = toGTLocalInput(suggestion.toISOString());

  return (
    <div className="flex flex-col gap-5">
      <CreateRoundForm defaultCloseLocal={defaultCloseLocal} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {(rounds ?? []).map((r) => (
          <RoundEditor
            key={r.id}
            round={r}
            closesAtLocal={isoToGTLocalInput(r.closes_at)}
          />
        ))}
      </div>
    </div>
  );
}

function isoToGTLocalInput(iso: string): string {
  return toGTLocalInput(iso);
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
