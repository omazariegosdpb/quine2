import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Rate limiting basado en Upstash Redis (free tier: 10K requests/día).
 *
 * Si UPSTASH_REDIS_REST_URL o UPSTASH_REDIS_REST_TOKEN no están configurados,
 * el módulo entra en modo no-op: todas las llamadas retornan { success: true }.
 * Esto permite levantar la app sin Upstash en desarrollo local.
 *
 * Calibración para una quiniela de máximo ~200 usuarios:
 *
 *   loginRateLimit (anónimo, por IP):
 *     10 intentos / 5 minutos.
 *     Suficientes para un usuario que se equivoca de password un par de veces,
 *     pero corta brute force a credenciales antes de las primeras 50 pruebas.
 *
 *   predictionsRateLimit (autenticado, por user_id):
 *     60 escrituras / minuto.
 *     Cada usuario puede guardar hasta 1 pronóstico por segundo. La UI hace
 *     debounce, así que esto solo se activa si alguien automatiza llamadas.
 *
 *   adminRateLimit (autenticado, por user_id):
 *     120 acciones / minuto.
 *     Cubre carga rápida de resultados sin frenar al admin legítimo.
 */

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;
const enabled = !!url && !!token;

let redis: Redis | null = null;
if (enabled) {
  redis = new Redis({ url: url!, token: token! });
}

export type RateLimitResult = {
  success: boolean;
  /** Segundos hasta que se libere la siguiente ventana (0 si no aplica). */
  retryAfter: number;
  limit: number;
  remaining: number;
};

function noop(limit: number): RateLimitResult {
  return { success: true, retryAfter: 0, limit, remaining: limit };
}

function makeLimiter(prefix: string, tokens: number, window: `${number} ${"s" | "m" | "h" | "d"}`) {
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(tokens, window),
    prefix,
    analytics: false,
  });
}

const loginLimiter = makeLimiter("rl:login", 10, "5 m");
const predictionsLimiter = makeLimiter("rl:predictions", 60, "1 m");
const adminLimiter = makeLimiter("rl:admin", 120, "1 m");

async function applyLimiter(
  limiter: Ratelimit | null,
  identifier: string,
  defaultLimit: number,
): Promise<RateLimitResult> {
  if (!limiter) return noop(defaultLimit);
  const r = await limiter.limit(identifier);
  return {
    success: r.success,
    retryAfter: Math.max(0, Math.ceil((r.reset - Date.now()) / 1000)),
    limit: r.limit,
    remaining: r.remaining,
  };
}

export function loginRateLimit(ip: string) {
  return applyLimiter(loginLimiter, `ip:${ip || "unknown"}`, 10);
}

export function predictionsRateLimit(userId: string) {
  return applyLimiter(predictionsLimiter, `user:${userId}`, 60);
}

export function adminRateLimit(userId: string) {
  return applyLimiter(adminLimiter, `user:${userId}`, 120);
}

export const rateLimitEnabled = enabled;
