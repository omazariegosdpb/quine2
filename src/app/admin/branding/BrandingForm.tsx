"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { updateBrandingAction, type BrandingState } from "./actions";

const INITIAL: BrandingState = { ok: false };

type Props = {
  companyName: string;
  logoUrl: string | null;
};

export function BrandingForm({ companyName, logoUrl }: Props) {
  const [state, action, pending] = useActionState(updateBrandingAction, INITIAL);
  const [preview, setPreview] = useState<string | null>(logoUrl);
  const [removeLogo, setRemoveLogo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.ok) {
      setRemoveLogo(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [state]);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) {
      setPreview(logoUrl);
      return;
    }
    setRemoveLogo(false);
    setPreview(URL.createObjectURL(f));
  }

  return (
    <form action={action} className="space-y-5">
      {state.message && (
        <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert>
      )}

      <Field
        label="Nombre de la empresa"
        name="companyName"
        defaultValue={companyName}
        maxLength={60}
        required
        hint="Aparece en el header y en la pantalla de inicio."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)] p-2">
          {removeLogo || !preview ? (
            <span className="text-center text-xs text-[var(--color-muted)]">
              Sin logo
            </span>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="Vista previa del logo"
              className="max-h-full max-w-full object-contain"
            />
          )}
        </div>

        <div className="flex-1 space-y-2">
          <label
            htmlFor="logo-input"
            className="block text-sm font-medium text-[var(--color-text)]"
          >
            Logo de la empresa
          </label>
          <input
            ref={fileRef}
            id="logo-input"
            name="logo"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={onFile}
            className="block w-full text-sm text-[var(--color-text-soft)] file:mr-3 file:rounded-md file:border-0 file:bg-[var(--color-primary)] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white file:transition-colors file:cursor-pointer hover:file:bg-[var(--color-primary-700)] active:file:bg-[var(--color-primary-800)]"
          />
          <p className="text-xs text-[var(--color-muted)]">
            PNG, JPG, WEBP o SVG · máx 2 MB · se mostrará en el navbar y la landing.
          </p>

          {logoUrl && (
            <label className="mt-2 inline-flex items-center gap-2 text-sm text-[var(--color-text-soft)]">
              <input
                type="checkbox"
                name="removeLogo"
                value="1"
                checked={removeLogo}
                onChange={(e) => {
                  setRemoveLogo(e.target.checked);
                  if (e.target.checked) {
                    if (fileRef.current) fileRef.current.value = "";
                    setPreview(null);
                  } else {
                    setPreview(logoUrl);
                  }
                }}
                className="h-4 w-4 accent-[var(--color-danger)]"
              />
              Quitar logo actual (volver al logo por defecto)
            </label>
          )}
        </div>
      </div>

      <div className="pt-2">
        <Button type="submit" isLoading={pending}>
          Guardar cambios
        </Button>
      </div>
    </form>
  );
}
