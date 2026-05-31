"use client";

import { useActionState, useState, useRef, useEffect } from "react";
import { createUserAction, type ActionState } from "@/app/admin/usuarios/actions";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

const INITIAL: ActionState = { ok: false };

export function CreateUserForm() {
  const [state, action, pending] = useActionState(createUserAction, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);
  const [tempPassword, setTempPassword] = useState<string>(() => generatePwd());

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setTempPassword(generatePwd());
    }
  }, [state]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-3">
      {state.message && (
        <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert>
      )}
      <Field
        label="Nombre completo"
        name="full_name"
        required
        placeholder="Juan Pérez García"
      />
      <Field
        label="Apodo (visible en ranking)"
        name="display_name"
        required
        placeholder="Juan P."
      />
      <Field
        label="Correo"
        name="email"
        type="email"
        required
        placeholder="juan@correo.com"
      />
      <Field
        label="Contraseña temporal"
        name="password"
        defaultValue={tempPassword}
        required
        hint="El usuario la cambiará en su primer login. Compartila por canal seguro."
      />
      <Button type="submit" isLoading={pending} size="lg">
        Crear usuario
      </Button>
    </form>
  );
}

function generatePwd(): string {
  const u = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const l = "abcdefghijkmnpqrstuvwxyz";
  const d = "23456789";
  const all = u + l + d;
  let s = u[Math.floor(Math.random() * u.length)]
        + l[Math.floor(Math.random() * l.length)]
        + d[Math.floor(Math.random() * d.length)];
  for (let i = 0; i < 11; i++) s += all[Math.floor(Math.random() * all.length)];
  return s;
}
