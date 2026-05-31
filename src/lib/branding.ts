import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type BrandingInfo = {
  companyName: string;
  logoUrl: string | null;
};

const DEFAULT_COMPANY_NAME = "Quiniela Mundial 2026";

/**
 * Lee la fila singleton de `branding`. Cacheada por request (RSC `cache`).
 * Devuelve la URL pública del logo (bucket `branding` es público).
 * Si algo falla, regresa valores por defecto — la app sigue funcionando.
 */
export const getBranding = cache(async (): Promise<BrandingInfo> => {
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("branding")
      .select("company_name, logo_path")
      .eq("id", "singleton")
      .maybeSingle();

    const companyName = data?.company_name?.trim() || DEFAULT_COMPANY_NAME;

    let logoUrl: string | null = null;
    if (data?.logo_path) {
      const { data: pub } = supabase.storage.from("branding").getPublicUrl(data.logo_path);
      // Cache-bust con el path mismo (cambia al subir un logo nuevo).
      logoUrl = pub?.publicUrl ?? null;
    }

    return { companyName, logoUrl };
  } catch {
    return { companyName: DEFAULT_COMPANY_NAME, logoUrl: null };
  }
});
