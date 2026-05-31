"use client";

import { useActionState, useState } from "react";
import { reviewPayment, type State } from "@/app/admin/pagos/actions";

const INITIAL: State = { ok: false };

type Props = {
  payment: {
    id: string;
    userName: string;
    userEmail: string;
    amount: number;
    status: string;
    receiptUrl: string | null;
    createdAt: string;
  };
};

export function PaymentRow({ payment }: Props) {
  const [state, action, pending] = useActionState(reviewPayment, INITIAL);
  const [decision, setDecision] = useState<"confirm" | "reject" | "refund">("confirm");

  return (
    <tr className={state.ok ? "bg-emerald-50/40" : ""}>
      <td className="px-3 py-2">
        <p className="text-sm font-semibold">{payment.userName}</p>
        <p className="text-xs text-[var(--color-muted)]">{payment.userEmail}</p>
      </td>
      <td className="px-3 py-2 text-sm">Q{payment.amount.toFixed(2)}</td>
      <td className="px-3 py-2">
        {payment.receiptUrl ? (
          <a
            href={payment.receiptUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-semibold text-[var(--color-pitch-700)] underline"
          >
            Ver comprobante
          </a>
        ) : (
          <span className="text-xs text-[var(--color-muted)]">Sin comprobante</span>
        )}
      </td>
      <td className="px-3 py-2 text-xs">
        <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">
          {payment.status}
        </span>
      </td>
      <td className="px-3 py-2">
        <form action={action} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="paymentId" value={payment.id} />
          <select
            name="decision"
            value={decision}
            onChange={(e) => setDecision(e.target.value as never)}
            className="h-8 rounded-md border border-[var(--color-border)] bg-white px-2 text-xs"
          >
            <option value="confirm">Confirmar</option>
            <option value="reject">Rechazar</option>
            <option value="refund">Reembolsar</option>
          </select>
          <input
            type="text"
            name="notes"
            placeholder="Notas (opc.)"
            className="h-8 w-28 rounded-md border border-[var(--color-border)] bg-white px-2 text-xs"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-[var(--color-pitch-600)] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[var(--color-pitch-700)] disabled:opacity-50"
          >
            {pending ? "…" : "Aplicar"}
          </button>
          {state.message && (
            <span className={state.ok ? "text-xs text-[var(--color-success)]" : "text-xs text-[var(--color-danger)]"}>
              {state.message}
            </span>
          )}
        </form>
      </td>
    </tr>
  );
}
