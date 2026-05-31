"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);

export type BrandingState = { ok: boolean; message?: string };

const NameSchema = z
  .string()
  .trim()
  .min(2, "El nombre debe tener al menos 2 caracteres")
  .max(60, "Máximo 60 caracteres");

export async function updateBrandingAction(
  _prev: BrandingState,
  formData: FormData,
): Promise<BrandingState> {
  const me = await requireAdmin();

  const nameRaw = formData.get("companyName");
  const parsed = NameSchema.safeParse(nameRaw);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Nombre inválido" };
  }
  const companyName = parsed.data;

  const file = formData.get("logo");
  const removeLogo = formData.get("removeLogo") === "1";

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return { ok: false, message: "Falta SUPABASE_SERVICE_ROLE_KEY" };
  }

  let newLogoPath: string | null | undefined; // undefined = no tocar
  if (removeLogo) {
    newLogoPath = null;
  } else if (file instanceof File && file.size > 0) {
    if (file.size > MAX_BYTES) {
      return { ok: false, message: "El logo no puede pesar más de 2 MB." };
    }
    if (!ALLOWED.has(file.type)) {
      return { ok: false, message: "Formato no permitido. Usa PNG, JPG, WEBP o SVG." };
    }

    const ext = (file.name.split(".").pop() ?? "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
    const path = `logo-${Date.now()}.${ext}`;

    const { error: upErr } = await admin.storage
      .from("branding")
      .upload(path, file, { contentType: file.type, upsert: true });
    if (upErr) return { ok: false, message: `No se pudo subir el logo: ${upErr.message}` };

    newLogoPath = path;
  }

  // Borrar logo anterior cuando reemplazamos o removemos.
  if (newLogoPath !== undefined) {
    const { data: prev } = await admin
      .from("branding")
      .select("logo_path")
      .eq("id", "singleton")
      .maybeSingle();
    if (prev?.logo_path && prev.logo_path !== newLogoPath) {
      await admin.storage.from("branding").remove([prev.logo_path]);
    }
  }

  const updates: { company_name: string; updated_by: string; logo_path?: string | null } = {
    company_name: companyName,
    updated_by: me.userId,
  };
  if (newLogoPath !== undefined) updates.logo_path = newLogoPath;

  const { error } = await admin.from("branding").update(updates).eq("id", "singleton");
  if (error) return { ok: false, message: error.message };

  await admin.from("audit_log").insert({
    actor_id: me.userId,
    action: "branding_update",
    entity: "branding",
    entity_id: "singleton",
    after_val: { company_name: companyName, logo_path: newLogoPath ?? "unchanged" },
  } as never);

  revalidatePath("/", "layout");
  return { ok: true, message: "Marca actualizada." };
}
