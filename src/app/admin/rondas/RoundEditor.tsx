"use client";

import { useActionState, useEffect, useTransition } from "react";
import {
  updateRoundCloseAction,
  updateRoundRankingGroupAction,
  sealRoundAction,
  toggleRoundActiveAction,
  deleteRoundAction,
  type RoundActionState,
} from "@/app/admin/rondas/actions";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";

const INITIAL: RoundActionState = { ok: false };

type Props = {
  round: {
    id: string;
    code: string;
    name: string;
    closes_at: string;
    is_locked: boolean;
    is_active: boolean;
    ranking_group: string | null;
    snapshot_at: string | null;
    snapshot_hash: string | null;
  };
  closesAtLocal: string;
};

export function RoundEditor({ round, closesAtLocal }: Props) {
  const [state, action, pending] = useActionState(updateRoundCloseAction, INITIAL);
  const [groupState, groupAction, groupPending] = useActionState(updateRoundRankingGroupAction, INITIAL);
  const [sealPending, startSeal] = useTransition();
  const [togglePending, startToggle] = useTransition();
  const [deletePending, startDelete] = useTransition();
  const toast = useToast();
  const confirm = useConfirm();

  // Reflejamos el resultado del action en toast.
  useEffect(() => {
    if (!state.message) return;
    if (state.ok) toast.success(state.message);
    else toast.error(state.message);
  }, [state, toast]);

  useEffect(() => {
    if (!groupState.message) return;
    if (groupState.ok) toast.success(groupState.message);
    else toast.error(groupState.message);
  }, [groupState, toast]);

  async function doSeal() {
    const ok = await confirm({
      title: "Sellar ronda",
      description: "Después de esto nadie podrá modificar pronósticos de esta ronda. Se generará el snapshot inmutable con hash SHA-256.",
      confirmLabel: "Sellar",
      tone: "warning",
    });
    if (!ok) return;
    startSeal(async () => {
      const r = await sealRoundAction(round.id);
      if (r.ok) toast.success(r.message ?? "Ronda sellada.", "Listo");
      else toast.error(r.message ?? "No se pudo sellar.", "Error");
    });
  }

  async function doToggle() {
    const next = !round.is_active;
    if (!next) {
      const ok = await confirm({
        title: `Desactivar “${round.name}”`,
        description: "La ronda dejará de aparecer en /pronosticos para los jugadores y sus puntos no contarán en el ranking. Los pronósticos NO se borran.",
        confirmLabel: "Desactivar",
        tone: "warning",
      });
      if (!ok) return;
    }
    startToggle(async () => {
      const r = await toggleRoundActiveAction(round.id, next);
      if (r.ok) toast.success(r.message ?? (next ? "Ronda activada." : "Ronda desactivada."));
      else toast.error(r.message ?? "No se pudo actualizar.", "Error");
    });
  }

  async function doDelete() {
    const ok1 = await confirm({
      title: `Eliminar “${round.name}”`,
      description: "Esta acción borra la ronda y todos sus partidos. No se puede deshacer.",
      confirmLabel: "Continuar",
      tone: "danger",
    });
    if (!ok1) return;
    const ok2 = await confirm({
      title: "¿Estás seguro?",
      description: "Vas a perder definitivamente los partidos de esta ronda.",
      confirmLabel: "Sí, eliminar",
      tone: "danger",
    });
    if (!ok2) return;
    startDelete(async () => {
      const r = await deleteRoundAction(round.id);
      if (r.ok) toast.success(r.message ?? "Ronda eliminada.");
      else toast.error(r.message ?? "No se pudo eliminar.", "Error");
    });
  }

  return (
    <div className={[
      "overflow-hidden rounded-xl border bg-[var(--color-surface)] shadow-sm",
      round.is_active ? "border-[var(--color-border)]" : "border-[var(--color-stone-300)] opacity-80",
    ].join(" ")}>
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-[var(--color-border)] px-5 py-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-muted)]">{round.code}</p>
          <h3 className="font-display text-xl text-[var(--color-text)]">{round.name}</h3>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Pill tone={round.is_locked ? "muted" : "green"}>
            {round.is_locked ? "Sellada" : "Abierta"}
          </Pill>
          <Pill tone={round.is_active ? "blue" : "muted"}>
            {round.is_active ? "Activa" : "Inactiva"}
          </Pill>
          {round.ranking_group && (
            <Pill tone="amber">🔗 {round.ranking_group}</Pill>
          )}
        </div>
      </header>

      <div className="space-y-3 p-5">
        {round.is_locked ? (
          <div className="space-y-2 text-sm text-[var(--color-text-soft)]">
            <p>
              <strong>Sellada el:</strong>{" "}
              {round.snapshot_at ? new Date(round.snapshot_at).toLocaleString("es-GT") : "—"}
            </p>
            <p className="break-all">
              <strong>Hash SHA-256:</strong>{" "}
              <code className="rounded bg-[var(--color-bg)] px-1.5 py-0.5 text-xs">
                {round.snapshot_hash ?? "—"}
              </code>
            </p>
          </div>
        ) : (
          <form action={action} className="space-y-3">
            <input type="hidden" name="roundId" value={round.id} />
            <Field
              label="Cierre (hora Guatemala)"
              name="closesAtLocal"
              type="datetime-local"
              defaultValue={closesAtLocal}
              required
              hint="A partir de este momento ningún jugador podrá crear ni modificar pronósticos."
            />
            <div className="flex flex-wrap gap-2">
              <Button type="submit" isLoading={pending}>Guardar cierre</Button>
              <Button type="button" variant="danger" onClick={doSeal} isLoading={sealPending}>
                Sellar ahora
              </Button>
            </div>
          </form>
        )}

        <form action={groupAction} className="space-y-2 border-t border-[var(--color-border)] pt-3">
          <input type="hidden" name="roundId" value={round.id} />
          <Field
            label="Grupo de ranking (amarre)"
            name="rankingGroup"
            defaultValue={round.ranking_group ?? ""}
            placeholder="Ej.: ELIMINATORIAS"
            hint="Rondas con el mismo grupo comparten un ranking aparte (16avos + 8avos = un solo leaderboard). Vacío = solo cuenta en el ranking general."
          />
          <Button type="submit" variant="secondary" size="sm" isLoading={groupPending}>
            Guardar grupo
          </Button>
        </form>

        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--color-border)] pt-3">
          <Button
            type="button"
            variant={round.is_active ? "secondary" : "info"}
            size="sm"
            onClick={doToggle}
            isLoading={togglePending}
          >
            {round.is_active ? "Desactivar" : "Activar"}
          </Button>
          {!round.is_locked && (
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={doDelete}
              isLoading={deletePending}
            >
              Eliminar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Pill({ tone, children }: { tone: "muted" | "green" | "blue" | "amber"; children: React.ReactNode }) {
  const cls = {
    muted: "bg-[var(--color-stone-200)] text-[var(--color-stone-700)]",
    green: "bg-[var(--color-primary)] text-white",
    blue:  "bg-[var(--color-info)] text-white",
    amber: "bg-[var(--color-gold-50)] text-[var(--color-gold-700)]",
  }[tone];
  return (
    <span className={["inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide", cls].join(" ")}>
      {children}
    </span>
  );
}
