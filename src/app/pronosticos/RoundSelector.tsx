"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

type Option = {
  code: string;
  name: string;
  is_locked: boolean;
};

export function RoundSelector({
  options,
  current,
}: {
  options: Option[];
  current: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function change(code: string) {
    const next = new URLSearchParams(sp);
    next.set("round", code);
    router.push(`${pathname}?${next.toString()}`);
  }

  if (options.length <= 1) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
        Ronda
      </span>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => {
          const active = o.code === current;
          return (
            <button
              key={o.code}
              type="button"
              onClick={() => change(o.code)}
              aria-pressed={active}
              className={[
                "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                active
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                  : "border-[var(--color-border)] bg-white text-[var(--color-text-soft)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]",
              ].join(" ")}
            >
              {o.name}
              {o.is_locked && (
                <span className={["ml-1 text-[10px]", active ? "text-white/80" : "text-[var(--color-muted)]"].join(" ")}>
                  · sellada
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
