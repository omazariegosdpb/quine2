import { publicEnv } from "@/lib/env";

const TIMEZONE = publicEnv.appTimezone;

export function formatGT(
  date: Date | string,
  opts: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" },
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  // Intl.DateTimeFormat con dateStyle/timeStyle lanza RangeError si la fecha es
  // inválida; devolvemos un placeholder y dejamos rastro en vez de tumbar la página.
  if (Number.isNaN(d.getTime())) {
    console.warn("[formatGT] fecha inválida:", date);
    return "—";
  }
  return new Intl.DateTimeFormat("es-GT", {
    timeZone: TIMEZONE,
    ...opts,
  }).format(d);
}

export function daysUntil(target: Date): number {
  const ms = target.getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function gtNow(): Date {
  return new Date();
}
