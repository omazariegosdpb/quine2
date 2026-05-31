import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { publicEnv, serverEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/types";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    publicEnv.supabaseUrl,
    publicEnv.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(items) {
          try {
            for (const { name, value, options } of items) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Llamado desde Server Component — silencioso; las cookies se renuevan en el siguiente RSC.
          }
        },
      },
    },
  );
}

/**
 * Cliente con SERVICE ROLE — NUNCA usar fuera de Route Handlers / Server Actions.
 * Salta RLS. Solo para operaciones administrativas confiables (crear usuarios, sellar rondas, etc.).
 */
export function createSupabaseAdminClient() {
  const env = serverEnv();
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY no está configurada");
  }

  return createServerClient<Database>(
    publicEnv.supabaseUrl,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
