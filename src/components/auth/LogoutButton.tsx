"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function LogoutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    startTransition(() => {
      router.replace("/login");
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={pending}
      className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium text-[var(--color-text-soft)] transition-all duration-150 ease-out hover:bg-black/5 hover:shadow-sm active:scale-[0.96] active:bg-black/10 active:shadow-inner disabled:opacity-60 disabled:active:scale-100"
    >
      {pending ? "Saliendo…" : "Salir"}
    </button>
  );
}
