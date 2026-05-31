"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Flag } from "@/components/flags/Flag";
import {
  createTeamAction,
  updateTeamAction,
  deleteTeamAction,
} from "@/app/admin/equipos/actions";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";

type TeamActionState = { ok: boolean; message?: string };

const INITIAL: TeamActionState = { ok: false };

// ---- Crear -----------------------------------------------------------------

export function CreateTeamForm() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createTeamAction, INITIAL);
  const [iso, setIso] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const toast = useToast();

  useEffect(() => {
    if (!state.message) return;
    if (state.ok) {
      toast.success(state.message, "Equipo creado");
      formRef.current?.reset();
      setIso("");
      setOpen(false);
    } else {
      toast.error(state.message, "No se pudo crear");
    }
  }, [state, toast]);

  if (!open) {
    return (
      <Button variant="info" type="button" onClick={() => setOpen(true)}>
        + Nuevo equipo
      </Button>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--color-info-100)] bg-[var(--color-info-50)] p-4">
      <header className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-lg text-[var(--color-info-800)]">Nuevo equipo</h3>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-[var(--color-info-700)] underline">
          Cancelar
        </button>
      </header>

      <form ref={formRef} action={action} className="grid grid-cols-1 gap-3 sm:grid-cols-[auto_1fr_1fr_auto]">
        <div className="flex items-center justify-center">
          <Flag fifa={iso || undefined} size={48} alt="Vista previa" />
        </div>
        <Field
          label="Nombre"
          name="name"
          required
          placeholder="México"
        />
        <Field
          label="Código FIFA (3 letras)"
          name="isoCode"
          required
          maxLength={3}
          placeholder="MEX"
          onChange={(e) => setIso(e.currentTarget.value.toUpperCase())}
          hint="Define la bandera"
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Grupo</label>
          <select
            name="groupLetter"
            className="h-11 rounded-md border border-[var(--color-border)] bg-white px-3 text-base focus:outline-none"
          >
            <option value="">— —</option>
            {["A","B","C","D","E","F","G","H","I","J","K","L"].map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-4">
          <Button type="submit" isLoading={pending}>Crear equipo</Button>
        </div>
      </form>
    </div>
  );
}

// ---- Fila editable ---------------------------------------------------------

type Team = { id: number; name: string; iso_code: string | null; group_letter: string | null };

export function EditableTeamRow({ team }: { team: Team }) {
  const [editing, setEditing] = useState(false);
  const [delPending, setDelPending] = useState(false);
  const toast = useToast();
  const confirmDialog = useConfirm();

  async function handleDelete() {
    const ok = await confirmDialog({
      title: `Eliminar ${team.name}`,
      description: "No se podrá si el equipo está asignado a algún partido. Esta acción no se puede deshacer.",
      confirmLabel: "Eliminar",
      tone: "danger",
    });
    if (!ok) return;
    setDelPending(true);
    const r = await deleteTeamAction(team.id);
    setDelPending(false);
    if (r.ok) toast.success(r.message ?? `${team.name} eliminado.`);
    else toast.error(r.message ?? "No se pudo eliminar.", "Error");
  }

  if (editing) {
    return (
      <tr>
        <td colSpan={5} className="px-3 py-3 bg-[var(--color-bg)]">
          <EditTeamForm team={team} onClose={() => setEditing(false)} />
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td className="px-3 py-2 text-xs text-[var(--color-muted)] font-mono">{team.id}</td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <Flag fifa={team.iso_code ?? undefined} size={24} alt={team.name} />
          <span className="text-sm font-semibold">{team.name}</span>
        </div>
      </td>
      <td className="px-3 py-2 text-xs"><code>{team.iso_code ?? "—"}</code></td>
      <td className="px-3 py-2 text-xs">
        {team.group_letter ? (
          <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[var(--color-primary)] px-1.5 text-[10px] font-bold text-white">
            {team.group_letter}
          </span>
        ) : (
          <span className="text-[var(--color-muted)]">—</span>
        )}
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-md border border-[var(--color-border)] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--color-info)] hover:bg-[var(--color-info-50)]"
          >
            Editar
          </button>
          <button
            type="button"
            disabled={delPending}
            onClick={handleDelete}
            className="rounded-md border border-[var(--color-danger)]/40 bg-white px-2.5 py-1 text-xs font-semibold text-[var(--color-danger)] hover:bg-[var(--color-danger-50)] disabled:opacity-50"
          >
            {delPending ? "…" : "Eliminar"}
          </button>
        </div>
      </td>
    </tr>
  );
}

function EditTeamForm({ team, onClose }: { team: Team; onClose: () => void }) {
  const [state, action, pending] = useActionState(updateTeamAction, INITIAL);
  const [iso, setIso] = useState(team.iso_code ?? "");
  const toast = useToast();

  useEffect(() => {
    if (!state.message) return;
    if (state.ok) {
      toast.success(state.message, "Equipo actualizado");
      onClose();
    } else {
      toast.error(state.message, "No se pudo guardar");
    }
  }, [state, toast, onClose]);

  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-sm">
      <form action={action} className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[auto_1fr_1fr_auto_auto]">
        <input type="hidden" name="id" value={team.id} />
        <div className="flex items-center justify-center">
          <Flag fifa={iso || undefined} size={40} alt="Vista previa" />
        </div>
        <Field label="Nombre" name="name" defaultValue={team.name} required />
        <Field
          label="Código FIFA"
          name="isoCode"
          defaultValue={team.iso_code ?? ""}
          maxLength={3}
          required
          onChange={(e) => setIso(e.currentTarget.value.toUpperCase())}
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Grupo</label>
          <select
            name="groupLetter"
            defaultValue={team.group_letter ?? ""}
            className="h-11 rounded-md border border-[var(--color-border)] bg-white px-3 text-base focus:outline-none"
          >
            <option value="">— —</option>
            {["A","B","C","D","E","F","G","H","I","J","K","L"].map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <Button type="submit" size="sm" isLoading={pending}>Guardar</Button>
          <Button type="button" size="sm" variant="secondary" onClick={onClose}>Cerrar</Button>
        </div>
      </form>
    </div>
  );
}
