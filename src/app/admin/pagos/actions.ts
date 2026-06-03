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

const ManualConfirmSchema = z.object({
  userId: z.string().uuid(),
  notes: z.string().max(500).optional(),
});

/**
 * Confirma a un jugador SIN comprobante (p. ej. pagó en efectivo / por fuera).
 * Si ya tiene un pago, confirma el más reciente; si no tiene ninguno, crea uno
 * marcado como 'confirmed' para dejar rastro auditable. Siempre refleja el
 * payment_status del profile.
 */
export async function confirmWithoutReceipt(_prev: State, formData: FormData): Promise<State> {
  const me = await requireAdmin();
  const parsed = ManualConfirmSchema.safeParse({
    userId: formData.get("userId"),
    notes: formData.get("notes") ?? undefined,
  });
  if (!parsed.success) return { ok: false, message: "Selecciona un jugador válido." };

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return { ok: false, message: "Falta SUPABASE_SERVICE_ROLE_KEY" };
  }

  const noteText = parsed.data.notes?.trim() || "Confirmado manualmente sin comprobante.";
  const now = new Date().toISOString();

  // ¿Ya existe un pago? Confirmamos el más reciente; si no, creamos uno nuevo.
  const { data: existing } = await admin
    .from("payments")
    .select("id, status")
    .eq("user_id", parsed.data.userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { error } = await admin
      .from("payments")
      .update({ status: "confirmed", confirmed_by: me.userId, confirmed_at: now, notes: noteText })
      .eq("id", existing.id);
    if (error) return { ok: false, message: error.message };
  } else {
    const { error } = await admin.from("payments").insert({
      user_id: parsed.data.userId,
      receipt_path: null,
      status: "confirmed",
      confirmed_by: me.userId,
      confirmed_at: now,
      notes: noteText,
    } as never);
    if (error) return { ok: false, message: error.message };
  }

  const { error: profErr } = await admin
    .from("profiles")
    .update({ payment_status: "confirmed" })
    .eq("id", parsed.data.userId);
  if (profErr) return { ok: false, message: profErr.message };

  await admin.from("audit_log").insert({
    actor_id: me.userId,
    action: "payment_confirm_manual",
    entity: "profiles",
    entity_id: parsed.data.userId,
    before_val: { payment_status: existing?.status ?? null },
    after_val: { payment_status: "confirmed", notes: noteText },
  } as never);

  revalidatePath("/admin/pagos");
  revalidatePath("/admin/usuarios");
  return { ok: true, message: "Jugador confirmado sin comprobante." };
}
