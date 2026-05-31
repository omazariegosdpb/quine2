import { InputHTMLAttributes, ReactNode, forwardRef } from "react";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
  startSlot?: ReactNode;
  endSlot?: ReactNode;
};

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, hint, error, startSlot, endSlot, id, className = "", ...props },
  ref,
) {
  const inputId = id ?? `field-${label.replace(/\s+/g, "-").toLowerCase()}`;
  const describedBy = error ? `${inputId}-err` : hint ? `${inputId}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={inputId}
        className="text-sm font-medium text-[var(--color-text)]"
      >
        {label}
      </label>
      <div
        className={[
          "flex items-center gap-2 rounded-md border bg-white px-3",
          error ? "border-[var(--color-danger)]" : "border-[var(--color-border)]",
          "focus-within:border-[var(--color-pitch-600)] focus-within:ring-2 focus-within:ring-[var(--color-pitch-100)]",
        ].join(" ")}
      >
        {startSlot}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={[
            "h-11 w-full bg-transparent text-base text-[var(--color-text)] placeholder-[var(--color-muted)] focus:outline-none",
            className,
          ].join(" ")}
          {...props}
        />
        {endSlot}
      </div>
      {error ? (
        <p id={`${inputId}-err`} className="text-xs text-[var(--color-danger)]">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-xs text-[var(--color-muted)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
