import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Host de Supabase (para CSP). Si la env var falta, caemos a wildcard.
const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").host;
  } catch {
    return "*.supabase.co";
  }
})();

// CSP "sin nonces" (next.config.ts headers()): no rompe SSR estático.
// Mantenemos 'unsafe-inline' en script/style por compatibilidad con Next y Tailwind v4;
// el resto de la política sigue dura (frame-ancestors none, object-src none, etc.).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://challenges.cloudflare.com`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' blob: data: https://flagcdn.com https://${supabaseHost}`,
  "font-src 'self' data:",
  `connect-src 'self' https://${supabaseHost} wss://${supabaseHost} https://challenges.cloudflare.com`,
  "frame-src https://challenges.cloudflare.com",
  "media-src 'self'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "flagcdn.com" },
    ],
  },
  experimental: {
    serverActions: {
      // Next valida origin == host por default; subimos un poco el body limit
      // para subida de comprobantes de pago. 1mb es el default — 2mb da margen.
      bodySizeLimit: "2mb",
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
