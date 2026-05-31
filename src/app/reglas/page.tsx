import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { Header } from "@/components/layout/Header";
import { getSession } from "@/lib/auth/session";

export const metadata = {
  title: "Reglas · Quiniela Mundial 2026",
};

export default async function ReglasPage() {
  const session = await getSession();

  return (
    <>
      {session?.profile ? (
        <Header profile={session.profile} />
      ) : (
        <header className="border-b border-[var(--color-border)] bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <Link href="/" aria-label="Inicio">
              <Logo className="h-10 w-auto" />
            </Link>
            <Link
              href="/login"
              className="rounded-md bg-[var(--color-pitch-600)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-pitch-700)]"
            >
              Entrar
            </Link>
          </div>
        </header>
      )}

      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <p className="font-display text-sm uppercase tracking-widest text-[var(--color-pitch-700)]">
          Bases Oficiales · v1.3
        </p>
        <h1 className="mt-1 font-display text-3xl md:text-4xl">Reglas de la Quiniela</h1>

        <section className="prose prose-sm sm:prose-base mt-6 max-w-none text-[var(--color-text-soft)]">
          <h2 className="font-display text-xl text-[var(--color-text)]">Resumen</h2>
          <ul>
            <li>Aporte: <strong>Q100</strong> por persona.</li>
            <li>Cierre de pronósticos: lo fija el organizador antes del Mundial.</li>
            <li>Premios: <strong>60% / 25% / 15%</strong> del pozo total.</li>
            <li>Pago de premios: 1 día después del último partido de la fase de grupos.</li>
            <li>Transparencia: al cierre se publica un PDF firmado con hash SHA-256.</li>
          </ul>

          <h2 className="mt-6 font-display text-xl text-[var(--color-text)]">Puntuación</h2>
          <ul>
            <li><strong>3 puntos</strong> por marcador exacto.</li>
            <li><strong>1 punto</strong> por acertar el resultado (G/E/P) sin marcador exacto.</li>
            <li><strong>0 puntos</strong> si no se acierta o si el pronóstico quedó vacío.</li>
          </ul>

          <h2 className="mt-6 font-display text-xl text-[var(--color-text)]">Cierre y cambios</h2>
          <p>
            Cuando llega la fecha y hora de cierre, ninguna predicción se puede crear ni modificar.
            La ronda queda sellada y se genera un PDF de respaldo con hash criptográfico para verificación.
          </p>

          <h2 className="mt-6 font-display text-xl text-[var(--color-text)]">Desempates</h2>
          <ol>
            <li>Mayor cantidad de marcadores exactos.</li>
            <li>Mayor cantidad de resultados acertados (no exactos).</li>
            <li>Sorteo público con seed verificable (commit-reveal).</li>
          </ol>

          <h2 className="mt-6 font-display text-xl text-[var(--color-text)]">Privacidad</h2>
          <ul>
            <li>Visible: nombre, puntos, ranking, estadísticas de la quiniela.</li>
            <li>No visible: correo, comprobantes de pago, datos personales.</li>
            <li>Pronósticos de otros jugadores: ocultos hasta el cierre.</li>
          </ul>

          <h2 className="mt-6 font-display text-xl text-[var(--color-text)]">Documento oficial</h2>
          <p>
            El PDF original con las bases firmadas está disponible para descarga:{" "}
            <a
              href="/docs/bases-quiniela-mundial-2026.pdf"
              className="underline"
            >
              Bases v1.3 (PDF)
            </a>.
          </p>
        </section>
      </main>
    </>
  );
}
