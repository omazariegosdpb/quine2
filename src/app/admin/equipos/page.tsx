import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CreateTeamForm, EditableTeamRow } from "@/app/admin/equipos/TeamForms";

export const metadata = { title: "Equipos · Admin" };

export default async function AdminTeamsPage() {
  const supabase = await createSupabaseServerClient();

  const { data: teams } = await supabase
    .from("teams")
    .select("id, name, iso_code, group_letter")
    .order("group_letter", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });

  return (
    <div className="flex flex-col gap-5">
      <CreateTeamForm />

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        <header className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3">
          <div>
            <h2 className="font-display text-xl text-[var(--color-text)]">Equipos</h2>
            <p className="text-sm text-[var(--color-text-soft)]">
              El <strong>código FIFA</strong> define la bandera que se renderiza (vía flagcdn). Cambiá el nombre sin tocar el código si solo querés renombrar.
            </p>
          </div>
          <span className="text-sm text-[var(--color-text-soft)]">{teams?.length ?? 0} equipos</span>
        </header>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--color-bg)] text-left text-xs uppercase tracking-wider text-[var(--color-text-soft)]">
              <tr>
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">Equipo</th>
                <th className="px-3 py-2">Cód. FIFA</th>
                <th className="px-3 py-2">Grupo</th>
                <th className="px-3 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {(teams ?? []).map((t) => (
                <EditableTeamRow key={t.id} team={t} />
              ))}
            </tbody>
          </table>
          {(!teams || teams.length === 0) && (
            <p className="px-5 py-6 text-sm text-[var(--color-text-soft)]">Sin equipos todavía.</p>
          )}
        </div>
      </div>
    </div>
  );
}
