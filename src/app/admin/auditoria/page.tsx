import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatGT } from "@/lib/date";

export const metadata = { title: "Auditoría · Admin" };

export default async function AdminAuditPage() {
  const supabase = await createSupabaseServerClient();
  const { data: logs } = await supabase
    .from("audit_log")
    .select("id, actor_id, action, entity, entity_id, before_val, after_val, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const actorIds = Array.from(
    new Set((logs ?? []).map((r) => r.actor_id).filter((id): id is string => !!id)),
  );
  const { data: users } = actorIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", actorIds)
    : { data: [] as { id: string; display_name: string }[] };
  const nameById = new Map((users ?? []).map((u) => [u.id, u.display_name]));

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-white shadow-sm">
      <header className="border-b border-[var(--color-border)] px-5 py-3">
        <h2 className="font-display text-xl text-[var(--color-text)]">Auditoría</h2>
        <p className="text-sm text-[var(--color-text-soft)]">
          Últimas 200 acciones sensibles registradas (cualquier cambio admin queda aquí).
        </p>
      </header>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-[var(--color-bg)] text-left text-xs uppercase tracking-wider text-[var(--color-text-soft)]">
            <tr>
              <th className="px-3 py-2">Cuándo</th>
              <th className="px-3 py-2">Quién</th>
              <th className="px-3 py-2">Acción</th>
              <th className="px-3 py-2">Entidad</th>
              <th className="px-3 py-2">Antes → Después</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {(logs ?? []).map((row) => (
              <tr key={row.id}>
                <td className="px-3 py-2 text-xs text-[var(--color-muted)] whitespace-nowrap">
                  {formatGT(row.created_at, { dateStyle: "short", timeStyle: "medium" })}
                </td>
                <td className="px-3 py-2 text-xs">{row.actor_id ? nameById.get(row.actor_id) ?? "—" : "sistema"}</td>
                <td className="px-3 py-2 text-xs font-semibold">{row.action}</td>
                <td className="px-3 py-2 text-xs text-[var(--color-muted)]">
                  {row.entity}
                  {row.entity_id ? `#${row.entity_id}` : ""}
                </td>
                <td className="px-3 py-2 text-xs">
                  <code className="break-all text-[10px] text-[var(--color-muted)]">
                    {JSON.stringify(row.before_val ?? null)} → {JSON.stringify(row.after_val ?? null)}
                  </code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!logs || logs.length === 0) && (
          <p className="px-5 py-6 text-sm text-[var(--color-text-soft)]">Sin registros todavía.</p>
        )}
      </div>
    </div>
  );
}
