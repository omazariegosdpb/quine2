"use client";

import { useState, useTransition } from "react";
import { Flag } from "@/components/flags/Flag";
import { setMatchResult, clearMatchResult } from "@/app/admin/resultados/actions";
import { formatGT } from "@/lib/date";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";

type Row = {
  id: number;
  group: string;
  kickoffAt: string;
  home: { name: string; iso: string | null };
  away: { name: string; iso: string | null };
  homeScore: number | null;
  awayScore: number | null;
  status: "scheduled" | "live" | "finished" | "cancelled";
};

export function ResultRow({ row }: { row: Row }) {
  const [h, setH] = useState<string>(row.homeScore !== null ? String(row.homeScore) : "");
  const [a, setA] = useState<string>(row.awayScore !== null ? String(row.awayScore) : "");
  const [pending, startTransition] = useTransition();
  const finished = row.status === "finished";
  const toast = useToast();
  const confirm = useConfirm();

  function save() {
    const hn = Number(h);
    const an = Number(a);
    if (!Number.isInteger(hn) || !Number.isInteger(an) || hn < 0 || an < 0 || hn > 30 || an > 30) {
      toast.error("Ingresá un marcador válido (0–30).", "Marcador inválido");
      return;
    }
    startTransition(async () => {
      const r = await setMatchResult({ matchId: row.id, homeScore: hn, awayScore: an });
      if (r.ok) toast.success(`Partido #${row.id}: ${hn} – ${an}`, "Resultado guardado");
      else toast.error((r as { message: string }).message, "Error");
    });
  }

  async function clear() {
    const ok = await confirm({
      title: `Borrar resultado del partido #${row.id}`,
      description: `Esto revierte ${row.home.name} ${row.homeScore} – ${row.awayScore} ${row.away.name} a "programado" y los puntos calculados se ajustan.`,
      confirmLabel: "Borrar resultado",
      tone: "warning",
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await clearMatchResult(row.id);
      if (r.ok) {
        setH("");
        setA("");
        toast.success(`Resultado del partido #${row.id} borrado.`);
      } else {
        toast.error((r as { message: string }).message, "Error");
      }
    });
  }

  return (
    <tr className={finished ? "bg-[var(--color-info-50)]/60" : ""}>
      <td className="px-3 py-2 text-xs text-[var(--color-muted)] whitespace-nowrap">
        #{row.id} · {row.group}
      </td>
      <td className="px-3 py-2 text-xs text-[var(--color-muted)] whitespace-nowrap">
        {formatGT(row.kickoffAt, { dateStyle: "short", timeStyle: "short" })}
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <Flag fifa={row.home.iso ?? undefined} size={20} alt={row.home.name} />
          <span className="text-sm font-semibold">{row.home.name}</span>
        </div>
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          <ScoreInput value={h} onChange={setH} disabled={pending} />
          <span className="text-muted px-1">:</span>
          <ScoreInput value={a} onChange={setA} disabled={pending} />
        </div>
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <Flag fifa={row.away.iso ?? undefined} size={20} alt={row.away.name} />
          <span className="text-sm font-semibold">{row.away.name}</span>
        </div>
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="rounded-md bg-[var(--color-primary)] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[var(--color-primary-700)] disabled:opacity-50"
          >
            {finished ? "Actualizar" : "Marcar finalizado"}
          </button>
          {finished && (
            <button
              type="button"
              onClick={clear}
              disabled={pending}
              className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs font-semibold text-[var(--color-danger)] hover:bg-[var(--color-danger-50)] disabled:opacity-50"
            >
              Borrar
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function ScoreInput({
  value, onChange, disabled,
}: { value: string; onChange: (v: string) => void; disabled: boolean }) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      max={30}
      step={1}
      value={value}
      disabled={disabled}
      onChange={(e) => {
        const v = e.target.value;
        if (v === "") return onChange("");
        const n = Number(v);
        if (Number.isInteger(n) && n >= 0 && n <= 30) onChange(String(n));
      }}
      className="h-9 w-12 rounded-md border border-[var(--color-border)] bg-white text-center text-base font-bold focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-100)] disabled:bg-[var(--color-bg)]"
    />
  );
}
