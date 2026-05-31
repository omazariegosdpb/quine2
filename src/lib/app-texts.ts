import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AppTextsInfo = {
  quickRules: string[];
  paymentSteps: string[];
};

const DEFAULT_QUICK_RULES = [
  "3 puntos por marcador exacto, 1 punto por acertar el resultado.",
  "Pronósticos en blanco = 0 puntos. Antes del cierre podés editarlos cuantas veces quieras.",
  "Premios: 60 / 25 / 15% del pozo. Desempate: exactos → resultados → sorteo.",
];

const DEFAULT_PAYMENT_STEPS = [
  "Depositá Q100.00 en la cuenta de Banco Nexa, alcancía “Quiniela”.",
  "Tomá foto o guardá el PDF del comprobante.",
  "Subilo aquí abajo. El organizador lo revisa y confirma.",
];

function sanitize(input: unknown, fallback: string[]): string[] {
  if (!Array.isArray(input)) return fallback;
  const cleaned = input
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return cleaned.length > 0 ? cleaned : fallback;
}

/**
 * Singleton de textos configurables. Cacheado por request (RSC `cache`).
 * Si la query falla devolvemos defaults — la app no se rompe por esto.
 */
export const getAppTexts = cache(async (): Promise<AppTextsInfo> => {
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("app_texts")
      .select("quick_rules, payment_steps")
      .eq("id", "singleton")
      .maybeSingle();

    return {
      quickRules: sanitize(data?.quick_rules, DEFAULT_QUICK_RULES),
      paymentSteps: sanitize(data?.payment_steps, DEFAULT_PAYMENT_STEPS),
    };
  } catch {
    return { quickRules: DEFAULT_QUICK_RULES, paymentSteps: DEFAULT_PAYMENT_STEPS };
  }
});
