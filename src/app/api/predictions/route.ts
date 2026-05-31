import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { predictionsRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const UpsertSchema = z.object({
  matchId: z.number().int().positive(),
  homeScore: z.number().int().min(0).max(30),
  awayScore: z.number().int().min(0).max(30),
});

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no-session" }, { status: 401 });

  // 60 escrituras / minuto por usuario. Frena scripts pero no afecta UX humana.
  const rl = await predictionsRateLimit(user.id);
  if (!rl.success) {
    return NextResponse.json(
      { error: "rate-limited", retryAfter: rl.retryAfter },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  // Gate de pago: solo confirmed (o admin) puede escribir pronósticos.
  // RLS también lo bloquea, pero acá damos un código de error claro para la UI.
  const { data: profile } = await supabase
    .from("profiles")
    .select("payment_status, role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: "no-profile" }, { status: 403 });
  if (profile.role !== "admin" && profile.payment_status !== "confirmed") {
    return NextResponse.json(
      { error: "payment-required", message: "Tu pago aún no está confirmado." },
      { status: 403 },
    );
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400 });
  }

  const parsed = UpsertSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { matchId, homeScore, awayScore } = parsed.data;

  // RLS impone: dueño + ronda abierta. Si falla, devolvemos 403 al cliente.
  const { data, error } = await supabase
    .from("predictions")
    .upsert(
      {
        user_id: user.id,
        match_id: matchId,
        home_score: homeScore,
        away_score: awayScore,
      },
      { onConflict: "user_id,match_id" },
    )
    .select("id, updated_at")
    .single();

  if (error) {
    const isLocked = /round|locked|new row violates row-level security/i.test(error.message);
    return NextResponse.json(
      { error: isLocked ? "round-closed" : "db", message: error.message },
      { status: isLocked ? 423 : 500 },
    );
  }

  return NextResponse.json({ ok: true, id: data.id, updatedAt: data.updated_at });
}

const DeleteSchema = z.object({ matchId: z.number().int().positive() });

export async function DELETE(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no-session" }, { status: 401 });

  const parsed = DeleteSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "validation" }, { status: 400 });

  // Recordatorio: el DELETE está bloqueado por RLS para jugadores.
  // Para "borrar" un pronóstico el cliente debería poner 0-0 explícito o no enviar nada.
  return NextResponse.json(
    { error: "delete-not-allowed", hint: "Las correcciones se hacen con un nuevo guardado." },
    { status: 405 },
  );
}
