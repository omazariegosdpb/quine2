import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { PaymentRow } from "@/app/admin/pagos/PaymentRow";
import { ManualConfirm } from "@/app/admin/pagos/ManualConfirm";
import { formatGT } from "@/lib/date";
import { Alert } from "@/components/ui/Alert";

export const metadata = { title: "Pagos · Admin" };

export default async function AdminPaymentsPage() {
  const supabase = await createSupabaseServerClient();

  const { data: payments } = await supabase
    .from("payments")
    .select("id, user_id, amount_quetzales, status, receipt_path, created_at, notes")
    .order("created_at", { ascending: false });

  const userIds = Array.from(new Set((payments ?? []).map((p) => p.user_id)));
  const { data: users } = userIds.length
    ? await supabase.from("profiles").select("id, display_name, full_name").in("id", userIds)
    : { data: [] as { id: string; display_name: string; full_name: string }[] };
  const usersById = new Map((users ?? []).map((u) => [u.id, u]));

  let admin: ReturnType<typeof createSupabaseAdminClient> | null = null;
  let hasAdmin = false;
  try {
    admin = createSupabaseAdminClient();
    hasAdmin = true;
  } catch {
    // sin service_role no podemos firmar URLs ni traer emails
  }

  // Jugadores activos aún sin pago confirmado: candidatos a confirmación manual
  // (efectivo / sin comprobante). Incluye también a quienes nunca registraron un pago.
  const { data: pendingPlayers } = await supabase
    .from("profiles")
    .select("id, display_name, full_name, payment_status")
    .eq("role", "player")
    .eq("is_active", true)
    .neq("payment_status", "confirmed")
    .order("display_name", { ascending: true });

  const emailLookupIds = Array.from(
    new Set([...userIds, ...(pendingPlayers ?? []).map((p) => p.id)]),
  );
  const emails = new Map<string, string>();
  if (hasAdmin && admin && emailLookupIds.length) {
    for (const id of emailLookupIds) {
      const { data } = await admin.auth.admin.getUserById(id);
      if (data?.user?.email) emails.set(id, data.user.email);
    }
  }

  const manualPlayers = (pendingPlayers ?? []).map((p) => ({
    id: p.id,
    name: p.display_name ?? p.full_name ?? "—",
    email: emails.get(p.id) ?? "—",
    status: p.payment_status ?? "pending",
  }));

  const rows = await Promise.all(
    (payments ?? []).map(async (p) => {
      let receiptUrl: string | null = null;
      if (p.receipt_path && hasAdmin && admin) {
        const { data } = await admin.storage
          .from("payment-receipts")
          .createSignedUrl(p.receipt_path, 60);
        receiptUrl = data?.signedUrl ?? null;
      }
      return {
        id: p.id,
        userName: usersById.get(p.user_id)?.display_name ?? "—",
        userEmail: emails.get(p.user_id) ?? "—",
        amount: Number(p.amount_quetzales),
        status: p.status,
        receiptUrl,
        createdAt: p.created_at,
      };
    }),
  );

  const pending = rows.filter((r) => r.status === "submitted");
  const others = rows.filter((r) => r.status !== "submitted");

  return (
    <div className="flex flex-col gap-6">
      {!hasAdmin && (
        <Alert tone="warning">
          Falta <code>SUPABASE_SERVICE_ROLE_KEY</code>. No puedo mostrar comprobantes firmados ni emails.
        </Alert>
      )}

      <section className="rounded-xl border border-[var(--color-border)] bg-white shadow-sm">
        <header className="border-b border-[var(--color-border)] px-5 py-3">
          <h2 className="font-display text-xl text-[var(--color-text)]">Por revisar</h2>
          <p className="text-sm text-[var(--color-text-soft)]">{pending.length} pendientes</p>
        </header>
        <Table rows={pending} empty="Sin pagos por revisar." />
      </section>

      <section className="rounded-xl border border-[var(--color-border)] bg-white shadow-sm">
        <header className="border-b border-[var(--color-border)] px-5 py-3">
          <h2 className="font-display text-xl text-[var(--color-text)]">Confirmar sin comprobante</h2>
          <p className="text-sm text-[var(--color-text-soft)]">
            Marca a un jugador como pagado aunque no haya subido comprobante (efectivo, pago externo).
          </p>
        </header>
        <ManualConfirm players={manualPlayers} />
      </section>

      <section className="rounded-xl border border-[var(--color-border)] bg-white shadow-sm">
        <header className="border-b border-[var(--color-border)] px-5 py-3">
          <h2 className="font-display text-xl text-[var(--color-text)]">Historial</h2>
          <p className="text-sm text-[var(--color-text-soft)]">{others.length} registros</p>
        </header>
        <Table rows={others} empty="Sin historial." />
      </section>

      <p className="text-xs text-[var(--color-muted)]">
        Última actualización: {formatGT(new Date(), { dateStyle: "medium", timeStyle: "short" })} GT
      </p>
    </div>
  );
}

function Table({ rows, empty }: { rows: React.ComponentProps<typeof PaymentRow>["payment"][]; empty: string }) {
  if (rows.length === 0) {
    return <div className="px-5 py-6 text-sm text-[var(--color-text-soft)]">{empty}</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-[var(--color-bg)] text-left text-xs uppercase tracking-wider text-[var(--color-text-soft)]">
          <tr>
            <th className="px-3 py-2">Jugador</th>
            <th className="px-3 py-2">Monto</th>
            <th className="px-3 py-2">Comprobante</th>
            <th className="px-3 py-2">Estado</th>
            <th className="px-3 py-2">Decisión</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {rows.map((r) => (
            <PaymentRow key={r.id} payment={r} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
