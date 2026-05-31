"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";

/**
 * Widget de Cloudflare Turnstile (CAPTCHA invisible/visual).
 *
 * Solo se renderiza si NEXT_PUBLIC_TURNSTILE_SITE_KEY está definido.
 * El token generado se envía como `cf-turnstile-response` en el form,
 * y el server action lo reenvía a Supabase como `options.captchaToken`.
 *
 * Setup:
 *   1. Crear un site key en https://dash.cloudflare.com → Turnstile (gratis).
 *   2. Activar CAPTCHA en Supabase: Project Settings → Auth → CAPTCHA → Turnstile.
 *   3. NEXT_PUBLIC_TURNSTILE_SITE_KEY (cliente) + TURNSTILE_SECRET_KEY (Supabase dashboard).
 *
 * Si las env vars no están, el widget no se monta y el flujo de login funciona normal.
 */
export function Turnstile() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!siteKey) return;
    let cancelled = false;

    function render() {
      if (cancelled) return;
      const w = window as unknown as {
        turnstile?: {
          render: (el: HTMLElement, opts: Record<string, unknown>) => string;
          remove: (id: string) => void;
        };
      };
      if (!w.turnstile || !containerRef.current) {
        setTimeout(render, 150);
        return;
      }
      widgetIdRef.current = w.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme: "light",
        size: "flexible",
      });
    }

    render();

    return () => {
      cancelled = true;
      const w = window as unknown as {
        turnstile?: { remove: (id: string) => void };
      };
      if (w.turnstile && widgetIdRef.current) {
        try {
          w.turnstile.remove(widgetIdRef.current);
        } catch {
          /* ignorar */
        }
      }
    };
  }, [siteKey]);

  if (!siteKey) return null;

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="afterInteractive"
        async
        defer
      />
      <div ref={containerRef} className="flex justify-center" />
    </>
  );
}
