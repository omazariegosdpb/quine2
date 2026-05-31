import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { requireAdmin } from "@/lib/auth/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();

  return (
    <>
      <Header profile={session.profile} />
      <div className="mx-auto w-full max-w-6xl flex-1 px-3 py-5 sm:px-4">
        <p className="font-display text-xs uppercase tracking-widest text-[var(--color-gold-600)]">
          Panel de organizador
        </p>
        <h1 className="font-display text-3xl text-[var(--color-text)] md:text-4xl">Admin</h1>

        <nav className="no-scrollbar mt-4 mb-6 -mx-3 flex gap-1.5 overflow-x-auto border-b border-[var(--color-border)] px-3 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          <AdminTab href="/admin" label="Inicio" />
          <AdminTab href="/admin/usuarios" label="Usuarios" />
          <AdminTab href="/admin/pagos" label="Pagos" />
          <AdminTab href="/admin/rondas" label="Rondas" />
          <AdminTab href="/admin/partidos" label="Partidos" />
          <AdminTab href="/admin/equipos" label="Equipos" />
          <AdminTab href="/admin/resultados" label="Resultados" />
          <AdminTab href="/admin/branding" label="Marca" />
          <AdminTab href="/admin/textos" label="Textos" />
          <AdminTab href="/admin/auditoria" label="Auditoría" />
        </nav>

        {children}
      </div>
    </>
  );
}

function AdminTab({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="shrink-0 rounded-t-md border-b-2 border-transparent px-3 py-2 text-sm font-semibold text-[var(--color-text-soft)] transition-all duration-150 ease-out hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-50)]/60 hover:text-[var(--color-primary-700)] active:scale-[0.97] active:bg-[var(--color-primary-100)]"
    >
      {label}
    </Link>
  );
}
