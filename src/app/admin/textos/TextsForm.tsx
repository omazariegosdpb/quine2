"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { updateTextsAction, type TextsState } from "./actions";

const INITIAL: TextsState = { ok: false };

const MAX_ITEMS = 12;
const MAX_LEN = 280;

type Props = {
  initialQuickRules: string[];
  initialPaymentSteps: string[];
};

export function TextsForm({ initialQuickRules, initialPaymentSteps }: Props) {
  const [state, action, pending] = useActionState(updateTextsAction, INITIAL);
  const [quickRules, setQuickRules] = useState<string[]>(initialQuickRules);
  const [paymentSteps, setPaymentSteps] = useState<string[]>(initialPaymentSteps);

  // Si el server confirma, re-sincronizamos al estado guardado (defaults sanitizados).
  useEffect(() => {
    if (state.ok && state.saved) {
      setQuickRules(state.saved.quickRules);
      setPaymentSteps(state.saved.paymentSteps);
    }
  }, [state]);

  return (
    <form action={action} className="space-y-7">
      {state.message && (
        <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert>
      )}

      <ListEditor
        title="Reglas rápidas"
        hint="Aparecen como bullets en el panel principal. Hasta 12 ítems."
        items={quickRules}
        onChange={setQuickRules}
        fieldName="quick_rules"
        emptyLabel="Agregá tu primera regla."
        bullet="•"
      />

      <ListEditor
        title="Cómo pagar"
        hint="Aparecen como pasos numerados en /pago. Hasta 12 pasos."
        items={paymentSteps}
        onChange={setPaymentSteps}
        fieldName="payment_steps"
        emptyLabel="Agregá tu primer paso."
        ordered
      />

      <div className="pt-2">
        <Button type="submit" isLoading={pending}>
          Guardar cambios
        </Button>
      </div>
    </form>
  );
}

function ListEditor({
  title,
  hint,
  items,
  onChange,
  fieldName,
  emptyLabel,
  bullet,
  ordered,
}: {
  title: string;
  hint: string;
  items: string[];
  onChange: (next: string[]) => void;
  fieldName: string;
  emptyLabel: string;
  bullet?: string;
  ordered?: boolean;
}) {
  function update(i: number, val: string) {
    const next = items.slice();
    next[i] = val;
    onChange(next);
  }
  function remove(i: number) {
    onChange(items.filter((_, idx) => idx !== i));
  }
  function add() {
    if (items.length >= MAX_ITEMS) return;
    onChange([...items, ""]);
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = items.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  return (
    <fieldset className="space-y-3">
      <div>
        <legend className="text-sm font-semibold text-[var(--color-text)]">
          {title}
        </legend>
        <p className="text-xs text-[var(--color-muted)]">{hint}</p>
      </div>

      {/* Inputs ocultos para enviar la lista al server action */}
      {items.map((val, i) => (
        <input key={`hidden-${i}`} type="hidden" name={fieldName} value={val} />
      ))}

      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-4 text-center text-sm text-[var(--color-muted)]">
          {emptyLabel}
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((val, i) => (
            <li
              key={i}
              className="flex items-start gap-2 rounded-md border border-[var(--color-border)] bg-white p-2"
            >
              <span className="mt-2.5 inline-flex h-6 w-7 shrink-0 items-center justify-center rounded text-xs font-bold text-[var(--color-muted)]">
                {ordered ? `${i + 1}.` : (bullet ?? "•")}
              </span>
              <textarea
                value={val}
                onChange={(e) => update(i, e.target.value)}
                rows={2}
                maxLength={MAX_LEN}
                placeholder={ordered ? `Paso ${i + 1}` : "Regla…"}
                className="min-h-[44px] flex-1 resize-y rounded-md border border-transparent bg-[var(--color-surface-2)] px-2 py-1.5 text-sm text-[var(--color-text)] placeholder-[var(--color-muted)] focus:border-[var(--color-pitch-600)] focus:outline-none focus:ring-2 focus:ring-[var(--color-pitch-100)]"
              />
              <div className="flex shrink-0 flex-col gap-1">
                <IconBtn
                  label="Mover arriba"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                >
                  ↑
                </IconBtn>
                <IconBtn
                  label="Mover abajo"
                  onClick={() => move(i, 1)}
                  disabled={i === items.length - 1}
                >
                  ↓
                </IconBtn>
                <IconBtn
                  label="Eliminar"
                  onClick={() => remove(i)}
                  tone="danger"
                >
                  ✕
                </IconBtn>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={add}
        disabled={items.length >= MAX_ITEMS}
      >
        + Agregar {ordered ? "paso" : "regla"}
      </Button>
    </fieldset>
  );
}

function IconBtn({
  children,
  onClick,
  disabled,
  label,
  tone,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
  tone?: "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={[
        "flex h-7 w-7 items-center justify-center rounded border text-xs font-bold transition-colors",
        tone === "danger"
          ? "border-[var(--color-danger-100)] bg-white text-[var(--color-danger)] hover:bg-[var(--color-danger-50)]"
          : "border-[var(--color-border)] bg-white text-[var(--color-text-soft)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]",
        "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-current",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
