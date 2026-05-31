"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type Tone = "success" | "danger" | "warning" | "info";

type ToastItem = {
  id: string;
  tone: Tone;
  title?: string;
  text: string;
  duration: number;
};

type ToastContextValue = {
  push: (t: { tone: Tone; title?: string; text: string; duration?: number }) => void;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((curr) => curr.filter((x) => x.id !== id));
  }, []);

  const push = useCallback<ToastContextValue["push"]>((t) => {
    const id = (typeof crypto !== "undefined" && "randomUUID" in crypto)
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
    const duration = t.duration ?? DEFAULT_DURATION;
    setItems((curr) => [...curr, { id, tone: t.tone, title: t.title, text: t.text, duration }]);
  }, []);

  const value = useMemo<ToastContextValue>(() => ({ push, dismiss }), [push, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastRenderer items={items} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback silencioso: en SSR o si falta el provider, no rompemos.
    return {
      success: () => {},
      error:   () => {},
      info:    () => {},
      warning: () => {},
      push:    () => {},
    };
  }
  return {
    success: (text: string, title?: string) => ctx.push({ tone: "success", title, text }),
    error:   (text: string, title?: string) => ctx.push({ tone: "danger",  title, text }),
    info:    (text: string, title?: string) => ctx.push({ tone: "info",    title, text }),
    warning: (text: string, title?: string) => ctx.push({ tone: "warning", title, text }),
    /** Para casos donde necesitás duración custom (ej. mostrar password 12s). */
    push:    ctx.push,
  };
}

// ============================================================================
// Renderer
// ============================================================================
function ToastRenderer({
  items, dismiss,
}: {
  items: ToastItem[];
  dismiss: (id: string) => void;
}) {
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 px-3 pb-3 sm:bottom-4 sm:right-4 sm:left-auto sm:items-end sm:px-0 sm:pb-0"
    >
      {items.map((t) => (
        <ToastCard key={t.id} item={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  );
}

const TONE_CLS: Record<Tone, { bar: string; icon: string; ring: string }> = {
  success: { bar: "bg-[var(--color-primary)]",  icon: "✓",  ring: "ring-[var(--color-primary-100)]" },
  danger:  { bar: "bg-[var(--color-danger)]",   icon: "!",  ring: "ring-[var(--color-danger-100)]" },
  warning: { bar: "bg-[var(--color-warning)]",  icon: "!",  ring: "ring-amber-200" },
  info:    { bar: "bg-[var(--color-info)]",     icon: "i",  ring: "ring-[var(--color-info-100)]" },
};

function ToastCard({
  item, onDismiss,
}: {
  item: ToastItem; onDismiss: () => void;
}) {
  const [leaving, setLeaving] = useState(false);
  const tone = TONE_CLS[item.tone];

  useEffect(() => {
    const t = setTimeout(() => {
      setLeaving(true);
      setTimeout(onDismiss, 180);
    }, item.duration);
    return () => clearTimeout(t);
  }, [item.duration, onDismiss]);

  return (
    <div
      role="status"
      className={[
        "pointer-events-auto w-full max-w-sm overflow-hidden rounded-lg bg-[var(--color-surface)] shadow-xl ring-1",
        tone.ring,
        leaving ? "animate-toast-out" : "animate-toast-in",
      ].join(" ")}
      style={{ animationDuration: "180ms", animationFillMode: "both" }}
    >
      <div className="flex items-stretch">
        <div className={["w-1.5 shrink-0", tone.bar].join(" ")} aria-hidden />
        <div className="flex flex-1 items-start gap-3 px-4 py-3">
          <span
            className={["mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white", tone.bar].join(" ")}
            aria-hidden
          >
            {tone.icon}
          </span>
          <div className="min-w-0 flex-1">
            {item.title && (
              <p className="text-sm font-semibold text-[var(--color-text)]">{item.title}</p>
            )}
            <p className={item.title ? "text-sm text-[var(--color-text-soft)]" : "text-sm text-[var(--color-text)]"}>
              {item.text}
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setLeaving(true); setTimeout(onDismiss, 180); }}
            aria-label="Cerrar"
            className="ml-2 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--color-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}
