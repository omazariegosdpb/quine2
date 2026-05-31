"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/auth/LogoutButton";
import type { Profile } from "@/lib/supabase/types";

type Props = { profile: Profile };

const NAV_ITEMS = [
  { href: "/",            label: "Inicio" },
  { href: "/pronosticos", label: "Pronósticos" },
  { href: "/grupos",      label: "Grupos" },
  { href: "/ranking",     label: "Ranking" },
  { href: "/pago",        label: "Mi pago" },
  { href: "/reglas",      label: "Reglas" },
];

export function MobileNav({ profile }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const isAdmin = profile.role === "admin";

  // Cerrar al cambiar de ruta
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Cerrar al apretar ESC + bloquear scroll del body cuando abierto
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label="Abrir menú"
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[var(--color-border)] bg-white text-[var(--color-text-soft)] transition-all duration-150 ease-out hover:bg-[var(--color-bg)] hover:shadow-sm active:scale-[0.94] active:bg-[var(--color-stone-200)] active:shadow-inner"
      >
        <Hamburger open={open} />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 top-[57px] z-40 bg-black/40"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <nav
            id="mobile-nav-panel"
            className="fixed left-0 right-0 top-[57px] z-50 border-b border-[var(--color-border)] bg-white shadow-xl"
            aria-label="Menú principal"
          >
            <div className="mx-auto flex max-w-5xl flex-col gap-1 p-3">
              <div className="border-b border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-text-soft)]">
                Hola, <strong className="text-[var(--color-text)]">{profile.display_name}</strong>
              </div>
              {NAV_ITEMS.map((item) => (
                <MobileLink key={item.href} href={item.href} label={item.label} active={pathname === item.href} />
              ))}
              {isAdmin && (
                <MobileLink
                  href="/admin"
                  label="Admin"
                  active={pathname.startsWith("/admin")}
                  highlight
                />
              )}
              <div className="mt-2 border-t border-[var(--color-border)] pt-2">
                <LogoutButton />
              </div>
            </div>
          </nav>
        </>
      )}
    </>
  );
}

function MobileLink({
  href, label, active, highlight,
}: {
  href: string; label: string; active: boolean; highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={[
        "rounded-md px-3 py-3 text-base font-semibold transition-all duration-150 ease-out active:scale-[0.98]",
        active
          ? "bg-[var(--color-primary-50)] text-[var(--color-primary-700)] active:bg-[var(--color-primary-100)]"
          : highlight
            ? "text-[var(--color-gold-600)] hover:bg-[var(--color-gold-400)]/10 active:bg-[var(--color-gold-400)]/20"
            : "text-[var(--color-text)] hover:bg-[var(--color-bg)] active:bg-[var(--color-stone-200)]",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

function Hamburger({ open }: { open: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      aria-hidden
    >
      {open ? (
        <>
          <line x1="6"  y1="6"  x2="18" y2="18" />
          <line x1="18" y1="6"  x2="6"  y2="18" />
        </>
      ) : (
        <>
          <line x1="4" y1="7"  x2="20" y2="7" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="17" x2="20" y2="17" />
        </>
      )}
    </svg>
  );
}
