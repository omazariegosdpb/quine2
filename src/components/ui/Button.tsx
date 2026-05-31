import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "info" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
  fullWidth?: boolean;
};

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-[var(--color-primary)] text-white shadow-sm hover:bg-[var(--color-primary-700)] hover:shadow-md focus-visible:ring-[var(--color-primary)] active:bg-[var(--color-primary-800)] active:shadow-inner",
  secondary:
    "bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] shadow-sm hover:bg-[var(--color-bg)] hover:shadow-md focus-visible:ring-[var(--color-primary)] active:bg-[var(--color-stone-200)] active:shadow-inner",
  info:
    "bg-[var(--color-info)] text-white shadow-sm hover:bg-[var(--color-info-700)] hover:shadow-md focus-visible:ring-[var(--color-info)] active:bg-[var(--color-info-800)] active:shadow-inner",
  ghost:
    "bg-transparent text-[var(--color-text-soft)] hover:bg-black/5 focus-visible:ring-[var(--color-primary)] active:bg-black/10",
  danger:
    "bg-[var(--color-danger)] text-white shadow-sm hover:bg-[var(--color-danger-600)] hover:shadow-md focus-visible:ring-[var(--color-danger)] active:bg-[var(--color-danger-700)] active:shadow-inner",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", fullWidth, isLoading, className = "", children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || isLoading}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-md font-semibold select-none",
        "transition-[transform,background-color,box-shadow,filter] duration-150 ease-out",
        "active:scale-[0.97] active:duration-75",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100 disabled:hover:shadow-sm",
        variantClasses[variant],
        sizeClasses[size],
        fullWidth ? "w-full" : "",
        className,
      ].join(" ")}
      {...props}
    >
      {isLoading && (
        <span
          aria-hidden
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
        />
      )}
      {children}
    </button>
  );
});
