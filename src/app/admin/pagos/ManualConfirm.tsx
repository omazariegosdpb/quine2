"use client";

import { useActionState } from "react";
import { confirmWithoutReceipt, type State } from "@/app/admin/pagos/actions";

const INITIAL: State = { ok: false };

type Player = { id: string; name: string; email: string; status: string };

export function ManualConfirm({ players }: { players: Player[] }) {
  const [state, action, pending] = useActionState(confirmWithoutReceipt, INITIAL);

  if (players.length === 0) {
    return (
      <div className="px-5 py-6 text-sm text-[var(--color-text-soft)]">
        Todos los jugadores activos ya están confirmados.
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-end">
      <label className="flex flex-1 flex-col gap-1 text-xs font-semibold text-[var(--color-text-soft)]">
        Jugador
        <select
          name="userId"
          defaultValue=""
          required
          className="h-9 rounded-md border border-[var(--color-border)] bg-white px-2 text-sm"
        >
          <option value="" disabled>
            Selecciona un jugador…
          </option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {p.email} ({p.status})
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--color-text-soft)] sm:w-56">
        Notas (opc.)
        <input
          type="text"
          name="notes"
          placeholder="Pagó en efectivo…"
          className="h-9 rounded-md border border-[var(--color-border)] bg-white px-2 text-sm"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="h-9 shrink-0 rounded-md bg-[var(--color-primary)] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-primary-700)] disabled:opacity-50"
      >
        {pending ? "Confirmando…" : "Confirmar sin comprobante"}
      </button>

      {state.message && (
        <span
          className={
            state.ok
              ? "self-center text-xs text-[var(--color-success)]"
              : "self-center text-xs text-[var(--color-danger)]"
          }
        >
          {state.message}
        </span>
      )}
    </form>
  );
}
