"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

export function UploadReceipt({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  async function handleUpload() {
    const f = fileRef.current?.files?.[0];
    if (!f) return setMsg({ tone: "danger", text: "Selecciona un archivo primero." });
    setUploading(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.set("file", f);
      const res = await fetch("/api/payments/receipt", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errMap: Record<string, string> = {
          "no-session": "Sesión expirada. Inicia sesión nuevamente.",
          "no-file": "No se recibió el archivo.",
          "too-large": "El archivo supera 4 MB.",
          "type-not-allowed": "Formato no permitido. Usá JPG/PNG/WebP/HEIC/PDF.",
          "admin-not-configured": "El servidor no tiene SUPABASE_SERVICE_ROLE_KEY. Avisá al organizador.",
        };
        setMsg({ tone: "danger", text: errMap[data.error] ?? data.message ?? "No se pudo subir." });
      } else {
        setMsg({ tone: "success", text: "Comprobante recibido. El organizador lo va a revisar." });
        setName(null);
        if (fileRef.current) fileRef.current.value = "";
        router.refresh();
      }
    } catch (e) {
      setMsg({ tone: "danger", text: (e as Error).message });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}

      <label
        className={[
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors",
          disabled ? "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed" : "border-[var(--color-pitch-300)] bg-[var(--color-pitch-50)] hover:bg-[var(--color-pitch-100)] text-[var(--color-pitch-800)]",
        ].join(" ")}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          className="sr-only"
          disabled={disabled}
          onChange={(e) => setName(e.target.files?.[0]?.name ?? null)}
        />
        <span className="font-semibold">
          {name ? `Archivo: ${name}` : "Tocá para elegir comprobante"}
        </span>
        <span className="text-xs text-[var(--color-text-soft)]">
          JPG, PNG, HEIC o PDF · máx 4 MB
        </span>
      </label>

      <Button
        type="button"
        onClick={handleUpload}
        disabled={disabled || !name}
        isLoading={uploading}
        size="lg"
      >
        Enviar comprobante
      </Button>
    </div>
  );
}
