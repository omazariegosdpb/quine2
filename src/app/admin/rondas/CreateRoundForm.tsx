"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createRoundAction, type RoundActionState } from "@/app/admin/rondas/actions";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

const INITIAL: RoundActionState = { ok: false };

export function CreateRoundForm({ defaultCloseLocal }: { defaultCloseLocal: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createRoundAction, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setOpen(false);
    }
  }, [state]);

  if (!open) {
    return (
      <Button type="button" variant="info" onClick={() => setOpen(true)}>
        + Nueva ronda
      </Button>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--color-info-100)] bg-[var(--color-info-50)] p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-lg text-[var(--color-info-800)]">Nueva ronda</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-[var(--color-info-700)] underline"
        >
          Cancelar
        </button>
      </div>

      {state.message && (
        <div className="mb-3">
          <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert>
        </div>
      )}

      <form ref={formRef} action={action} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field
          label="Código"
          name="code"
          placeholder="R16, QF, SF, FINAL, ..."
          required
          hint="Solo mayúsculas, números y _ (identifica la ronda en URLs)"
        />
        <Field
          label="Nombre visible"
          name="name"
          placeholder="Octavos de Final"
          required
        />
        <div className="sm:col-span-2">
          <Field
            label="Cierre de pronósticos (hora Guatemala)"
            name="closesAtLocal"
            type="datetime-local"
            defaultValue={defaultCloseLocal}
            required
          />
        </div>
        <div className="sm:col-span-2">
          <Field
            label="Grupo de ranking (opcional)"
            name="rankingGroup"
            placeholder="Ej.: ELIMINATORIAS"
            hint="Para amarrar esta ronda con otras en un ranking aparte. Vacío = solo cuenta en el ranking general."
          />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" isLoading={pending}>Crear ronda</Button>
        </div>
      </form>
    </div>
  );
}
