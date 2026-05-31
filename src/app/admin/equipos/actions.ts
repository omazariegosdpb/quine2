"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";

function getAdmin() {
  try {
    return { ok: true as const, client: createSupabaseAdminClient() };
  } catch {
    return { ok: false as const, message: "Falta SUPABASE_SERVICE_ROLE_KEY" };
  }
}

export type TeamActionState = { ok: boolean; message?: string };

const BaseSchema = z.object({
  name:        z.string().trim().min(2).max(60),
  isoCode:     z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Debe ser 3 letras (FIFA, ej. MEX)"),
  groupLetter: z.string().trim().toUpperCase().regex(/^[A-L]$/).optional().or(z.literal("")),
});

const CreateSchema = BaseSchema.extend({
  id: z.coerce.number().int().positive(),
});

const UpdateSchema = BaseSchema.extend({
  id: z.coerce.number().int().positive(),
});

async function nextTeamId(client: ReturnType<typeof createSupabaseAdminClient>): Promise<number> {
  const { data } = await client.from("teams").select("id").order("id", { ascending: false }).limit(1).maybeSingle();
  return (data?.id ?? 0) + 1;
}

// ---------- Crear -----------------------------------------------------------

export async function createTeamAction(_prev: TeamActionState, formData: FormData): Promise<TeamActionState> {
  const me = await requireAdmin();
  const admin = getAdmin();
  if (!admin.ok) return admin;

  const id = await nextTeamId(admin.client);
  const parsed = CreateSchema.safeParse({
    id,
    name: formData.get("name"),
    isoCode: formData.get("isoCode"),
    groupLetter: formData.get("groupLetter") ?? undefined,
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const { error } = await admin.client.from("teams").insert({
    id: parsed.data.id,
    name: parsed.data.name,
    iso_code: parsed.data.isoCode,
    group_letter: parsed.data.groupLetter ? parsed.data.groupLetter : null,
  });
  if (error) return { ok: false, message: error.message };

  await admin.client.from("audit_log").insert({
    actor_id: me.userId,
    action: "create_team",
    entity: "teams",
    entity_id: String(parsed.data.id),
    after_val: parsed.data,
  });

  revalidatePath("/admin/equipos");
  return { ok: true, message: `Equipo "${parsed.data.name}" creado.` };
}

// ---------- Actualizar ------------------------------------------------------

export async function updateTeamAction(_prev: TeamActionState, formData: FormData): Promise<TeamActionState> {
  const me = await requireAdmin();
  const admin = getAdmin();
  if (!admin.ok) return admin;

  const parsed = UpdateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    isoCode: formData.get("isoCode"),
    groupLetter: formData.get("groupLetter") ?? undefined,
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const { data: before } = await admin.client.from("teams").select("*").eq("id", parsed.data.id).single();
  if (!before) return { ok: false, message: "Equipo no encontrado" };

  const after = {
    name: parsed.data.name,
    iso_code: parsed.data.isoCode,
    group_letter: parsed.data.groupLetter ? parsed.data.groupLetter : null,
  };

  const { error } = await admin.client.from("teams").update(after).eq("id", parsed.data.id);
  if (error) return { ok: false, message: error.message };

  await admin.client.from("audit_log").insert({
    actor_id: me.userId,
    action: "update_team",
    entity: "teams",
    entity_id: String(parsed.data.id),
    before_val: { name: before.name, iso_code: before.iso_code, group_letter: before.group_letter },
    after_val: after,
  });

  revalidatePath("/admin/equipos");
  revalidatePath("/admin/partidos");
  revalidatePath("/pronosticos");
  return { ok: true, message: "Equipo actualizado." };
}

// ---------- Eliminar --------------------------------------------------------

export async function deleteTeamAction(id: number): Promise<TeamActionState> {
  const me = await requireAdmin();
  const admin = getAdmin();
  if (!admin.ok) return admin;

  const { data: before } = await admin.client.from("teams").select("*").eq("id", id).single();
  if (!before) return { ok: false, message: "Equipo no encontrado" };

  const { error } = await admin.client.from("teams").delete().eq("id", id);
  if (error) {
    if (/violates foreign key|matches_/i.test(error.message)) {
      return { ok: false, message: "No se puede eliminar: este equipo está asignado a uno o más partidos. Quitalo de los partidos primero." };
    }
    return { ok: false, message: error.message };
  }

  await admin.client.from("audit_log").insert({
    actor_id: me.userId,
    action: "delete_team",
    entity: "teams",
    entity_id: String(id),
    before_val: { name: before.name, iso_code: before.iso_code, group_letter: before.group_letter },
  });

  revalidatePath("/admin/equipos");
  return { ok: true, message: `Equipo "${before.name}" eliminado.` };
}
