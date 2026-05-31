"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";

const CreateSchema = z.object({
  email: z.string().email("Correo inválido"),
  full_name: z.string().trim().min(2, "Nombre muy corto"),
  display_name: z.string().trim().min(2, "Apodo muy corto"),
  password: z.string().min(12, "Mínimo 12 caracteres"),
});

export type ActionState = { ok: boolean; message?: string };

export async function createUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = CreateSchema.safeParse({
    email: formData.get("email"),
    full_name: formData.get("full_name"),
    display_name: formData.get("display_name"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch (e) {
    return {
      ok: false,
      message:
        "SUPABASE_SERVICE_ROLE_KEY no está configurada en .env.local. Sin ella no puedo crear usuarios.",
    };
  }

  const { error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: {
      full_name: parsed.data.full_name,
      display_name: parsed.data.display_name,
      must_change_password: true,
      role: "player",
    },
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/admin/usuarios");
  return { ok: true, message: `Usuario creado: ${parsed.data.email}` };
}

const ToggleSchema = z.object({
  userId: z.string().uuid(),
  action: z.enum(["deactivate", "activate", "reset-password"]),
});

export async function userAdminAction(formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = ToggleSchema.safeParse({
    userId: formData.get("userId"),
    action: formData.get("action"),
  });
  if (!parsed.success) return { ok: false, message: "Acción inválida" };

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return { ok: false, message: "Falta SUPABASE_SERVICE_ROLE_KEY" };
  }

  const supabase = admin;

  if (parsed.data.action === "deactivate") {
    // Anonimización (decisión del cliente): no borrar, anonimizar.
    const { error } = await supabase
      .from("profiles")
      .update({
        is_active: false,
        full_name: "[anonimizado]",
        display_name: "Participante retirado",
        payment_status: "refunded",
      })
      .eq("id", parsed.data.userId);
    if (error) return { ok: false, message: error.message };

    // Banear en auth para que no pueda volver a loguearse.
    await supabase.auth.admin.updateUserById(parsed.data.userId, { ban_duration: "100000h" });

    revalidatePath("/admin/usuarios");
    return { ok: true, message: "Usuario retirado y anonimizado." };
  }

  if (parsed.data.action === "activate") {
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: true })
      .eq("id", parsed.data.userId);
    if (error) return { ok: false, message: error.message };
    await supabase.auth.admin.updateUserById(parsed.data.userId, { ban_duration: "none" });
    revalidatePath("/admin/usuarios");
    return { ok: true, message: "Usuario reactivado." };
  }

  if (parsed.data.action === "reset-password") {
    const newPwd = randomPassword();
    const { error } = await supabase.auth.admin.updateUserById(parsed.data.userId, {
      password: newPwd,
    });
    if (error) return { ok: false, message: error.message };
    await supabase
      .from("profiles")
      .update({ must_change_password: true })
      .eq("id", parsed.data.userId);
    revalidatePath("/admin/usuarios");
    return { ok: true, message: `Nueva contraseña temporal: ${newPwd}` };
  }

  return { ok: false, message: "Acción no soportada" };
}

function randomPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digit = "23456789";
  const all = upper + lower + digit;
  const len = 14;
  let out = "";
  out += upper[Math.floor(Math.random() * upper.length)];
  out += lower[Math.floor(Math.random() * lower.length)];
  out += digit[Math.floor(Math.random() * digit.length)];
  for (let i = 3; i < len; i++) {
    out += all[Math.floor(Math.random() * all.length)];
  }
  return out;
}
