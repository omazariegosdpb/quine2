"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";

const Schema = z.object({
  paymentId: z.string().uuid(),
  decision: z.enum(["confirm", "reject", "refund"]),
  notes: z.string().max(500).optional(),
});

export type State = { ok: boolean; message?: string };

export async function reviewPayment(_prev: State, formData: FormData): Promise<State> {
  const me = await requireAdmin();
  const parsed = Schema.safeParse({
    paymentId: formData.get("paymentId"),
    decision: formData.get("decision"),
    notes: formData.get("notes") ?? undefined,
  });
  if (!parsed.success) return { ok: false, message: "Datos inválidos" };

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return { ok: false, message: "Falta SUPABASE_SERVICE_ROLE_KEY" };
  }

  const { data: before } = await admin.from("payments").select("*").eq("id", parsed.data.paymentId).single();
  if (!before) return { ok: false, message: "Pago no encontrado" };

  const status: "confirmed" | "rejected" | "refunded" =
    parsed.data.decision === "confirm"
      ? "confirmed"
      : parsed.data.decision === "reject"
        ? "rejected"
        : "refunded";

  const { error } = await admin
    .from("payments")
    .update({
      status,
      confirmed_by: me.userId,
      confirmed_at: new Date().toISOString(),
      notes: parsed.data.notes ?? null,
    })
    .eq("id", parsed.data.paymentId);

  if (error) return { ok: false, message: error.message };

  // Reflejar el status del profile para vistas rápidas.
  await admin
    .from("profiles")
    .update({ payment_status: status })
    .eq("id", before.user_id);

  await admin.from("audit_log").insert({
    actor_id: me.userId,
    action: `payment_${parsed.data.decision}`,
    entity: "payments",
    entity_id: parsed.data.paymentId,
    before_val: { status: before.status },
    after_val: { status, notes: parsed.data.notes ?? null },
  } as never);

  revalidatePath("/admin/pagos");
  revalidatePath("/admin/usuarios");
  return { ok: true, message: "Pago actualizado." };
}
