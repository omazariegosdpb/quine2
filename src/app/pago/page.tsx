import { Header } from "@/components/layout/Header";
import { Alert } from "@/components/ui/Alert";
import { requireSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatGT } from "@/lib/date";
import { getAppTexts } from "@/lib/app-texts";
import { UploadReceipt } from "@/app/pago/UploadReceipt";

export const metadata = { title: "Pago · Quiniela Mundial 2026" };

export default async function PagoPage() {
  const session = await requireSession();
  const supabase = await createSupabaseServerClient();

  const [{ data: lastPayment }, { paymentSteps }] = await Promise.all([
    supabase
      .from("payments")
      .select("id, amount_quetzales, status, created_at, confirmed_at, notes")
      .eq("user_id", session.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    getAppTexts(),
  ]);

  const status = lastPayment?.status ?? session.profile.payment_status ?? "pending";
  const isConfirmed = status === "confirmed";
  const isRejected = status === "rejected";

  return (
    <>
      <Header profile={session.profile} />
      <main className="mx-auto w-full max-w-xl flex-1 px-3 py-6 sm:px-4">
        <p className="font-display text-xs uppercase tracking-widest text-[var(--color-pitch-700)]">
          Pago de inscripción
        </p>
        <h1 className="font-display text-3xl text-[var(--color-text)] md:text-4xl">Mi pago</h1>

        <section className="mt-5 rounded-xl border border-[var(--color-border)] bg-white p-5 shadow-sm">
          <h2 className="font-display text-lg text-[var(--color-text)]">Cómo pagar</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-[var(--color-text-soft)]">
            {paymentSteps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </section>

        <section className="mt-5 rounded-xl border border-[var(--color-border)] bg-white p-5 shadow-sm">
          <header className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg text-[var(--color-text)]">Estado actual</h2>
            <StatusPill status={status} />
          </header>

          {lastPayment && (
            <p className="text-xs text-[var(--color-text-soft)]">
              Última actualización: {formatGT(lastPayment.confirmed_at ?? lastPayment.created_at, { dateStyle: "medium", timeStyle: "short" })}
              {lastPayment.notes ? <> · <em>{lastPayment.notes}</em></> : null}
            </p>
          )}

          {isConfirmed && (
            <div className="mt-3">
              <Alert tone="success" title="Pago confirmado">
                Tu inscripción está válida. ¡Suerte!
              </Alert>
            </div>
          )}
          {isRejected && (
            <div className="mt-3">
              <Alert tone="warning" title="Pago rechazado">
                El organizador rechazó tu comprobante. Volvé a subirlo o pedile detalles por WhatsApp.
              </Alert>
            </div>
          )}
        </section>

        <section className="mt-5 rounded-xl border border-[var(--color-border)] bg-white p-5 shadow-sm">
          <h2 className="font-display text-lg text-[var(--color-text)]">
            {isConfirmed ? "Reemplazar comprobante" : "Subir comprobante"}
          </h2>
          <p className="mt-1 text-sm text-[var(--color-text-soft)]">
            El archivo es privado. Solo el organizador puede verlo.
          </p>
          <div className="mt-4">
            <UploadReceipt disabled={isConfirmed} />
          </div>
        </section>
      </main>
    </>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending:   { label: "Pendiente",  cls: "bg-gray-100 text-gray-700" },
    submitted: { label: "En revisión", cls: "bg-amber-100 text-amber-800" },
    confirmed: { label: "Confirmado", cls: "bg-emerald-100 text-emerald-800" },
    rejected:  { label: "Rechazado",  cls: "bg-red-100 text-red-700" },
    refunded:  { label: "Reembolsado",cls: "bg-blue-100 text-blue-800" },
  };
  const m = map[status] ?? map.pending;
  return (
    <span className={["inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", m.cls].join(" ")}>
      {m.label}
    </span>
  );
}
