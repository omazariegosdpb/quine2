"use client";

import { useTransition } from "react";
import { userAdminAction } from "@/app/admin/usuarios/actions";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";

type Props = { userId: string; isActive: boolean };

export function UserActionsForm({ userId, isActive }: Props) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const confirm = useConfirm();

  async function run(action: "deactivate" | "soft-deactivate" | "activate" | "reset-password") {
    if (action === "deactivate") {
      const ok = await confirm({
        title: "Retirar jugador",
        description: "El jugador queda anonimizado y no podrá volver a iniciar sesión. Sus pronósticos se conservan para auditoría.",
        confirmLabel: "Retirar",
        tone: "danger",
      });
      if (!ok) return;
    } else if (action === "soft-deactivate") {
      const ok = await confirm({
        title: "Desactivar jugador",
        description: "No aparecerá en el ranking y no podrá iniciar sesión hasta reactivarlo. Se conservan su nombre, pago e historial. Es reversible.",
        confirmLabel: "Desactivar",
        tone: "warning",
      });
      if (!ok) return;
    } else if (action === "reset-password") {
      const ok = await confirm({
        title: "Resetear contraseña",
        description: "Se generará una contraseña temporal y se forzará el cambio en el próximo login del usuario.",
        confirmLabel: "Resetear",
        tone: "warning",
      });
      if (!ok) return;
    }

    const fd = new FormData();
    fd.set("userId", userId);
    fd.set("action", action);
    startTransition(async () => {
      const r = await userAdminAction(fd);
      if (r.ok) {
        if (action === "reset-password") {
          // La nueva contraseña va en el mensaje — mostrarla 15s para que el admin la copie.
          toast.push({
            tone: "info",
            title: "Anotá la contraseña ahora",
            text: r.message ?? "Contraseña reseteada.",
            duration: 15000,
          });
        } else {
          toast.success(r.message ?? "Hecho.");
        }
      } else {
        toast.error(r.message ?? "No se pudo aplicar.", "Error");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => run("reset-password")}
        className="rounded-md border border-[var(--color-border)] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--color-info)] hover:bg-[var(--color-info-50)] disabled:opacity-50"
      >
        Resetear contraseña
      </button>
      {isActive ? (
        <>
          <button
            type="button"
            disabled={pending}
            onClick={() => run("soft-deactivate")}
            className="rounded-md border border-[var(--color-border)] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--color-text-soft)] hover:bg-[var(--color-bg)] disabled:opacity-50"
          >
            Desactivar
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => run("deactivate")}
            className="rounded-md border border-[var(--color-danger)]/40 bg-white px-2.5 py-1 text-xs font-semibold text-[var(--color-danger)] hover:bg-[var(--color-danger-50)] disabled:opacity-50"
          >
            Retirar
          </button>
        </>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => run("activate")}
          className="rounded-md border border-[var(--color-border)] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--color-primary-700)] hover:bg-[var(--color-primary-50)] disabled:opacity-50"
        >
          Reactivar
        </button>
      )}
    </div>
  );
}
