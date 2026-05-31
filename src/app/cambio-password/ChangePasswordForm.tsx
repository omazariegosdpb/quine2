"use client";

import { useActionState } from "react";
import { changePasswordAction, type ChangePasswordState } from "@/app/cambio-password/actions";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

const INITIAL: ChangePasswordState = { ok: false };

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, INITIAL);

  return (
    <form action={action} className="flex flex-col gap-4">
      {state.message && (
        <Alert tone="danger" title="No se pudo cambiar la contraseña">
          {state.message}
        </Alert>
      )}

      <Field
        label="Nueva contraseña"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint="Mínimo 12 caracteres con mayúscula, minúscula y un número."
      />
      <Field
        label="Repetí la contraseña"
        name="passwordConfirm"
        type="password"
        autoComplete="new-password"
        required
      />

      <Button type="submit" isLoading={pending} fullWidth size="lg">
        Guardar y continuar
      </Button>
    </form>
  );
}
