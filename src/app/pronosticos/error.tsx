"use client"; // Los error boundaries deben ser Client Components.

import { useEffect } from "react";

/**
 * Captura cualquier excepción al renderizar /pronosticos (p. ej. el fallo
 * intermitente al abrir una ronda recién creada). En vez de un 500 crudo:
 *  - muestra una tarjeta amigable con botón "Reintentar",
 *  - registra el error + digest en consola/logs para poder diagnosticarlo.
 *
 * El `digest` es el identificador que también aparece en los logs de funciones
 * de Vercel: sirve para cruzar este error con el stack real del servidor.
 */
export default function PronosticosError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[pronosticos] render error", {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-danger-50)] text-2xl">
          ⚠️
        </div>
        <h1 className="font-display text-2xl text-[var(--color-text)]">
          No pudimos cargar los pronósticos
        </h1>
        <p className="mt-2 text-sm text-[var(--color-text-soft)]">
          Fue un problema temporal al cargar esta ronda. Volvé a intentar; casi
          siempre se resuelve al reintentar.
        </p>

        {error.digest && (
          <p className="mt-3 text-xs text-[var(--color-muted)]">
            Código de referencia:{" "}
            <code className="rounded bg-[var(--color-bg)] px-1.5 py-0.5">{error.digest}</code>
          </p>
        )}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[var(--color-primary-700)] active:bg-[var(--color-primary-800)]"
          >
            Reintentar
          </button>
          <a
            href="/pronosticos"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--color-text-soft)] transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
          >
            Ir a la ronda actual
          </a>
        </div>
      </div>
    </main>
  );
}
