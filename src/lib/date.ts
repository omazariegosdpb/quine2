import { publicEnv } from "@/lib/env";

const TIMEZONE = publicEnv.appTimezone;

export function formatGT(
  date: Date | string,
  opts: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" },
): string {
  const d = typeof date === "string" ? new Date(date) : date;
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
