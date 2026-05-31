import { z } from "zod";

const ServerEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
  APP_TIMEZONE: z.string().default("America/Guatemala"),
  APP_NAME: z.string().default("Quiniela Mundial 2026"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  CRON_SECRET: z.string().min(16).optional(),
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

let cached: ServerEnv | null = null;

export function serverEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = ServerEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const errs = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Variables de entorno inválidas:\n${errs}`);
  }
  cached = parsed.data;
  return cached;
}

export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  appName: process.env.APP_NAME ?? "Quiniela Mundial 2026",
  appTimezone: process.env.APP_TIMEZONE ?? "America/Guatemala",
};
