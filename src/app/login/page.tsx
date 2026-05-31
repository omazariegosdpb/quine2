import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { getSession } from "@/lib/auth/session";
import { LoginForm } from "@/app/login/LoginForm";

export const metadata = {
  title: "Iniciar sesión · Quiniela Mundial 2026",
};

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/");

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
            Iniciar sesión
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-soft)]">
            Acceso solo para participantes registrados por el organizador.
          </p>

          <div className="mt-6">
            <Suspense fallback={<div className="h-44" />}>
              <LoginForm />
            </Suspense>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-[var(--color-muted)]">
          ¿No tenés cuenta? Pedí ser agregado al organizador.{" "}
          <Link href="/reglas" className="underline">
            Ver reglas
          </Link>
        </p>
      </section>
    </main>
  );
}
