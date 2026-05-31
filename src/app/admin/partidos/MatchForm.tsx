"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Flag } from "@/components/flags/Flag";
import {
  createMatchAction,
  updateMatchAction,
  deleteMatchAction,
  type MatchActionState,
} from "@/app/admin/partidos/actions";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";

type Team = { id: number; name: string; iso_code: string | null; group_letter: string | null };

type MatchData = {
  id: number;
  round_id: string;
  group_letter: string | null;
  home_team_id: number;
  away_team_id: number;
  kickoff_at: string;
  venue: string | null;
};

const INITIAL: MatchActionState = { ok: false };

// ---- Form crear ------------------------------------------------------------
export function CreateMatchForm({
  roundId,
  teams,
  defaultKickoffLocal,
}: {
  roundId: string;
  teams: Team[];
  defaultKickoffLocal: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createMatchAction, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);
  const toast = useToast();

  useEffect(() => {
    if (!state.message) return;
    if (state.ok) {
      toast.success(state.message, "Partido creado");
      formRef.current?.reset();
      setOpen(false);
    } else {
      toast.error(state.message, "No se pudo crear");
    }
  }, [state, toast]);

  if (!open) {
    return (
      <Button variant="info" type="button" onClick={() => setOpen(true)}>
        + Nuevo partido
      </Button>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--color-info-100)] bg-[var(--color-info-50)] p-4">
      <header className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-lg text-[var(--color-info-800)]">Nuevo partido</h3>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-[var(--color-info-700)] underline">
          Cancelar
        </button>
      </header>

      <form ref={formRef} action={action}>
        <FormFields
          teams={teams}
          defaults={{ roundId, kickoffAtLocal: defaultKickoffLocal }}
        />
        <div className="mt-3">
          <Button type="submit" isLoading={pending}>Crear partido</Button>
        </div>
      </form>
    </div>
  );
}

// ---- Form editar -----------------------------------------------------------
export function EditMatchForm({
  match,
  teams,
  kickoffAtLocal,
  onClose,
}: {
  match: MatchData;
  teams: Team[];
  kickoffAtLocal: string;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState(updateMatchAction, INITIAL);
  const [delPending, setDelPending] = useState(false);
  const toast = useToast();
  const confirmDialog = useConfirm();

  useEffect(() => {
    if (!state.message) return;
    if (state.ok) {
      toast.success(state.message, "Partido actualizado");
      onClose();
    } else {
      toast.error(state.message, "No se pudo guardar");
    }
  }, [state, toast, onClose]);

  async function handleDelete() {
    const ok = await confirmDialog({
      title: `Eliminar partido #${match.id}`,
      description: "Si el partido tiene pronósticos cargados no se podrá borrar. Esta acción no se puede deshacer.",
      confirmLabel: "Eliminar",
      tone: "danger",
    });
    if (!ok) return;
    setDelPending(true);
    const r = await deleteMatchAction(match.id);
    setDelPending(false);
    if (r.ok) {
      toast.success(r.message ?? "Partido eliminado.");
      onClose();
    } else {
      toast.error(r.message ?? "No se pudo eliminar.", "Error");
    }
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
      <header className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-lg text-[var(--color-text)]">Editar partido #{match.id}</h3>
        <button type="button" onClick={onClose} className="text-sm text-[var(--color-text-soft)] underline">
          Cerrar
        </button>
      </header>

      <form action={action}>
        <input type="hidden" name="matchId" value={match.id} />
        <FormFields
          teams={teams}
          defaults={{
            roundId: match.round_id,
            kickoffAtLocal,
            homeTeamId: match.home_team_id,
            awayTeamId: match.away_team_id,
            venue: match.venue ?? "",
            groupLetter: match.group_letter ?? "",
          }}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="submit" isLoading={pending}>Guardar cambios</Button>
          <Button type="button" variant="danger" onClick={handleDelete} isLoading={delPending}>
            Eliminar
          </Button>
        </div>
      </form>
    </div>
  );
}

// ---- Campos comunes --------------------------------------------------------
function FormFields({
  teams,
  defaults,
}: {
  teams: Team[];
  defaults: {
    roundId: string;
    kickoffAtLocal: string;
    homeTeamId?: number;
    awayTeamId?: number;
    venue?: string;
    groupLetter?: string;
  };
}) {
  const [homeId, setHomeId] = useState<number | "">(defaults.homeTeamId ?? "");
  const [awayId, setAwayId] = useState<number | "">(defaults.awayTeamId ?? "");
  const home = teams.find((t) => t.id === homeId);
  const away = teams.find((t) => t.id === awayId);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <input type="hidden" name="roundId" value={defaults.roundId} />

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Local</label>
        <div className="flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-white px-3">
          <Flag fifa={home?.iso_code ?? undefined} size={24} alt={home?.name ?? "Local"} />
          <select
            name="homeTeamId"
            required
            value={homeId}
            onChange={(e) => setHomeId(e.target.value ? Number(e.target.value) : "")}
            className="h-11 w-full bg-transparent text-base focus:outline-none"
          >
            <option value="">— Elegir —</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Visitante</label>
        <div className="flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-white px-3">
          <Flag fifa={away?.iso_code ?? undefined} size={24} alt={away?.name ?? "Visita"} />
          <select
            name="awayTeamId"
            required
            value={awayId}
            onChange={(e) => setAwayId(e.target.value ? Number(e.target.value) : "")}
            className="h-11 w-full bg-transparent text-base focus:outline-none"
          >
            <option value="">— Elegir —</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      </div>

      <Field
        label="Fecha y hora del kickoff (GT)"
        name="kickoffAtLocal"
        type="datetime-local"
        defaultValue={defaults.kickoffAtLocal}
        required
      />

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Grupo (opcional)</label>
        <select
          name="groupLetter"
          defaultValue={defaults.groupLetter ?? ""}
          className="h-11 rounded-md border border-[var(--color-border)] bg-white px-3 text-base focus:outline-none"
        >
          <option value="">— Sin grupo (eliminatorias) —</option>
          {["A","B","C","D","E","F","G","H","I","J","K","L"].map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
      </div>

      <div className="sm:col-span-2">
        <Field
          label="Sede (opcional)"
          name="venue"
          placeholder="Estadio Azteca, Mexico City"
          defaultValue={defaults.venue ?? ""}
        />
      </div>
    </div>
  );
}

// ---- Trigger inline para abrir editor en una fila --------------------------
export function EditMatchToggle({
  match, teams, kickoffAtLocal,
}: {
  match: MatchData; teams: Team[]; kickoffAtLocal: string;
}) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(true)}>
        Editar
      </Button>
    );
  }
  return (
    <div className="col-span-full mt-2">
      <EditMatchForm
        match={match}
        teams={teams}
        kickoffAtLocal={kickoffAtLocal}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}
