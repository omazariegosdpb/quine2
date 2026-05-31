import Link from "next/link";
import { BrandMark } from "@/components/brand/BrandMark";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { MobileNav } from "@/components/layout/MobileNav";
import { getBranding } from "@/lib/branding";
import type { Profile } from "@/lib/supabase/types";

type HeaderProps = {
  profile?: Profile | null;
};

export async function Header({ profile }: HeaderProps) {
  const isAdmin = profile?.role === "admin";
  const branding = await getBranding();

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="h-1 bg-tricolor-soft" aria-hidden />
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-3 sm:px-4">
        <Link
          href="/"
          className="flex shrink-0 items-center rounded-md px-1 py-1 transition-transform active:scale-[0.97]"
          aria-label={`Inicio · ${branding.companyName}`}
        >
          <span className="sm:hidden">
            <BrandMark branding={branding} compact />
          </span>
          <span className="hidden sm:inline-flex">
            <BrandMark branding={branding} withWordmark />
          </span>
        </Link>

        {profile ? (
          <>
            {/* Desktop nav */}
            <nav className="hidden items-center gap-1 sm:flex">
              <DesktopNavLink href="/" label="Inicio" />
              <DesktopNavLink href="/pronosticos" label="Pronósticos" />
              <DesktopNavLink href="/grupos" label="Grupos" />
              <DesktopNavLink href="/ranking" label="Ranking" />
              {isAdmin && <DesktopNavLink href="/admin" label="Admin" highlight />}
              <div className="ml-2 flex items-center gap-3 border-l border-[var(--color-border)] pl-3">
                <span className="max-w-[140px] truncate text-sm text-[var(--color-text-soft)]">
                  {profile.display_name}
                </span>
                <LogoutButton />
              </div>
            </nav>

            {/* Mobile menu */}
            <div className="sm:hidden">
              <MobileNav profile={profile} />
            </div>
          </>
        ) : (
          <Link
            href="/login"
            className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[var(--color-primary-700)] active:scale-[0.97] active:bg-[var(--color-primary-800)] active:shadow-inner"
          >
            Entrar
          </Link>
        )}
      </div>
    </header>
  );
}

function DesktopNavLink({
  href, label, highlight,
}: { href: string; label: string; highlight?: boolean }) {
  return (
    <Link
      href={href}
      className={[
        "rounded-md px-2.5 py-1.5 text-sm font-medium transition-all active:scale-[0.96]",
        highlight
          ? "text-[var(--color-gold-600)] hover:bg-[var(--color-gold-400)]/10 active:bg-[var(--color-gold-400)]/20"
          : "text-[var(--color-text-soft)] hover:bg-black/5 hover:text-[var(--color-text)] active:bg-black/10",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}
