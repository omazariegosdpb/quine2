"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { loginAction, type LoginState } from "@/app/login/actions";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Turnstile } from "@/components/auth/Turnstile";

const INITIAL: LoginState = { ok: false };

export function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? undefined;
  const inactive = params.get("inactive") === "1";

  const [state, action, pending] = useActionState(loginAction, INITIAL);

  return (
    <form action={action} className="flex flex-col gap-4">
      {inactive && (
        <Alert tone="warning" title="Sesión cerrada">
          Tu cuenta está inactiva. Si es un error, contactá al organizador.
        </Alert>
      )}
      {state.message && (
        <Alert tone="danger" title="No pudimos iniciar sesión">
          {state.message}
        </Alert>
      )}

      <Field
        label="Correo"
        name="email"
        type="email"
        autoComplete="email"
        required
        placeholder="tunombre@correo.com"
      />
      <Field
        label="Contraseña"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />

      {next && <input type="hidden" name="next" value={next} />}

      <Turnstile />

      <Button type="submit" isLoading={pending} fullWidth size="lg">
        Iniciar sesión
      </Button>

      <p className="text-center text-xs text-[var(--color-muted)]">
        ¿Olvidaste tu contraseña? Pedile al organizador que la reinicie.
      </p>
    </form>
  );
}
