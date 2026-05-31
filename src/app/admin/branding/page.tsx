import { getBranding } from "@/lib/branding";
import { BrandingForm } from "./BrandingForm";

export const metadata = { title: "Marca · Admin" };

export default async function AdminBrandingPage() {
  const branding = await getBranding();

  return (
    <div className="max-w-2xl">
      <div className="mb-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm">
        <h2 className="font-display text-xl text-[var(--color-text)]">
          Personalización de la empresa
        </h2>
        <p className="mt-1 text-sm text-[var(--color-text-soft)]">
          El nombre y logo aparecen en el header de toda la app y en la pantalla
          de inicio para visitantes no autenticados.
        </p>
      </div>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm">
        <BrandingForm
          companyName={branding.companyName}
          logoUrl={branding.logoUrl}
        />
      </div>
    </div>
  );
}
