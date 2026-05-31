import { SVGProps } from "react";

type LogoProps = SVGProps<SVGSVGElement> & {
  withWordmark?: boolean;
  compact?: boolean;
};

/**
 * Logo Quiniela Mundial 2026.
 * Disco verde con un balón estilizado; arco tricolor inferior con los 3
 * colores oficiales (verde · azul Hermes · rojo Antorcha).
 *
 * `compact`: muestra solo el disco (64×64). Para headers en mobile.
 */
export function Logo({ withWordmark = true, compact = false, ...props }: LogoProps) {
  const showWordmark = withWordmark && !compact;
  const viewBox = compact ? "0 0 64 64" : "0 0 220 64";
  return (
    <svg
      viewBox={viewBox}
      role="img"
      aria-label="Quiniela Mundial 2026"
      {...props}
    >
      <defs>
        <radialGradient id="ballBg" cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor="#3CAC3B" />
          <stop offset="1" stopColor="#1F5A1E" />
        </radialGradient>
      </defs>

      {/* Disco */}
      <circle cx="32" cy="32" r="26" fill="url(#ballBg)" />

      {/* Pentágono central */}
      <polygon
        points="32,17 43,25 39,38 25,38 21,25"
        fill="#FFFFFF"
      />

      {/* Líneas hexagonales */}
      <path
        d="M32 17 L32 8
           M43 25 L51 22
           M39 38 L45 47
           M25 38 L19 47
           M21 25 L13 22"
        stroke="#FFFFFF"
        strokeWidth="2.2"
        strokeLinecap="round"
      />

      {/* Arco tricolor inferior — verde · azul Hermes · rojo Antorcha */}
      <path
        d="M9.5 41 A 24 24 0 0 0 23 56"
        stroke="#3CAC3B"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M23 56 A 24 24 0 0 0 41 56"
        stroke="#2A398D"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M41 56 A 24 24 0 0 0 54.5 41"
        stroke="#E61D25"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />

      {/* Estrella dorada superior */}
      <polygon
        points="49,14 50.2,17.4 53.8,17.4 50.8,19.5 52,22.8 49,20.8 46,22.8 47.2,19.5 44.2,17.4 47.8,17.4"
        fill="#D4A017"
      />

      {showWordmark && (
        <g>
          <text
            x="72"
            y="30"
            fill="#2A398D"
            fontFamily="var(--font-display), 'Bebas Neue', sans-serif"
            fontSize="22"
            letterSpacing="1.5"
          >
            QUINIELA
          </text>
          <text
            x="72"
            y="52"
            fontFamily="var(--font-display), 'Bebas Neue', sans-serif"
            fontSize="22"
            letterSpacing="1.5"
          >
            <tspan fill="#474A4A">MUNDIAL</tspan>
            <tspan fill="#E61D25"> 2026</tspan>
          </text>
        </g>
      )}
    </svg>
  );
}
