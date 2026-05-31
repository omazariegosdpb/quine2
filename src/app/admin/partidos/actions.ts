"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { publicEnv } from "@/lib/env";

function localGTtoISO(local: string): string {
  if (publicEnv.appTimezone === "America/Guatemala") return `${local}:00-06:00`;
  return local;
}

function getAdmin() {
  try {
    return { ok: true as const, client: createSupabaseAdminClient() };
  } catch {
    return { ok: false as const, message: "Falta SUPABASE_SERVICE_ROLE_KEY" };
  }
}

export type MatchActionState = { ok: boolean; message?: string };

const BaseSchema = z.object({
  roundId: z.string().uuid(),
  homeTeamId: z.coerce.number().int().positive(),
  awayTeamId: z.coerce.number().int().positive(),
  kickoffAtLocal: z.string().min(10),
  venue: z.string().trim().max(120).optional().or(z.literal("")),
  groupLetter: z.string().regex(/^[A-L]$/).optional().or(z.literal("")),
});

const CreateSchema = BaseSchema.refine((d) => d.homeTeamId !== d.awayTeamId, {
  message: "Los equipos deben ser distintos",
  path: ["awayTeamId"],
});

const UpdateSchema = BaseSchema.extend({
  matchId: z.coerce.number().int().positive(),
}).refine((d) => d.homeTeamId !== d.awayTeamId, {
  message: "Los equipos deben ser distintos",
  path: ["awayTeamId"],
});

async function nextMatchId(client: ReturnType<typeof createSupabaseAdminClient>): Promise<number> {
  // Tomamos el id más alto y sumamos 1. Empezamos desde 2000 para no chocar con seeds (1-72) ni simulacro (1001-1006).
  const { data } = await client
    .from("matches")
    .select("id")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  const max = data?.id ?? 0;
  return Math.max(max + 1, 2000);
}

// ---------- Crear -----------------------------------------------------------

export async function createMatchAction(_prev: MatchActionState, formData: FormData): Promise<MatchActionState> {
  const me = await requireAdmin();
  const parsed = CreateSchema.safeParse({
    roundId:        formData.get("roundId"),
    homeTeamId:     formData.get("homeTeamId"),
    awayTeamId:     formData.get("awayTeamId"),
    kickoffAtLocal: formData.get("kickoffAtLocal"),
    venue:          formData.get("venue") ?? undefined,
    groupLetter:    formData.get("groupLetter") ?? undefined,
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const admin = getAdmin();
  if (!admin.ok) return admin;

  const id = await nextMatchId(admin.client);
  const venue = parsed.data.venue?.trim() ? parsed.data.venue.trim() : null;
  const group = parsed.data.groupLetter ? parsed.data.groupLetter : null;

  const { error } = await admin.client.from("matches").insert({
    id,
    round_id: parsed.data.roundId,
    group_letter: group,
    home_team_id: parsed.data.homeTeamId,
    away_team_id: parsed.data.awayTeamId,
    kickoff_at: localGTtoISO(parsed.data.kickoffAtLocal),
    venue,
    status: "scheduled",
    home_score: null,
    away_score: null,
  });
  if (error) return { ok: false, message: error.message };

  await admin.client.from("audit_log").insert({
    actor_id: me.userId,
    action: "create_match",
    entity: "matches",
    entity_id: String(id),
    after_val: { ...parsed.data, id },
  });

  revalidatePath("/admin/partidos");
  revalidatePath("/pronosticos");
  return { ok: true, message: `Partido #${id} creado.` };
}

// ---------- Editar ----------------------------------------------------------

export async function updateMatchAction(_prev: MatchActionState, formData: FormData): Promise<MatchActionState> {
  const me = await requireAdmin();
  const parsed = UpdateSchema.safeParse({
    matchId:        formData.get("matchId"),
    roundId:        formData.get("roundId"),
    homeTeamId:     formData.get("homeTeamId"),
    awayTeamId:     formData.get("awayTeamId"),
    kickoffAtLocal: formData.get("kickoffAtLocal"),
    venue:          formData.get("venue") ?? undefined,
    groupLetter:    formData.get("groupLetter") ?? undefined,
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const admin = getAdmin();
  if (!admin.ok) return admin;

  const { data: before } = await admin.client.from("matches").select("*").eq("id", parsed.data.matchId).single();
  if (!before) return { ok: false, message: "Partido no encontrado" };

  const venue = parsed.data.venue?.trim() ? parsed.data.venue.trim() : null;
  const group = parsed.data.groupLetter ? parsed.data.groupLetter : null;

  const after = {
    round_id: parsed.data.roundId,
    group_letter: group,
    home_team_id: parsed.data.homeTeamId,
    away_team_id: parsed.data.awayTeamId,
    kickoff_at: localGTtoISO(parsed.data.kickoffAtLocal),
    venue,
  };

  const { error } = await admin.client.from("matches").update(after).eq("id", parsed.data.matchId);
  if (error) return { ok: false, message: error.message };

  await admin.client.from("audit_log").insert({
    actor_id: me.userId,
    action: "update_match",
    entity: "matches",
    entity_id: String(parsed.data.matchId),
    before_val: {
      round_id: before.round_id,
      group_letter: before.group_letter,
      home_team_id: before.home_team_id,
      away_team_id: before.away_team_id,
      kickoff_at: before.kickoff_at,
      venue: before.venue,
    },
    after_val: after,
  });

  revalidatePath("/admin/partidos");
  revalidatePath("/pronosticos");
  return { ok: true, message: "Partido actualizado." };
}

// ---------- Eliminar --------------------------------------------------------

export async function deleteMatchAction(matchId: number): Promise<MatchActionState> {
  const me = await requireAdmin();
  const admin = getAdmin();
  if (!admin.ok) return admin;

  const { data: before } = await admin.client.from("matches").select("*").eq("id", matchId).single();
  if (!before) return { ok: false, message: "Partido no encontrado" };

  const { error } = await admin.client.from("matches").delete().eq("id", matchId);
  if (error) {
    if (/pronostico|prediction/i.test(error.message)) {
      return { ok: false, message: "No se puede eliminar: el partido tiene pronósticos cargados." };
    }
    return { ok: false, message: error.message };
  }

  await admin.client.from("audit_log").insert({
    actor_id: me.userId,
    action: "delete_match",
    entity: "matches",
    entity_id: String(matchId),
    before_val: { id: before.id, home_team_id: before.home_team_id, away_team_id: before.away_team_id, kickoff_at: before.kickoff_at },
  });

  revalidatePath("/admin/partidos");
  revalidatePath("/pronosticos");
  return { ok: true, message: `Partido #${matchId} eliminado.` };
}
