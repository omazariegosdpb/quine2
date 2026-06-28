"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { publicEnv } from "@/lib/env";

export type RoundActionState = { ok: boolean; message?: string };

/** "yyyy-MM-ddTHH:mm" en hora GT → ISO con offset -06:00 */
function localGTtoISO(local: string): string {
  if (publicEnv.appTimezone === "America/Guatemala") return `${local}:00-06:00`;
  return local;
}

function getAdmin(): { ok: true; client: ReturnType<typeof createSupabaseAdminClient> } | { ok: false; message: string } {
  try {
    return { ok: true, client: createSupabaseAdminClient() };
  } catch {
    return { ok: false, message: "Falta SUPABASE_SERVICE_ROLE_KEY" };
  }
}

// ---------- Crear ronda -----------------------------------------------------

// ranking_group: etiqueta opcional para "amarrar" rondas en un ranking propio.
// Vacío → null (la ronda solo cuenta en el ranking general).
const RankingGroupField = z
  .string()
  .trim()
  .max(40)
  .regex(/^[A-Za-z0-9 _-]*$/, "Solo letras, números, espacios, guion y _")
  .transform((v) => (v === "" ? null : v))
  .nullable();

const CreateSchema = z.object({
  code:           z.string().trim().min(2).max(20).regex(/^[A-Z0-9_]+$/, "Solo mayúsculas, números y _"),
  name:           z.string().trim().min(2).max(80),
  closesAtLocal:  z.string().min(10),
  rankingGroup:   RankingGroupField,
});

