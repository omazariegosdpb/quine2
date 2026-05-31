import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"]);

/**
 * Sube un comprobante de pago al bucket privado `payment-receipts`.
 * Path: `<user_id>/<timestamp>.<ext>`
 * Crea/actualiza el registro en `payments` como 'submitted'.
 */
export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no-session" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "no-file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "too-large", max: MAX_BYTES }, { status: 413 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: "type-not-allowed", allowed: Array.from(ALLOWED) }, { status: 415 });
  }

  // El bucket es privado: necesitamos service_role para subir desde servidor sin pelearnos con policies.
  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return NextResponse.json({ error: "admin-not-configured" }, { status: 500 });
  }

  const ext = (file.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${user.id}/${Date.now()}.${ext || "bin"}`;
  const { error: uploadErr } = await admin.storage
    .from("payment-receipts")
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
  if (uploadErr) return NextResponse.json({ error: "upload", message: uploadErr.message }, { status: 500 });

  // Insertar pago (un solo registro activo por usuario; si ya hay submitted lo actualizamos).
  const { data: existing } = await admin
    .from("payments")
    .select("id")
    .eq("user_id", user.id)
    .in("status", ["submitted", "rejected"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { error } = await admin
      .from("payments")
      .update({ receipt_path: path, status: "submitted", notes: null })
      .eq("id", existing.id);
    if (error) return NextResponse.json({ error: "update", message: error.message }, { status: 500 });
  } else {
    const { error } = await admin
      .from("payments")
      .insert({ user_id: user.id, receipt_path: path, status: "submitted" });
    if (error) return NextResponse.json({ error: "insert", message: error.message }, { status: 500 });
  }

  await admin
    .from("profiles")
    .update({ payment_status: "submitted" })
    .eq("id", user.id);

  return NextResponse.json({ ok: true });
}
