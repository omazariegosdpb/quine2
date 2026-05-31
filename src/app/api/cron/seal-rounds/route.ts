import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Cron de Vercel. Corre 1 vez por día (limitación del plan Hobby).
 * Si una ronda no está sellada y su closes_at ya pasó, ejecuta seal_round() y registra el hash.
 *
 * IMPORTANTE — anti-fraude:
 * La RLS (predictions_*_open) ya bloquea cualquier escritura/edición en el INSTANTE
 * exacto del closes_at, sin depender del cron. Lo que hace este endpoint es generar el
 * snapshot inmutable + hash SHA-256 para auditoría. Por eso un sweep diario es suficiente:
 * el sello visible llega como tarde 24h después del cierre, y mientras tanto nadie puede tocar nada.
 *
 * El admin puede adelantarlo manualmente desde /admin/rondas → "Sellar ronda ahora".
 *
 * Schedule actual (vercel.json):  "5 6 * * *"  → 06:05 UTC (00:05 hora Guatemala) cada día.
 * Vercel firma estas requests con header `authorization: Bearer <CRON_SECRET>`.
 */
export async function GET(req: Request) {
  const env = serverEnv();
  if (!env.CRON_SECRET) {
    return NextResponse.json({ error: "cron-not-configured" }, { status: 500 });
  }

  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return NextResponse.json({ error: "admin-not-configured" }, { status: 500 });
  }

  const now = new Date().toISOString();
  const { data: rounds } = await admin
    .from("rounds")
    .select("id, code, closes_at, is_locked")
    .eq("is_locked", false)
    .lte("closes_at", now);

  const results: Array<{ code: string; ok: boolean; message?: string; hash?: string }> = [];

  for (const r of rounds ?? []) {
    const { data, error } = await admin.rpc("seal_round" as never, { p_round_id: r.id } as never);
    if (error) {
      results.push({ code: r.code, ok: false, message: error.message });
    } else {
      const row = (data as unknown as { content_hash: string }[] | null)?.[0];
      results.push({ code: r.code, ok: true, hash: row?.content_hash });
    }
  }

  return NextResponse.json({ checkedAt: now, sealed: results.length, results });
}
