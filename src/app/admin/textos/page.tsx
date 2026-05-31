import { getAppTexts } from "@/lib/app-texts";
import { TextsForm } from "./TextsForm";

export const metadata = { title: "Textos · Admin" };

export default async function AdminTextosPage() {
  const { quickRules, paymentSteps } = await getAppTexts();

  return (
    <div className="max-w-2xl">
      <div className="mb-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm">
        <h2 className="font-display text-xl text-[var(--color-text)]">
          Textos configurables
        </h2>
        <p className="mt-1 text-sm text-[var(--color-text-soft)]">
          Editá las reglas rápidas que aparecen en el panel principal y los
          pasos del pago que aparecen en <code>/pago</code>. Texto plano — sin
          negritas ni enlaces.
        </p>
      </div>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm">
        <TextsForm
          initialQuickRules={quickRules}
          initialPaymentSteps={paymentSteps}
        />
      </div>
    </div>
  );
}
