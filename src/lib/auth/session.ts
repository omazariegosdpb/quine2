import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/supabase/types";

export type SessionContext = {
  userId: string;
  email: string;
  profile: Profile;
};

/**
 * Obtiene la sesión actual (puede devolver null si no hay usuario).
 * Para uso en Server Components que necesitan mostrar contenido distinto según haya o no sesión.
 */
export async function getSession(): Promise<SessionContext | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  return {
    userId: user.id,
    email: user.email ?? "",
    profile,
  };
}

/**
 * Exige sesión válida. Redirige a /login si no hay sesión.
 * Redirige a /cambio-password si el usuario debe cambiarla.
 * Redirige a /login si el perfil está inactivo (retirado/anonimizado).
 *
 * Pasale skipPasswordCheck=true en /cambio-password mismo para no entrar en loop.
 */
export async function requireSession(opts: { skipPasswordCheck?: boolean } = {}): Promise<SessionContext> {
  const ctx = await getSession();
  if (!ctx) redirect("/login");

  if (!ctx.profile.is_active) {
    redirect("/login?inactive=1");
  }

  if (ctx.profile.must_change_password && !opts.skipPasswordCheck) {
    redirect("/cambio-password");
  }

  return ctx;
}

export async function requireAdmin(): Promise<SessionContext> {
  const ctx = await requireSession();
  if (ctx.profile.role !== "admin") {
    redirect("/?forbidden=1");
  }
  return ctx;
}
