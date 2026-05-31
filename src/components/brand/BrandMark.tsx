import { Logo } from "@/components/brand/Logo";
import type { BrandingInfo } from "@/lib/branding";

type Props = {
  branding: BrandingInfo;
  /** Mostrar el nombre como wordmark al lado del logo (oculto en pantallas chicas). */
  withWordmark?: boolean;
  /** Modo compacto (solo disco / logo cuadrado pequeño). */
  compact?: boolean;
  className?: string;
};

/**
 * Marca visible: si hay logo custom en `branding.logo_url` lo muestra; si no,
 * cae al Logo SVG oficial. Acompaña con el nombre de empresa cuando aplica.
 */
export function BrandMark({
  branding,
  withWordmark = true,
  compact = false,
  className = "",
}: Props) {
  const { logoUrl, companyName } = branding;
  const showWord = withWordmark && !compact;

  if (logoUrl) {
    return (
      <span className={["flex items-center gap-2", className].join(" ")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt={companyName}
          className={compact ? "h-9 w-9 object-contain" : "h-9 w-auto max-w-[140px] object-contain"}
        />
        {showWord && (
          <span className="hidden font-display text-base leading-none text-[var(--color-text)] sm:inline">
            {companyName}
          </span>
        )}
      </span>
    );
  }

  // Fallback: logo SVG oficial.
  return (
    <span className={["flex items-center", className].join(" ")}>
      {compact ? (
        <Logo className="h-9 w-9" compact />
      ) : (
        <Logo className="h-9 w-auto" withWordmark={showWord} />
      )}
    </span>
  );
}
