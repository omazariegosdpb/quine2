import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { requireSession } from "@/lib/auth/session";
import { Alert } from "@/components/ui/Alert";
import { ChangePasswordForm } from "@/app/cambio-password/ChangePasswordForm";

export const metadata = {
  title: "Cambiar contraseña · Quiniela Mundial 2026",
};

export default async function ChangePasswordPage() {
  // skipPasswordCheck para no entrar en loop de redirect a sí misma.
  const ctx = await requireSession({ skipPasswordCheck: true });

  // Si el usuario YA cambió la contraseña, no tiene nada que hacer acá.
  if (!ctx.profile.must_change_password) {
    redirect("/");
  }

  return (
    <main className="min-h-screen bg-[var(--color-bg)]">
      <header className="flex justify-center py-8">
        <Link href="/" aria-label="Inicio">
          <Logo className="h-12 w-auto" />
        </Link>
      </header>

      <section className="mx-auto w-full max-w-md px-4 pb-12">
        <div className="rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-sm sm:p-8">
          <h1 className="font-display text-3xl text-[var(--color-text)]">
            Cambiá tu contraseña
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-soft)]">
            Por seguridad, antes de continuar necesitamos que reemplaces la contraseña
            temporal que te asignó el organizador.
          </p>

          <div className="mt-4">
            <Alert tone="info">
              Esta acción solo se hace una vez. Luego vas a poder hacer tus pronósticos.
            </Alert>
          </div>

          <div className="mt-6">
            <ChangePasswordForm />
          </div>
        </div>
      </section>
    </main>
  );
}
