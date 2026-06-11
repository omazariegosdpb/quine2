import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CreateUserForm } from "@/app/admin/usuarios/CreateUserForm";
import { UserActionsForm } from "@/app/admin/usuarios/UserActionsForm";
import { ExportRoundForm } from "@/app/admin/usuarios/ExportRoundForm";
import { Alert } from "@/components/ui/Alert";
import { formatGT } from "@/lib/date";

export const metadata = { title: "Usuarios · Admin" };

export default async function AdminUsersPage() {
  const supabase = await createSupabaseServerClient();
  const [{ data: users }, { data: rounds }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at", { ascending: false }),
    supabase.from("rounds").select("code, name").order("closes_at", { ascending: true }),
  ]);

  const hasServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_2fr]">
      <section className="rounded-xl border border-[var(--color-border)] bg-white p-5 shadow-sm">
        <h2 className="font-display text-xl text-[var(--color-text)]">Nuevo jugador</h2>
        <p className="mt-1 text-sm text-[var(--color-text-soft)]">
          Se crea con contraseña temporal y se le obligará a cambiarla en el primer login.
        </p>
        {!hasServiceRole && (
          <div className="mt-3">
            <Alert tone="warning">
              Falta <code>SUPABASE_SERVICE_ROLE_KEY</code> en <code>.env.local</code>.
              Sin esa clave no puedo crear usuarios.
            </Alert>
          </div>
        )}
        <div className="mt-4">
          <CreateUserForm />
        </div>
      </section>

      <section className="rounded-xl border border-[var(--color-border)] bg-white shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] px-5 py-3">
          <div>
            <h2 className="font-display text-xl text-[var(--color-text)]">Jugadores</h2>
            <span className="text-sm text-[var(--color-text-soft)]">{users?.length ?? 0} registros</span>
          </div>
          <ExportRoundForm rounds={rounds ?? []} />
        </header>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--color-bg)] text-left text-xs uppercase tracking-wider text-[var(--color-text-soft)]">
              <tr>
                <th className="px-4 py-2">Apodo</th>
                <th className="px-4 py-2">Nombre completo</th>
                <th className="px-4 py-2">Rol</th>
                <th className="px-4 py-2">Pago</th>
                <th className="px-4 py-2">Estado</th>
                <th className="px-4 py-2">Alta</th>
                <th className="px-4 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {(users ?? []).map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-2 font-semibold">{u.display_name}</td>
                  <td className="px-4 py-2 text-[var(--color-text-soft)]">{u.full_name}</td>
                  <td className="px-4 py-2">
                    <Pill tone={u.role === "admin" ? "gold" : "muted"}>{u.role}</Pill>
                  </td>
                  <td className="px-4 py-2">
                    <Pill tone={paymentTone(u.payment_status)}>{u.payment_status}</Pill>
                  </td>
                  <td className="px-4 py-2">
                    <Pill tone={u.is_active ? "green" : "muted"}>{u.is_active ? "activo" : "retirado"}</Pill>
                  </td>
                  <td className="px-4 py-2 text-xs text-[var(--color-muted)]">
                    {formatGT(u.created_at, { dateStyle: "medium" })}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={`/api/admin/usuarios/export?user=${u.id}`}
                        className="rounded-md border border-[var(--color-border)] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--color-text-soft)] hover:bg-[var(--color-bg)]"
                        title="Descargar pronósticos y puntos del jugador (.xlsx)"
                      >
                        Descargar
                      </a>
                      <UserActionsForm userId={u.id} isActive={u.is_active} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function paymentTone(status: string): "muted" | "green" | "gold" | "red" {
  if (status === "confirmed") return "green";
  if (status === "submitted") return "gold";
  if (status === "rejected") return "red";
  return "muted";
}

function Pill({
  tone, children,
}: {
  tone: "muted" | "green" | "gold" | "red";
  children: React.ReactNode;
}) {
  const cls = {
    muted: "bg-gray-100 text-gray-700",
    green: "bg-emerald-100 text-emerald-800",
    gold:  "bg-amber-100 text-amber-800",
    red:   "bg-red-100 text-red-700",
  }[tone];
  return (
    <span className={["inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold", cls].join(" ")}>
      {children}
    </span>
  );
}
