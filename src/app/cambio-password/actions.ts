"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

const PasswordSchema = z
  .object({
    password:        z.string().min(12, "Mínimo 12 caracteres"),
    passwordConfirm: z.string().min(12, "Mínimo 12 caracteres"),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    path: ["passwordConfirm"],
    message: "Las contraseñas no coinciden",
  })
  .refine((d) => /[A-Z]/.test(d.password) && /[a-z]/.test(d.password) && /[0-9]/.test(d.password), {
    path: ["password"],
    message: "Incluí mayúscula, minúscula y al menos un número",
  });

export type ChangePasswordState = { ok: boolean; message?: string };

export async function changePasswordAction(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const parsed = PasswordSchema.safeParse({
    password: formData.get("password"),
    passwordConfirm: formData.get("passwordConfirm"),
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sesión inválida" };

  const { error: updateErr } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (updateErr) {
    return { ok: false, message: updateErr.message };
  }

  // Marcar el flag con service_role (defensa: el cambio del flag solo después
  // de que auth.updateUser haya sido exitoso, no por el cliente directamente).
  try {
    const admin = createSupabaseAdminClient();
    const { error: profileErr } = await admin
      .from("profiles")
      .update({ must_change_password: false })
      .eq("id", user.id);
    if (profileErr) {
      return { ok: false, message: "Contraseña cambiada pero el perfil no se pudo marcar. Intenta de nuevo." };
    }
  } catch {
    return { ok: false, message: "Contraseña cambiada pero falta SUPABASE_SERVICE_ROLE_KEY en el servidor para confirmar el cambio. Avisá al organizador." };
  }

  redirect("/");
}
