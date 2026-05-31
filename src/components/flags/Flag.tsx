import Image from "next/image";

/**
 * Convierte un código FIFA de 3 letras al código ISO de flagcdn.com.
 * Casos especiales: SCO/ENG/WAL/NIR son del Reino Unido.
 */
const FIFA_TO_FLAGCDN: Record<string, string> = {
  CZE: "cz",
  MEX: "mx",
  RSA: "za",
  KOR: "kr",
  BIH: "ba",
  CAN: "ca",
  QAT: "qa",
  SUI: "ch",
  BRA: "br",
  HAI: "ht",
  MAR: "ma",
  SCO: "gb-sct",
  AUS: "au",
  PAR: "py",
  TUR: "tr",
  USA: "us",
  CUW: "cw",
  ECU: "ec",
  GER: "de",
  CIV: "ci",
  JPN: "jp",
  NED: "nl",
  SWE: "se",
  TUN: "tn",
  BEL: "be",
  EGY: "eg",
  IRN: "ir",
  NZL: "nz",
  CPV: "cv",
  KSA: "sa",
  ESP: "es",
  URU: "uy",
  FRA: "fr",
  IRQ: "iq",
  NOR: "no",
  SEN: "sn",
  ALG: "dz",
  ARG: "ar",
  AUT: "at",
  JOR: "jo",
  COL: "co",
  COD: "cd",
  POR: "pt",
  UZB: "uz",
  CRO: "hr",
  ENG: "gb-eng",
  GHA: "gh",
  PAN: "pa",
};

type FlagProps = {
  fifa?: string | null;
  size?: number;
  className?: string;
  alt: string;
};

// flagcdn solo expone anchos discretos: 20, 40, 80, 160, 320, 640, 1280, 2560.
const VALID_WIDTHS = [20, 40, 80, 160, 320, 640, 1280, 2560];

function pickWidth(target: number): number {
  // Tomamos el ancho >= target * 2 (densidad retina), con tope 320.
  const desired = target * 2;
  for (const w of VALID_WIDTHS) if (w >= desired) return Math.min(w, 320);
  return 320;
}

export function Flag({ fifa, size = 32, className = "", alt }: FlagProps) {
  const code = fifa ? FIFA_TO_FLAGCDN[fifa] : null;
  if (!code) {
    return (
      <span
        aria-label={alt}
        title={alt}
        className={[
          "inline-flex shrink-0 items-center justify-center rounded-full bg-gray-200 text-[10px] font-bold uppercase text-gray-500 ring-1 ring-black/5",
          className,
        ].join(" ")}
        style={{ width: size, height: size }}
      >
        {fifa?.slice(0, 2) ?? "??"}
      </span>
    );
  }
  const w = pickWidth(size);
  return (
    <Image
      src={`https://flagcdn.com/w${w}/${code}.png`}
      alt={alt}
      width={size}
      height={size}
      className={["shrink-0 rounded-full object-cover shadow-sm ring-1 ring-black/5", className].join(" ")}
      unoptimized
    />
  );
}
