"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loginRateLimit } from "@/lib/rate-limit";

const LoginSchema = z.object({
  email: z.string().email("Correo inválido"),
  password: z.string().min(1, "Ingresá tu contraseña"),
  next: z.string().optional(),
  captchaToken: z.string().optional(),
});

export type LoginState = {
  ok: boolean;
  message?: string;
};

async function clientIp(): Promise<string> {
  const h = await headers();
  // Vercel pone "x-forwarded-for" (puede ser "ip1, ip2"); el primero es el cliente.
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  const real = h.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
    // El widget de Cloudflare Turnstile inyecta este campo automáticamente.
    captchaToken: formData.get("cf-turnstile-response") ?? undefined,
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  // Anti brute-force: 10 intentos / 5 min por IP (no-op si Upstash no está configurado).
  const ip = await clientIp();
  const rl = await loginRateLimit(ip);
  if (!rl.success) {
    return {
      ok: false,
      message: `Demasiados intentos. Probá de nuevo en ${rl.retryAfter} segundos.`,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
    options: parsed.data.captchaToken
      ? { captchaToken: parsed.data.captchaToken }
      : undefined,
  });

  if (error) {
    // No revelar si el email existe o no — siempre mismo mensaje.
    return { ok: false, message: "Correo o contraseña incorrectos." };
  }

  // El destino final lo decide el servidor según must_change_password (vía session.ts).
  const next = parsed.data.next && parsed.data.next.startsWith("/") ? parsed.data.next : "/";
  redirect(next);
}
