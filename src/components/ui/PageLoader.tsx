type Props = {
  /** Texto debajo del balón. Default: "Cargando…" */
  label?: string;
  /**
   * Si está activo, ocupa toda la pantalla con velo blanco.
   * Si no, se muestra en bloque (útil para `loading.tsx` que vive dentro del layout).
   */
  fullscreen?: boolean;
};

/**
 * PageLoader "mundialista":
 *  - Balón rebotando con rotación.
 *  - Sombra dinámica que se achica al subir.
 *  - Barra tricolor con shimmer (verde · azul · rojo) corriendo debajo.
 *  - Texto "Cargando…" con pulso suave.
 *
 * Sin estado, sin JS — pura CSS. Respeta `prefers-reduced-motion`.
 */
export function PageLoader({ label = "Cargando…", fullscreen = false }: Props) {
  const containerCls = fullscreen
    ? "fixed inset-0 z-[60] flex items-center justify-center bg-white/85 backdrop-blur-sm animate-veil-fade-in"
    : "flex min-h-[40vh] items-center justify-center py-12";

  return (
    <div className={containerCls} role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-5">
        <SoccerBall />

        <div className="h-1.5 w-40 overflow-hidden rounded-full bg-[var(--color-stone-100)]">
          <div className="h-full w-full bg-tricolor-shimmer" />
        </div>

        <p className="animate-label-pulse font-display text-sm uppercase tracking-[0.3em] text-[var(--color-text-soft)]">
          {label}
        </p>
      </div>
    </div>
  );
}

function SoccerBall() {
  return (
    <div className="relative h-20 w-20">
      {/* Sombra en el piso */}
      <span
        aria-hidden
        className="animate-ball-shadow absolute bottom-0 left-1/2 -ml-6 h-1.5 w-12 rounded-full bg-black/35 blur-[2px]"
      />
      {/* Balón */}
      <svg
        aria-hidden
        viewBox="0 0 64 64"
        className="animate-ball-bounce absolute bottom-2 left-1/2 -ml-7 h-14 w-14"
      >
        <defs>
          <radialGradient id="loaderBall" cx="35%" cy="30%" r="80%">
            <stop offset="0" stopColor="#FFFFFF" />
            <stop offset="1" stopColor="#E5E7E5" />
          </radialGradient>
        </defs>

        <circle cx="32" cy="32" r="28" fill="url(#loaderBall)" stroke="#0F0F0F" strokeWidth="2" />

        {/* Pentágono central */}
        <polygon points="32,17 43,25 39,38 25,38 21,25" fill="#0F0F0F" />

        {/* Líneas hexagonales */}
        <path
          d="M32 17 L32 6
             M43 25 L54 21
             M39 38 L46 49
             M25 38 L18 49
             M21 25 L10 21"
          stroke="#0F0F0F"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </svg>
      <span className="sr-only">Cargando</span>
    </div>
  );
}
