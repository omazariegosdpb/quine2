import Link from "next/link";

export type StatTone = "green" | "blue" | "red" | "gold" | "neutral";

const TONES: Record<StatTone, { bar: string; bigText: string; btn: string }> = {
  green:   { bar: "bg-[var(--color-primary)]",   bigText: "text-[var(--color-primary-700)]", btn: "bg-[var(--color-primary)] hover:bg-[var(--color-primary-700)]" },
  blue:    { bar: "bg-[var(--color-info)]",      bigText: "text-[var(--color-info)]",        btn: "bg-[var(--color-info)] hover:bg-[var(--color-info-700)]" },
  red:     { bar: "bg-[var(--color-danger)]",    bigText: "text-[var(--color-danger)]",      btn: "bg-[var(--color-danger)] hover:bg-[var(--color-danger-600)]" },
  gold:    { bar: "bg-[var(--color-gold-500)]",  bigText: "text-[var(--color-gold-700)]",    btn: "bg-[var(--color-gold-500)] hover:bg-[var(--color-gold-600)]" },
  neutral: { bar: "bg-[var(--color-stone-200)]", bigText: "text-[var(--color-text-soft)]",   btn: "bg-[var(--color-text-soft)] hover:opacity-90" },
};

export function StatCard({
  tone,
  title,
  big,
  sub,
  cta,
}: {
  tone: StatTone;
  title: string;
  big: string;
  sub?: string;
  cta?: { href: string; label: string };
}) {
  const t = TONES[tone];
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
      <div className={`h-1 ${t.bar}`} aria-hidden />
      <div className="flex flex-col items-center p-5 text-center">
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-muted)]">
          {title}
        </p>
        <p className={`mt-2 font-display text-3xl ${t.bigText}`}>{big}</p>
        {sub && <p className="mt-1 text-sm text-[var(--color-text-soft)]">{sub}</p>}
        {cta && (
          <Link
            href={cta.href}
            className={`mt-4 inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-semibold text-white shadow-sm transition-all duration-150 ease-out hover:opacity-90 hover:shadow-md active:scale-[0.97] active:shadow-inner active:brightness-95 ${t.btn}`}
          >
            {cta.label}
          </Link>
        )}
      </div>
    </div>
  );
}
