"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";

export type TextsState = {
  ok: boolean;
  message?: string;
  saved?: { quickRules: string[]; paymentSteps: string[] };
};

const MAX_ITEMS = 12;
const MAX_LEN = 280;

const ItemSchema = z
  .string()
  .trim()
  .min(1, "Ningún ítem puede estar vacío.")
  .max(MAX_LEN, `Máximo ${MAX_LEN} caracteres por ítem.`);

const ListSchema = z
  .array(ItemSchema)
  .min(1, "Tiene que haber al menos un ítem.")
  .max(MAX_ITEMS, `Máximo ${MAX_ITEMS} ítems.`);

export async function updateTextsAction(
  _prev: TextsState,
  formData: FormData,
): Promise<TextsState> {
  const me = await requireAdmin();

  const rawRules = formData.getAll("quick_rules").map((v) => String(v));
  const rawSteps = formData.getAll("payment_steps").map((v) => String(v));

  const rules = ListSchema.safeParse(rawRules);
  if (!rules.success) {
    return {
      ok: false,
      message: `Reglas rápidas: ${rules.error.issues[0]?.message ?? "inválido"}`,
    };
  }

  const steps = ListSchema.safeParse(rawSteps);
  if (!steps.success) {
    return {
      ok: false,
      message: `Cómo pagar: ${steps.error.issues[0]?.message ?? "inválido"}`,
    };
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return { ok: false, message: "Falta SUPABASE_SERVICE_ROLE_KEY" };
  }

  const { error } = await admin
    .from("app_texts")
    .update({
      quick_rules: rules.data,
      payment_steps: steps.data,
      updated_by: me.userId,
    })
    .eq("id", "singleton");

  if (error) return { ok: false, message: error.message };

  await admin.from("audit_log").insert({
    actor_id: me.userId,
    action: "app_texts_update",
    entity: "app_texts",
    entity_id: "singleton",
    after_val: { quick_rules: rules.data, payment_steps: steps.data },
  } as never);

  // Estos textos se ven en home y en /pago; invalidamos todo el layout.
  revalidatePath("/", "layout");

  return {
    ok: true,
    message: "Textos actualizados.",
    saved: { quickRules: rules.data, paymentSteps: steps.data },
  };
}
