import { ReactNode } from "react";

type AlertProps = {
  tone?: "info" | "success" | "warning" | "danger";
  title?: string;
  children: ReactNode;
};

const toneClasses = {
  info:    "bg-blue-50  border-blue-200  text-blue-900",
  success: "bg-emerald-50 border-emerald-200 text-emerald-900",
  warning: "bg-amber-50 border-amber-200 text-amber-900",
  danger:  "bg-red-50  border-red-200   text-red-900",
};

export function Alert({ tone = "info", title, children }: AlertProps) {
  return (
    <div
      role="status"
      className={["rounded-md border px-4 py-3 text-sm", toneClasses[tone]].join(" ")}
    >
      {title && <p className="mb-1 font-semibold">{title}</p>}
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}
