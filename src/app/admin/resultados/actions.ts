"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { adminRateLimit } from "@/lib/rate-limit";

const Schema = z.object({
  matchId: z.number().int().positive(),
  homeScore: z.number().int().min(0).max(30),
  awayScore: z.number().int().min(0).max(30),
});

export async function setMatchResult(input: {
  matchId: number;
  homeScore: number;
  awayScore: number;
}) {
  const me = await requireAdmin();
  const rl = await adminRateLimit(me.userId);
  if (!rl.success) {
    return {
      ok: false as const,
      message: `Demasiadas operaciones. Probá en ${rl.retryAfter}s.`,
    };
  }
  const parsed = Schema.safeParse(input);
  if (!parsed.success) return { ok: false as const, message: "Datos inválidos" };

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return { ok: false as const, message: "Falta SUPABASE_SERVICE_ROLE_KEY" };
  }

  const { data: before } = await admin.from("matches").select("*").eq("id", parsed.data.matchId).single();
  if (!before) return { ok: false as const, message: "Partido no encontrado" };

  const { error } = await admin
    .from("matches")
    .update({
      home_score: parsed.data.homeScore,
      away_score: parsed.data.awayScore,
      status: "finished",
    })
    .eq("id", parsed.data.matchId);

  if (error) return { ok: false as const, message: error.message };

  await admin.from("audit_log").insert({
    actor_id: me.userId,
    action: "set_match_result",
    entity: "matches",
    entity_id: String(parsed.data.matchId),
    before_val: { home_score: before.home_score, away_score: before.away_score, status: before.status },
    after_val: { home_score: parsed.data.homeScore, away_score: parsed.data.awayScore, status: "finished" },
  } as never);

  revalidatePath("/admin/resultados");
  revalidatePath("/ranking");
  return { ok: true as const };
}

export async function clearMatchResult(matchId: number) {
  const me = await requireAdmin();
  const rl = await adminRateLimit(me.userId);
  if (!rl.success) {
    return {
      ok: false as const,
      message: `Demasiadas operaciones. Probá en ${rl.retryAfter}s.`,
    };
  }
  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return { ok: false as const, message: "Falta SUPABASE_SERVICE_ROLE_KEY" };
  }
  const { data: before } = await admin.from("matches").select("*").eq("id", matchId).single();
  if (!before) return { ok: false as const, message: "Partido no encontrado" };

  const { error } = await admin
    .from("matches")
    .update({ home_score: null, away_score: null, status: "scheduled" })
    .eq("id", matchId);
  if (error) return { ok: false as const, message: error.message };

  await admin.from("audit_log").insert({
    actor_id: me.userId,
    action: "clear_match_result",
    entity: "matches",
    entity_id: String(matchId),
    before_val: { home_score: before.home_score, away_score: before.away_score, status: before.status },
    after_val: { home_score: null, away_score: null, status: "scheduled" },
  } as never);

  revalidatePath("/admin/resultados");
  revalidatePath("/ranking");
  return { ok: true as const };
}
