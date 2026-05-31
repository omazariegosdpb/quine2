import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/types";

export type SessionInfo = {
  response: NextResponse;
  user: { id: string; email?: string | null } | null;
  mustChangePassword: boolean;
  isActive: boolean;
};

/**
 * Refresca el token de Supabase y devuelve la sesión + metadatos clave del profile:
 *   - mustChangePassword: el admin asignó una contraseña temporal que el usuario debe cambiar
 *   - isActive: la cuenta no está retirada/anonimizada
 *
 * Llamado desde src/proxy.ts. Hace 1 query a `profiles` por request autenticado.
 */
export async function updateSession(request: NextRequest): Promise<SessionInfo> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    publicEnv.supabaseUrl,
    publicEnv.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(items) {
          for (const { name, value } of items) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of items) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { response, user: null, mustChangePassword: false, isActive: true };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("must_change_password, is_active")
    .eq("id", user.id)
    .maybeSingle();

  return {
    response,
    user: { id: user.id, email: user.email ?? null },
    mustChangePassword: !!profile?.must_change_password,
    isActive: profile?.is_active ?? true,
  };
}