export async function createRoundAction(_prev: RoundActionState, formData: FormData): Promise<RoundActionState> {
  const me = await requireAdmin();
  const parsed = CreateSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    closesAtLocal: formData.get("closesAtLocal"),
    rankingGroup: formData.get("rankingGroup") ?? "",
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const admin = getAdmin();
  if (!admin.ok) return admin;

  const { data, error } = await admin.client
    .from("rounds")
    .insert({
      code: parsed.data.code,
      name: parsed.data.name,
      closes_at: localGTtoISO(parsed.data.closesAtLocal),
      ranking_group: parsed.data.rankingGroup,
      is_active: true,
      is_locked: false,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { ok: false, message: `Ya existe una ronda con código "${parsed.data.code}"` };
    return { ok: false, message: error.message };
  }

  await admin.client.from("audit_log").insert({
    actor_id: me.userId,
    action: "create_round",
    entity: "rounds",
    entity_id: data.id,
    after_val: parsed.data,
  });

  revalidatePath("/admin/rondas");
  revalidatePath("/admin/partidos");
  return { ok: true, message: `Ronda "${parsed.data.name}" creada.` };
}

// ---------- Editar cierre ---------------------------------------------------

const EditSchema = z.object({
  roundId: z.string().uuid(),
  closesAtLocal: z.string().min(10),
});

export async function updateRoundCloseAction(_prev: RoundActionState, formData: FormData): Promise<RoundActionState> {
  const me = await requireAdmin();
  const parsed = EditSchema.safeParse({
    roundId: formData.get("roundId"),
    closesAtLocal: formData.get("closesAtLocal"),
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const admin = getAdmin();
  if (!admin.ok) return admin;

  const { data: before } = await admin.client.from("rounds").select("*").eq("id", parsed.data.roundId).single();
  if (!before) return { ok: false, message: "Ronda no encontrada" };
  if (before.is_locked) return { ok: false, message: "La ronda ya está sellada; no se puede modificar el cierre." };

  const newIso = localGTtoISO(parsed.data.closesAtLocal);

  const { error } = await admin.client.from("rounds").update({ closes_at: newIso }).eq("id", parsed.data.roundId);
  if (error) return { ok: false, message: error.message };

  await admin.client.from("audit_log").insert({
    actor_id: me.userId,
    action: "update_round_close",
    entity: "rounds",
    entity_id: parsed.data.roundId,
    before_val: { closes_at: before.closes_at },
    after_val: { closes_at: newIso },
  });

  revalidatePath("/admin/rondas");
  return { ok: true, message: "Cierre actualizado." };
}

// ---------- Amarrar ronda a un grupo de ranking -----------------------------

const RankingGroupSchema = z.object({
  roundId: z.string().uuid(),
  rankingGroup: RankingGroupField,
});

export async function updateRoundRankingGroupAction(_prev: RoundActionState, formData: FormData): Promise<RoundActionState> {
  const me = await requireAdmin();
  const parsed = RankingGroupSchema.safeParse({
    roundId: formData.get("roundId"),
    rankingGroup: formData.get("rankingGroup") ?? "",
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const admin = getAdmin();
  if (!admin.ok) return admin;

  const { data: before } = await admin.client
    .from("rounds")
    .select("ranking_group, name")
    .eq("id", parsed.data.roundId)
    .single();
  if (!before) return { ok: false, message: "Ronda no encontrada" };

  const { error } = await admin.client
    .from("rounds")
    .update({ ranking_group: parsed.data.rankingGroup })
    .eq("id", parsed.data.roundId);
  if (error) return { ok: false, message: error.message };

  await admin.client.from("audit_log").insert({
    actor_id: me.userId,
    action: "update_round_ranking_group",
    entity: "rounds",
    entity_id: parsed.data.roundId,
    before_val: { ranking_group: before.ranking_group },
    after_val: { ranking_group: parsed.data.rankingGroup },
  });

  revalidatePath("/admin/rondas");
  revalidatePath("/ranking");
  return {
    ok: true,
    message: parsed.data.rankingGroup
      ? `“${before.name}” amarrada al ranking “${parsed.data.rankingGroup}”.`
      : `“${before.name}” desvinculada (solo cuenta en el ranking general).`,
  };
}

// ---------- Sellar ----------------------------------------------------------

export async function sealRoundAction(roundId: string): Promise<RoundActionState> {
  await requireAdmin();
  const admin = getAdmin();
  if (!admin.ok) return admin;

  const { data, error } = await admin.client.rpc("seal_round" as never, { p_round_id: roundId } as never);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/admin/rondas");
  return {
    ok: true,
    message: `Ronda sellada. Filas: ${(data as unknown as { sealed_rows: number }[])?.[0]?.sealed_rows ?? 0}.`,
  };
}

// ---------- Toggle activa ---------------------------------------------------

export async function toggleRoundActiveAction(roundId: string, nextActive: boolean): Promise<RoundActionState> {
  const me = await requireAdmin();
  const admin = getAdmin();
  if (!admin.ok) return admin;

  const { data: before } = await admin.client.from("rounds").select("is_active, name").eq("id", roundId).single();
  if (!before) return { ok: false, message: "Ronda no encontrada" };

  const { error } = await admin.client.from("rounds").update({ is_active: nextActive }).eq("id", roundId);
  if (error) return { ok: false, message: error.message };

  await admin.client.from("audit_log").insert({
    actor_id: me.userId,
    action: nextActive ? "activate_round" : "deactivate_round",
    entity: "rounds",
    entity_id: roundId,
    before_val: { is_active: before.is_active },
    after_val: { is_active: nextActive },
  });

  revalidatePath("/admin/rondas");
  revalidatePath("/pronosticos");
  revalidatePath("/ranking");
  return { ok: true, message: nextActive ? "Ronda activada." : "Ronda desactivada (las predicciones se conservan pero no suman al ranking)." };
}

// ---------- Eliminar --------------------------------------------------------

export async function deleteRoundAction(roundId: string): Promise<RoundActionState> {
  const me = await requireAdmin();
  const admin = getAdmin();
  if (!admin.ok) return admin;

  const { data: round } = await admin.client.from("rounds").select("*").eq("id", roundId).single();
  if (!round) return { ok: false, message: "Ronda no encontrada" };
  if (round.is_locked) return { ok: false, message: "No se puede eliminar una ronda sellada. Si necesitás removerla, primero limpiá los snapshots con la migración 20260512000400." };

  // El cascade va a borrar matches; pero si algún match tiene predictions,
  // el trigger anti-delete lo va a bloquear con un mensaje claro.
  const { error } = await admin.client.from("rounds").delete().eq("id", roundId);
  if (error) {
    if (/predicciones|predictions|pronostico/i.test(error.message)) {
      return { ok: false, message: "No se puede eliminar: la ronda tiene partidos con pronósticos cargados. Desactivala en su lugar." };
    }
    return { ok: false, message: error.message };
  }

  await admin.client.from("audit_log").insert({
    actor_id: me.userId,
    action: "delete_round",
    entity: "rounds",
    entity_id: roundId,
    before_val: { code: round.code, name: round.name },
  });

  revalidatePath("/admin/rondas");
  revalidatePath("/admin/partidos");
  return { ok: true, message: `Ronda "${round.name}" eliminada.` };
}
