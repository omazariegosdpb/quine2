"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type Tone = "danger" | "warning" | "info";

type ConfirmOpts = {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: Tone;
};

type ConfirmContextValue = {
  confirm: (opts: ConfirmOpts) => Promise<boolean>;
};

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

type State = ConfirmOpts & { open: boolean; resolve?: (v: boolean) => void };

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ open: false, title: "" });

  const confirm = useCallback<ConfirmContextValue["confirm"]>((opts) => {
    return new Promise<boolean>((resolve) => {
      setState({ ...opts, open: true, resolve });
    });
  }, []);

  const close = useCallback((ok: boolean) => {
    state.resolve?.(ok);
    setState({ open: false, title: "" });
  }, [state]);

  // Cerrar con ESC
  useEffect(() => {
    if (!state.open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close(false);
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [state.open, close]);

  const value = useMemo<ConfirmContextValue>(() => ({ confirm }), [confirm]);

  const tone: Tone = state.tone ?? "danger";
  const toneCfg = TONE[tone];

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {state.open && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
        >
          <div
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
            onClick={() => close(false)}
            aria-hidden
          />
          <div className="relative w-full max-w-md overflow-hidden rounded-xl bg-[var(--color-surface)] shadow-2xl ring-1 ring-black/5">
            <div className={["h-1", toneCfg.bar].join(" ")} aria-hidden />
            <div className="p-5">
              <div className="flex items-start gap-3">
                <span
                  className={["mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white", toneCfg.bar].join(" ")}
                  aria-hidden
                >
                  {toneCfg.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 id="confirm-title" className="font-display text-xl text-[var(--color-text)]">
                    {state.title}
                  </h2>
                  {state.description && (
                    <p className="mt-1 text-sm text-[var(--color-text-soft)]">{state.description}</p>
                  )}
                </div>
              </div>
              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => close(false)}
                  className="inline-flex h-11 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-5 text-sm font-semibold text-[var(--color-text)] hover:bg-[var(--color-bg)]"
                >
                  {state.cancelLabel ?? "Cancelar"}
                </button>
                <button
                  type="button"
                  autoFocus
                  onClick={() => close(true)}
                  className={["inline-flex h-11 items-center justify-center rounded-md px-5 text-sm font-semibold text-white shadow-sm", toneCfg.button].join(" ")}
                >
                  {state.confirmLabel ?? "Confirmar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    // Fallback al confirm nativo si falta el provider, para no romper.
    return async (opts: ConfirmOpts) => {
      const msg = `${opts.title}${opts.description ? `\n\n${opts.description}` : ""}`;
      return typeof window !== "undefined" ? window.confirm(msg) : false;
    };
  }
  return ctx.confirm;
}

const TONE: Record<Tone, { bar: string; button: string; icon: string }> = {
  danger:  { bar: "bg-[var(--color-danger)]",   button: "bg-[var(--color-danger)] hover:bg-[var(--color-danger-600)]",   icon: "!" },
  warning: { bar: "bg-[var(--color-warning)]",  button: "bg-[var(--color-warning)] hover:opacity-90",                    icon: "!" },
  info:    { bar: "bg-[var(--color-info)]",     button: "bg-[var(--color-info)] hover:bg-[var(--color-info-700)]",       icon: "?" },
};
