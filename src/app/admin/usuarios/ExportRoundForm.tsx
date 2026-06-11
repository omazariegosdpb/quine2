"use client";

import { useState } from "react";

type RoundOption = { code: string; name: string };

export function ExportRoundForm({ rounds }: { rounds: RoundOption[] }) {
  const [code, setCode] = useState(rounds[0]?.code ?? "");

  if (rounds.length === 0) {
    return (
      <p className="text-sm text-[var(--color-text-soft)]">No hay rondas creadas todavía.</p>
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--color-text-soft)]">
        Ronda
        <select
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="rounded-md border border-[var(--color-border)] bg-white px-2.5 py-1.5 text-sm text-[var(--color-text)]"
        >
          {rounds.map((r) => (
            <option key={r.code} value={r.code}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
      <a
        href={`/api/admin/usuarios/export-round?round=${encodeURIComponent(code)}`}
        className="rounded-md border border-[var(--color-border)] bg-white px-3 py-1.5 text-sm font-semibold text-[var(--color-primary-700)] hover:bg-[var(--color-primary-50)]"
      >
        Descargar todos
      </a>
    </div>
  );
}
